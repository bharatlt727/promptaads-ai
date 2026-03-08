"""Ad generator — rewrite ads using an LLM so they fit the user's context.

The top-ranked ad's raw title/description is transformed into a natural,
context-aware "Sponsored" message that reads as if it were written
specifically for the user's prompt.

Features:
  - Async OpenAI chat completion with retry + exponential backoff
  - In-memory LRU cache keyed on (ad_id, prompt_hash)
  - Deterministic fallback text when the LLM is unreachable
  - Temperature / max-token controls via config
"""

from __future__ import annotations

import asyncio
import hashlib
import time
from collections import OrderedDict
from typing import Final

import structlog
from openai import AsyncOpenAI

from core.config import settings

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_MAX_RETRIES: Final[int] = 3
_RETRY_BASE_DELAY: Final[float] = 0.5
_CACHE_SIZE: Final[int] = 1024
_CACHE_TTL: Final[int] = 1800                   # 30 min

_SYSTEM_PROMPT: Final[str] = (
    "You are an expert advertising copywriter. "
    "Given a user's original query and an advertisement, rewrite the ad as a single, "
    "concise sponsored message (1-2 sentences). The message MUST:\n"
    "1. Start with 'Sponsored:'\n"
    "2. Naturally relate to the user's query\n"
    "3. Highlight the product's value proposition\n"
    "4. Sound helpful, not pushy\n"
    "5. Stay factual — do not invent features not present in the ad"
)


# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------

class GeneratedAd:
    """Container for a generated ad text."""

    __slots__ = ("ad_id", "title", "text", "from_cache", "latency_ms")

    def __init__(
        self,
        ad_id: str,
        title: str,
        text: str,
        from_cache: bool = False,
        latency_ms: float = 0.0,
    ) -> None:
        self.ad_id = ad_id
        self.title = title
        self.text = text
        self.from_cache = from_cache
        self.latency_ms = latency_ms

    def to_dict(self) -> dict:
        return {
            "ad_id": self.ad_id,
            "title": self.title,
            "text": self.text,
            "from_cache": self.from_cache,
            "latency_ms": self.latency_ms,
        }


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

