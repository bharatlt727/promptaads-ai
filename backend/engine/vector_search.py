"""Vector search module — query Qdrant and return candidate ads.

Wraps :class:`engine.vector_store.VectorStoreService` with additional
production concerns:
  - Configurable top-K and score thresholds
  - Fallback when Qdrant is unreachable
  - Structured logging of search latency
  - Database verification (active + exists)
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from engine.vector_store import VectorStoreService
from models.ad import Ad, AdStatus

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class SearchCandidate:
    """A single candidate returned from the vector search + DB verification."""

    ad: Ad
    relevance_score: float                      # cosine similarity from Qdrant [0..1]
    qdrant_payload: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class VectorSearchService:
    """Search Qdrant for ad candidates and verify them in PostgreSQL."""

    DEFAULT_TOP_K: int = 10
    MIN_SCORE_THRESHOLD: float = 0.10           # ignore weak / irrelevant matches

    _instance: VectorSearchService | None = None

    def __init__(self) -> None:
        self._vs: VectorStoreService | None = None

    # ── Singleton ─────────────────────────────────────────

    @classmethod
    def get_instance(cls) -> VectorSearchService:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        cls._instance = None

    # ── Lazy VectorStoreService ───────────────────────────

    @property
    def vector_store(self) -> VectorStoreService:
        if self._vs is None:
            self._vs = VectorStoreService()
        return self._vs

    # ── Public API ────────────────────────────────────────

    async def search(
        self,
        query_embedding: list[float],
        db: AsyncSession,
        *,
        top_k: int | None = None,
        min_score: float | None = None,
    ) -> list[SearchCandidate]:
        """Search Qdrant → filter by score → verify in PostgreSQL.

        Returns a list of :class:`SearchCandidate` sorted by descending
        ``relevance_score``, containing only ads that are still ACTIVE in
        the database.

        On Qdrant failure, returns an empty list (fallback).
        """
        top_k = top_k or self.DEFAULT_TOP_K
        min_score = min_score if min_score is not None else self.MIN_SCORE_THRESHOLD

        t0 = time.perf_counter()

        # Step 1 — Qdrant vector search
        try:
            raw_results = self.vector_store.search(
                embedding=query_embedding,
                limit=top_k,
                status_filter="active",
            )
        except Exception:
            logger.error("vector_search_failed", exc_info=True)
            return []

        elapsed_qdrant = (time.perf_counter() - t0) * 1000
        logger.info(
            "vector_search_complete",
            hits=len(raw_results),
            top_k=top_k,
            latency_ms=round(elapsed_qdrant, 2),
        )

        if not raw_results:
            return []

        # Step 2 — Score threshold filter
        filtered = [r for r in raw_results if r.score >= min_score]
        if not filtered:
            logger.info("vector_search_all_below_threshold", threshold=min_score)
            return []

        # Step 3 — Database verification (batch)
        ad_ids = [str(r.id) for r in filtered]
        stmt = select(Ad).where(Ad.id.in_(ad_ids), Ad.status == AdStatus.ACTIVE)
        rows = await db.execute(stmt)
        ads_by_id: dict[str, Ad] = {ad.id: ad for ad in rows.scalars().all()}

        # Step 4 — Build candidates preserving Qdrant score order
        candidates: list[SearchCandidate] = []
        for r in filtered:
            ad = ads_by_id.get(str(r.id))
            if ad is None:
                logger.debug("vector_search_stale_entry", ad_id=str(r.id))
                continue
            candidates.append(
                SearchCandidate(
                    ad=ad,
                    relevance_score=r.score,
                    qdrant_payload=r.payload or {},
                )
            )

        elapsed_total = (time.perf_counter() - t0) * 1000
        logger.info(
            "vector_search_verified",
            candidates=len(candidates),
            total_latency_ms=round(elapsed_total, 2),
        )
        return candidates
