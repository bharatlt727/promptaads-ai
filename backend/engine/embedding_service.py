"""Embedding service — convert text into vectors via OpenAI.

Responsibilities:
  - Manage a singleton AsyncOpenAI client (lazy init)
  - Generate embeddings for ad text and user prompts
  - Provide in-memory LRU caching to avoid redundant API calls
  - Graceful error handling with retries

Usage::

    from engine.embedding_service import EmbeddingService
    svc = EmbeddingService.get_instance()
    vector = await svc.embed("best laptop for developers")
"""

from __future__ import annotations

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
_RETRY_BASE_DELAY: Final[float] = 0.5          # seconds
_DEFAULT_CACHE_SIZE: Final[int] = 2048          # entries
_DEFAULT_CACHE_TTL: Final[int] = 3600           # 1 hour


# ---------------------------------------------------------------------------
# Embedding cache (in-memory, per-process)
# ---------------------------------------------------------------------------
class _EmbeddingCache:
    """Thread-safe-ish LRU cache with TTL for embedding vectors."""

    __slots__ = ("_store", "_max_size", "_ttl")

    def __init__(self, max_size: int = _DEFAULT_CACHE_SIZE, ttl: int = _DEFAULT_CACHE_TTL) -> None:
        self._store: OrderedDict[str, tuple[list[float], float]] = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl

    @staticmethod
    def _key(text: str, model: str) -> str:
        return hashlib.sha256(f"{model}::{text}".encode()).hexdigest()

    def get(self, text: str, model: str) -> list[float] | None:
        key = self._key(text, model)
        entry = self._store.get(key)
        if entry is None:
            return None
        vector, ts = entry
        if time.monotonic() - ts > self._ttl:
            self._store.pop(key, None)
            return None
        # Move to end (most-recently used)
        self._store.move_to_end(key)
        return vector

    def put(self, text: str, model: str, vector: list[float]) -> None:
        key = self._key(text, model)
        self._store[key] = (vector, time.monotonic())
        self._store.move_to_end(key)
        while len(self._store) > self._max_size:
            self._store.popitem(last=False)

    def invalidate(self, text: str, model: str) -> None:
        key = self._key(text, model)
        self._store.pop(key, None)

    def clear(self) -> None:
        self._store.clear()

    @property
    def size(self) -> int:
        return len(self._store)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------
class EmbeddingService:
    """Production embedding service with caching, retries, and fallback.

    Obtain the singleton via ``EmbeddingService.get_instance()``.
    """

    _instance: EmbeddingService | None = None

    def __init__(self) -> None:
        self._client: AsyncOpenAI | None = None
        self._cache = _EmbeddingCache()

    # ── Singleton ─────────────────────────────────────────

    @classmethod
    def get_instance(cls) -> EmbeddingService:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """For testing — discard the singleton."""
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

    async def embed(self, text: str) -> list[float]:
        """Return the embedding vector for *text*, using cache when possible.

        Retries transient failures up to ``_MAX_RETRIES`` times with
        exponential backoff.  Raises on permanent failure.
        """
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text")

        text = text.strip()
        model = settings.embedding_model

        # Cache hit
        cached = self._cache.get(text, model)
        if cached is not None:
            logger.debug("embedding_cache_hit", text_len=len(text))
            return cached

        # Call OpenAI with retry
        vector = await self._call_with_retry(text, model)

        self._cache.put(text, model, vector)
        logger.info("embedding_generated", text_len=len(text), dims=len(vector))
        return vector

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts.  Uses cache per-item, batches uncached."""
        if not texts:
            return []

        model = settings.embedding_model
        results: list[list[float] | None] = [None] * len(texts)
        uncached_indices: list[int] = []
        uncached_texts: list[str] = []

        for i, t in enumerate(texts):
            t = t.strip()
            cached = self._cache.get(t, model)
            if cached is not None:
                results[i] = cached
            else:
                uncached_indices.append(i)
                uncached_texts.append(t)

        if uncached_texts:
            vectors = await self._call_batch_with_retry(uncached_texts, model)
            for idx, vec, txt in zip(uncached_indices, vectors, uncached_texts):
                self._cache.put(txt, model, vec)
                results[idx] = vec

        return results  # type: ignore[return-value]

    # ── Utilities ─────────────────────────────────────────

    def invalidate_cache(self, text: str) -> None:
        self._cache.invalidate(text, settings.embedding_model)

    def clear_cache(self) -> None:
        self._cache.clear()

    @property
    def cache_size(self) -> int:
        return self._cache.size

    # ── Internals (retry logic) ───────────────────────────

    async def _call_with_retry(self, text: str, model: str) -> list[float]:
        import asyncio

        last_exc: Exception | None = None
        for attempt in range(_MAX_RETRIES):
            try:
                resp = await self.client.embeddings.create(model=model, input=text)
                return resp.data[0].embedding
            except Exception as exc:
                last_exc = exc
                delay = _RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    "embedding_retry",
                    attempt=attempt + 1,
                    delay=delay,
                    error=str(exc),
                )
                await asyncio.sleep(delay)
        raise RuntimeError(f"Embedding generation failed after {_MAX_RETRIES} retries") from last_exc

    async def _call_batch_with_retry(self, texts: list[str], model: str) -> list[list[float]]:
        import asyncio

        last_exc: Exception | None = None
        for attempt in range(_MAX_RETRIES):
            try:
                resp = await self.client.embeddings.create(model=model, input=texts)
                # API returns embeddings in order matching input
                return [d.embedding for d in sorted(resp.data, key=lambda d: d.index)]
            except Exception as exc:
                last_exc = exc
                delay = _RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    "embedding_batch_retry",
                    attempt=attempt + 1,
                    delay=delay,
                    error=str(exc),
                )
                await asyncio.sleep(delay)
        raise RuntimeError(f"Batch embedding failed after {_MAX_RETRIES} retries") from last_exc
