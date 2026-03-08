"""Engine service — top-level orchestrator for the ad matching pipeline.

Combines all engine sub-modules into a single ``match()`` call::

    EmbeddingService  →  VectorSearchService  →  AdRanker  →  AdGenerator

Usage::

    from engine.engine_service import EngineService
    svc = EngineService.get_instance()
    result = await svc.match("best laptop for coding", db)
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from engine.ad_generator import AdGenerator, GeneratedAd
from engine.ad_ranker import AdRanker, RankedAd
from engine.embedding_service import EmbeddingService
from engine.vector_search import VectorSearchService

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Pipeline result
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class MatchResult:
    """Complete result from the ad-matching pipeline."""

    ad_id: str
    title: str
    text: str                                   # LLM-generated sponsored copy
    relevance_score: float
    bid_amount: float
    final_score: float
    rank: int
    from_cache: bool = False
    pipeline_latency_ms: float = 0.0
    debug: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class EngineService:
    """Orchestrate the full ad-matching pipeline.

    1. Embed the user prompt
    2. Vector-search Qdrant for candidates
    3. Rank candidates (relevance × bid)
    4. Rewrite the winning ad via LLM
    """

    _instance: EngineService | None = None

    def __init__(self) -> None:
        self._embedding_svc = EmbeddingService.get_instance()
        self._search_svc = VectorSearchService.get_instance()
        self._ranker = AdRanker()
        self._generator = AdGenerator.get_instance()

    # ── Singleton ─────────────────────────────────────────

    @classmethod
    def get_instance(cls) -> EngineService:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        cls._instance = None

    # ── Public API ────────────────────────────────────────

    async def match(
        self,
        user_prompt: str,
        db: AsyncSession,
        *,
        top_k: int = 10,
        relevance_weight: float = 0.70,
        bid_weight: float = 0.30,
    ) -> MatchResult | None:
        """Run the full matching pipeline and return the best ad.

        Returns ``None`` when no suitable ad can be found.
        """
        t0 = time.perf_counter()
        prompt_snippet = user_prompt[:80]

        logger.info("pipeline_start", prompt=prompt_snippet)

        # ── Step 1: Embed ──────────────────────────────────
        try:
            embedding = await self._embedding_svc.embed(user_prompt)
        except Exception:
            logger.error("pipeline_embed_failed", exc_info=True)
            return None

        # ── Step 2: Vector search ──────────────────────────
        candidates = await self._search_svc.search(
            query_embedding=embedding,
            db=db,
            top_k=top_k,
        )
        if not candidates:
            logger.info("pipeline_no_candidates", prompt=prompt_snippet)
            return None

        # ── Step 3: Rank ───────────────────────────────────
        ranked = self._ranker.rank(
            candidates,
            relevance_weight=relevance_weight,
            bid_weight=bid_weight,
        )
        if not ranked:
            logger.info("pipeline_ranking_empty", prompt=prompt_snippet)
            return None

        winner: RankedAd = ranked[0]
        ad = winner.candidate.ad

        logger.info(
            "pipeline_winner",
            ad_id=ad.id,
            relevance=round(winner.relevance_score, 4),
            bid=ad.bid_amount,
            final=winner.final_score,
        )

        # ── Step 4: Generate contextual copy ───────────────
        generated: GeneratedAd = await self._generator.generate(
            ad_id=ad.id,
            ad_title=ad.title,
            ad_description=ad.description,
            user_prompt=user_prompt,
            product_url=ad.product_url,
            category=ad.category,
            keywords=ad.keywords if ad.keywords else None,
        )

        pipeline_ms = round((time.perf_counter() - t0) * 1000, 2)

        logger.info(
            "pipeline_complete",
            ad_id=ad.id,
            latency_ms=pipeline_ms,
            from_cache=generated.from_cache,
        )

        return MatchResult(
            ad_id=ad.id,
            title=generated.title,
            text=generated.text,
            relevance_score=round(winner.relevance_score, 4),
            bid_amount=ad.bid_amount,
            final_score=winner.final_score,
            rank=winner.rank,
            from_cache=generated.from_cache,
            pipeline_latency_ms=pipeline_ms,
            debug={
                "total_candidates": len(candidates),
                "ranked_candidates": len(ranked),
                "embedding_cache_size": self._embedding_svc.cache_size,
            },
        )

    async def match_top_n(
        self,
        user_prompt: str,
        db: AsyncSession,
        *,
        n: int = 3,
        top_k: int = 10,
        relevance_weight: float = 0.70,
        bid_weight: float = 0.30,
    ) -> list[MatchResult]:
        """Return the top *n* matching ads, each with generated copy."""
        t0 = time.perf_counter()

        try:
            embedding = await self._embedding_svc.embed(user_prompt)
        except Exception:
            logger.error("pipeline_embed_failed", exc_info=True)
            return []

        candidates = await self._search_svc.search(
            query_embedding=embedding,
            db=db,
            top_k=top_k,
        )
        if not candidates:
            return []

        ranked = self._ranker.rank(
            candidates,
            relevance_weight=relevance_weight,
            bid_weight=bid_weight,
        )
        if not ranked:
            return []

        results: list[MatchResult] = []
        for item in ranked[:n]:
            ad = item.candidate.ad
            generated = await self._generator.generate(
                ad_id=ad.id,
                ad_title=ad.title,
                ad_description=ad.description,
                user_prompt=user_prompt,
                product_url=ad.product_url,
                category=ad.category,
                keywords=ad.keywords if ad.keywords else None,
            )
            results.append(
                MatchResult(
                    ad_id=ad.id,
                    title=generated.title,
                    text=generated.text,
                    relevance_score=round(item.relevance_score, 4),
                    bid_amount=ad.bid_amount,
                    final_score=item.final_score,
                    rank=item.rank,
                    from_cache=generated.from_cache,
                )
            )

        pipeline_ms = round((time.perf_counter() - t0) * 1000, 2)
        logger.info("pipeline_top_n_complete", n=len(results), latency_ms=pipeline_ms)
        for r in results:
            r.pipeline_latency_ms = pipeline_ms
        return results