class _GenerationCache:
    """LRU + TTL cache for generated ad copy."""

    __slots__ = ("_store", "_max_size", "_ttl")

    def __init__(self, max_size: int = _CACHE_SIZE, ttl: int = _CACHE_TTL) -> None:
        self._store: OrderedDict[str, tuple[str, float]] = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl

    @staticmethod
    def _key(ad_id: str, prompt: str) -> str:
        h = hashlib.sha256(f"{ad_id}::{prompt}".encode()).hexdigest()[:32]
        return h

    def get(self, ad_id: str, prompt: str) -> str | None:
        key = self._key(ad_id, prompt)
        entry = self._store.get(key)
        if entry is None:
            return None
        text, ts = entry
        if time.monotonic() - ts > self._ttl:
            self._store.pop(key, None)
            return None
        self._store.move_to_end(key)
        return text

    def put(self, ad_id: str, prompt: str, text: str) -> None:
        key = self._key(ad_id, prompt)
        self._store[key] = (text, time.monotonic())
        self._store.move_to_end(key)
        while len(self._store) > self._max_size:
            self._store.popitem(last=False)

    def clear(self) -> None:
        self._store.clear()


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class AdGenerator:
    """Rewrite an ad using an LLM so it contextually fits the user's prompt."""

    _instance: AdGenerator | None = None

    def __init__(self, model: str | None = None) -> None:
        self._client: AsyncOpenAI | None = None
        self._cache = _GenerationCache()
        self._model = model or getattr(settings, "llm_model", "gpt-4o-mini")

    # ── Singleton ─────────────────────────────────────────

    @classmethod
    def get_instance(cls) -> AdGenerator:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        cls._instance = None

    # ── Lazy client ───────────────────────────────────────

    @property
    def client(self) -> AsyncOpenAI:
        if self._client is None:
            kwargs: dict = {"api_key": settings.resolved_api_key}
            base_url = settings.resolved_base_url
            if base_url:
                kwargs["base_url"] = base_url
            self._client = AsyncOpenAI(**kwargs)
        return self._client

    # ── Public API ────────────────────────────────────────

    async def generate(
        self,
        ad_id: str,
        ad_title: str,
        ad_description: str,
        user_prompt: str,
        *,
        product_url: str | None = None,
        category: str | None = None,
        keywords: list[str] | None = None,
    ) -> GeneratedAd:
        """Generate a context-aware sponsored message for *ad* given *user_prompt*.

        Returns a :class:`GeneratedAd` with the rewritten text.
        Falls back to a deterministic template if the LLM is unavailable.
        """
        t0 = time.perf_counter()

        # Check cache
        cached = self._cache.get(ad_id, user_prompt)
        if cached is not None:
            logger.debug("ad_generator_cache_hit", ad_id=ad_id)
            return GeneratedAd(
                ad_id=ad_id,
                title=ad_title,
                text=cached,
                from_cache=True,
                latency_ms=round((time.perf_counter() - t0) * 1000, 2),
            )

        # Build the user message for the LLM
        user_message = self._build_user_message(
            ad_title=ad_title,
            ad_description=ad_description,
            user_prompt=user_prompt,
            product_url=product_url,
            category=category,
            keywords=keywords,
        )

        # Call LLM with retry
        try:
            text = await self._call_llm(user_message)
        except Exception:
            logger.error("ad_generator_llm_failed", ad_id=ad_id, exc_info=True)
            text = self._fallback_text(ad_title, ad_description)

        # Ensure text starts with "Sponsored:"
        if not text.startswith("Sponsored:"):
            text = f"Sponsored: {text}"

        self._cache.put(ad_id, user_prompt, text)

        latency = round((time.perf_counter() - t0) * 1000, 2)
        logger.info("ad_generated", ad_id=ad_id, latency_ms=latency)
        return GeneratedAd(
            ad_id=ad_id,
            title=ad_title,
            text=text,
            from_cache=False,
            latency_ms=latency,
        )

    def clear_cache(self) -> None:
        self._cache.clear()

    # ── Internals ─────────────────────────────────────────

    @staticmethod
    def _build_user_message(
        *,
        ad_title: str,
        ad_description: str,
        user_prompt: str,
        product_url: str | None,
        category: str | None,
        keywords: list[str] | None,
    ) -> str:
        parts: list[str] = [
            f"User query: \"{user_prompt}\"",
            "",
            "Advertisement details:",
            f"  Title: {ad_title}",
            f"  Description: {ad_description}",
        ]
        if product_url:
            parts.append(f"  URL: {product_url}")
        if category:
            parts.append(f"  Category: {category}")
        if keywords:
            parts.append(f"  Keywords: {', '.join(keywords)}")
        parts.append("")
        parts.append(
            "Rewrite this ad as a single sponsored message that naturally "
            "relates to the user's query."
        )
        return "\n".join(parts)

    async def _call_llm(self, user_message: str) -> str:
        last_exc: Exception | None = None
        for attempt in range(_MAX_RETRIES):
            try:
                resp = await self.client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": user_message},
                    ],
                    temperature=0.7,
                    max_tokens=150,
                )
                content = resp.choices[0].message.content
                return (content or "").strip()
            except Exception as exc:
                last_exc = exc
                delay = _RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    "ad_generator_retry",
                    attempt=attempt + 1,
                    delay=delay,
                    error=str(exc),
                )
                await asyncio.sleep(delay)
        raise RuntimeError(
            f"Ad generation failed after {_MAX_RETRIES} retries"
        ) from last_exc

    @staticmethod
    def _fallback_text(title: str, description: str) -> str:
        """Deterministic fallback when the LLM is unavailable."""
        return f"Sponsored: {title} — {description}"
