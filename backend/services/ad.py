"""Ad CRUD service — create, list, update, delete with Qdrant indexing."""

from __future__ import annotations

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from engine.embedding_service import EmbeddingService
from engine.matcher import get_ad_embedding_text
from engine.vector_store import VectorStoreService
from models.ad import Ad
from models.analytics import AdAnalytics
from schemas.ad import AdCreate, AdUpdate

logger = structlog.get_logger()

_vs: VectorStoreService | None = None


def _get_vs() -> VectorStoreService:
    global _vs
    if _vs is None:
        _vs = VectorStoreService()
    return _vs


async def _index_ad(ad: Ad) -> None:
    """Generate embedding and upsert into Qdrant (best-effort)."""
    try:
        text = get_ad_embedding_text(ad)
        embedding = await EmbeddingService.get_instance().embed(text)
        _get_vs().upsert(
            ad_id=ad.id,
            embedding=embedding,
            payload={
                "title": ad.title,
                "category": ad.category,
                "keywords": ad.keywords,
                "status": ad.status.value if hasattr(ad.status, "value") else ad.status,
                "advertiser_id": ad.advertiser_id,
            },
        )
        logger.info("ad_indexed", ad_id=ad.id)
    except Exception:
        logger.warning("ad_indexing_failed", ad_id=ad.id, exc_info=True)


# ── CRUD ─────────────────────────────────────────────────────


async def create_ad(db: AsyncSession, advertiser_id: str, data: AdCreate) -> Ad:
    ad = Ad(
        advertiser_id=advertiser_id,
        title=data.title,
        description=data.description,
        product_url=data.product_url,
        category=data.category,
        keywords=data.keywords,
        bid_amount=data.bid_amount,
        status=data.status,
    )
    db.add(ad)
    await db.flush()

    # Create analytics record with zero counters
    analytics = AdAnalytics(ad_id=ad.id)
    db.add(analytics)
    await db.flush()

    # Index in Qdrant (best-effort)
    await _index_ad(ad)
    return ad


async def list_ads(db: AsyncSession, advertiser_id: str) -> list[Ad]:
    result = await db.execute(
        select(Ad)
        .where(Ad.advertiser_id == advertiser_id)
        .order_by(Ad.created_at.desc())
    )
    return list(result.scalars().all())


async def update_ad(
    db: AsyncSession,
    ad_id: str,
    advertiser_id: str,
    data: AdUpdate,
) -> Ad | None:
    result = await db.execute(
        select(Ad).where(Ad.id == ad_id, Ad.advertiser_id == advertiser_id)
    )
    ad = result.scalar_one_or_none()
    if not ad:
        return None

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(ad, key, value)
    await db.flush()

    # Re-index in Qdrant
    await _index_ad(ad)
    return ad


async def delete_ad(db: AsyncSession, ad_id: str, advertiser_id: str) -> bool:
    result = await db.execute(
        select(Ad).where(Ad.id == ad_id, Ad.advertiser_id == advertiser_id)
    )
    ad = result.scalar_one_or_none()
    if not ad:
        return False

    # Remove from Qdrant (best-effort)
    try:
        _get_vs().delete(ad.id)
    except Exception:
        logger.warning("qdrant_delete_failed", ad_id=ad.id, exc_info=True)

    await db.delete(ad)
    await db.flush()
    return True
