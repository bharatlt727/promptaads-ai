"""
PromptAds AI — Python SDK Client

Zero-dependency client using only the Python standard library.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from typing import Any, Optional


# ── Data classes ─────────────────────────────────────────────────────────


@dataclass
class Ad:
    """A single contextual ad returned by the matching engine."""

    ad_id: str
    title: str
    text: str
    relevance_score: float
    bid_amount: float
    final_score: float

    def __str__(self) -> str:
        return f"[Sponsored] {self.title}\n{self.text}"

    def to_markdown(self) -> str:
        return f"**[Sponsored]** {self.title}\n\n{self.text}"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class MatchMultiResult:
    """Result of a multi-ad match request."""

    ads: list[Ad]
    total_candidates: int
    pipeline_latency_ms: float


# ── Errors ───────────────────────────────────────────────────────────────


class PromptAdsError(Exception):
    """Raised when the PromptAds API returns an error."""

    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


# ── Client ───────────────────────────────────────────────────────────────


class PromptAdsClient:
    """
    PromptAds AI API client.

    Args:
        base_url: API server URL (default: ``PROMPTADS_BASE_URL`` env var or ``http://localhost:8000``).
        api_key:  Optional API key (default: ``PROMPTADS_API_KEY`` env var).
        timeout:  Request timeout in seconds (default: ``10``).

    Example::

        client = PromptAdsClient(base_url="https://api.promptads.ai")
        ad = client.get_ad("best coding laptop")
        print(ad)
    """

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: int = 10,
    ) -> None:
        self.base_url = (
            base_url or os.getenv("PROMPTADS_BASE_URL", "http://localhost:8000")
        ).rstrip("/")
        self.api_key = api_key or os.getenv("PROMPTADS_API_KEY")
        self.timeout = timeout

    # ── Private helpers ──────────────────────────────────────────────────

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _request(self, path: str, body: dict[str, Any]) -> Any:
        """Send a JSON POST request and return parsed JSON."""
        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            headers=self._headers(),
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            try:
                detail = json.loads(exc.read().decode("utf-8")).get("detail", str(exc))
            except Exception:
                detail = str(exc)
            raise PromptAdsError(
                f"PromptAds API Error ({exc.code}): {detail}", status=exc.code
            ) from exc
        except urllib.error.URLError as exc:
            raise PromptAdsError(f"Connection error: {exc.reason}") from exc

    # ── Public API ───────────────────────────────────────────────────────

    def get_ad(
        self,
        prompt: str,
        *,
        top_k: int = 10,
        relevance_weight: float = 0.70,
        bid_weight: float = 0.30,
    ) -> Ad:
        """
        Get the single best contextual ad for a prompt.

        Args:
            prompt: The user prompt or query to match against.
            top_k: Number of candidate ads to consider (default: 10).
            relevance_weight: Weight for semantic relevance (0-1, default: 0.70).
            bid_weight: Weight for bid amount (0-1, default: 0.30).

        Returns:
            The highest-scoring :class:`Ad`.
        """
        result = self._request(
            "/engine/match-ad",
            {
                "user_prompt": prompt,
                "top_k": top_k,
                "relevance_weight": relevance_weight,
                "bid_weight": bid_weight,
            },
        )
        return Ad(**result)

    def get_ads(
        self,
        prompt: str,
        *,
        n: int = 3,
        top_k: int = 10,
        relevance_weight: float = 0.70,
        bid_weight: float = 0.30,
    ) -> MatchMultiResult:
        """
        Get multiple contextual ads for a prompt.

        Args:
            prompt: The user prompt or query to match against.
            n: Number of ads to return (default: 3).
            top_k: Number of candidate ads to consider (default: 10).
            relevance_weight: Weight for semantic relevance (0-1, default: 0.70).
            bid_weight: Weight for bid amount (0-1, default: 0.30).

        Returns:
            A :class:`MatchMultiResult` containing the matched ads.
        """
        result = self._request(
            "/engine/match-ads",
            {
                "user_prompt": prompt,
                "n": n,
                "top_k": top_k,
                "relevance_weight": relevance_weight,
                "bid_weight": bid_weight,
            },
        )
        return MatchMultiResult(
            ads=[Ad(**ad) for ad in result["ads"]],
            total_candidates=result["total_candidates"],
            pipeline_latency_ms=result["pipeline_latency_ms"],
        )

    def track_impression(self, ad_id: str) -> None:
        """Track an ad impression event."""
        self._request("/analytics/impression", {"ad_id": ad_id})

    def track_click(self, ad_id: str) -> None:
        """Track an ad click event."""
        self._request("/analytics/click", {"ad_id": ad_id})


# ── Module-level convenience API ────────────────────────────────────────

_default_client: PromptAdsClient | None = None


def configure(
    base_url: str | None = None,
    api_key: str | None = None,
    timeout: int = 10,
) -> None:
    """
    Configure the default client used by :func:`get_ad` and :func:`get_ads`.

    Call once at startup::

        import promptads_ai
        promptads_ai.configure(base_url="https://api.promptads.ai", api_key="pk_live_xxx")
    """
    global _default_client
    _default_client = PromptAdsClient(
        base_url=base_url, api_key=api_key, timeout=timeout
    )


def _client() -> PromptAdsClient:
    global _default_client
    if _default_client is None:
        _default_client = PromptAdsClient()
    return _default_client


def get_ad(prompt: str, **kwargs: Any) -> Ad:
    """
    Get the single best contextual ad for a prompt.

    Convenience wrapper — uses a default client auto-configured from
    environment variables. Call :func:`configure` first for custom settings.

    Example::

        from promptads_ai import get_ad

        ad = get_ad("best coding laptop")
        print(ad)
    """
    return _client().get_ad(prompt, **kwargs)


def get_ads(prompt: str, **kwargs: Any) -> MatchMultiResult:
    """
    Get multiple contextual ads for a prompt.

    Example::

        from promptads_ai import get_ads

        result = get_ads("best coding laptop", n=3)
        for ad in result.ads:
            print(ad.title)
    """
    return _client().get_ads(prompt, **kwargs)


def track_impression(ad_id: str) -> None:
    """Track an ad impression event."""
    _client().track_impression(ad_id)


def track_click(ad_id: str) -> None:
    """Track an ad click event."""
    _client().track_click(ad_id)
