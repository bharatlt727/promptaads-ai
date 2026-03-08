"""Ad matching — legacy helper functions + simplified entry-point.

The full pipeline lives in :mod:`engine.engine_service`.  This module
keeps backward-compatible helpers used by ``services/ad.py`` for
indexing operations.
"""

from __future__ import annotations

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from engine.embedding_service import EmbeddingService
from engine.engine_service import EngineService
from models.ad import Ad

logger = structlog.get_logger()


# ── Helpers (used by services/ad.py for indexing) ─────────────


def get_ad_embedding_text(ad: Ad) -> str:
    """Build a text representation of an ad for embedding generation."""
    parts = [ad.title, ad.description]
    if ad.keywords:
        parts.append(" ".join(ad.keywords))
    if ad.category:
        parts.append(ad.category)
    return " | ".join(parts)


async def generate_embedding(text: str) -> list[float]:
    """Generate an embedding vector via the EmbeddingService (cached)."""
    svc = EmbeddingService.get_instance()
    return await svc.embed(text)


# ── Simplified entry-point (delegates to EngineService) ───────


async def match_ad(user_prompt: str, db: AsyncSession) -> dict | None:
    """Match a user prompt to the best active ad.

    Delegates to :class:`engine.engine_service.EngineService` which runs
    the full pipeline: embed → search → rank → generate.

    Returns a dict with ``ad_id``, ``title``, ``text``, ``relevance_score``,
    ``bid_amount``, ``final_score``, or ``None`` if nothing matches.
    """
    svc = EngineService.get_instance()
    result = await svc.match(user_prompt, db)
    if result is None:
        return None
    return {
        "ad_id": result.ad_id,
        "title": result.title,
        "text": result.text,
        "relevance_score": result.relevance_score,
        "bid_amount": result.bid_amount,
        "final_score": result.final_score,
    }
