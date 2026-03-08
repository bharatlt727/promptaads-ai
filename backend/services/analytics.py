"""Analytics service — record impressions and clicks, compute CTR."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.ad import Ad
from models.analytics import AdAnalytics


async def _get_or_create(db: AsyncSession, ad_id: str) -> AdAnalytics | None:
    """Return the analytics row for the ad, or None if the ad doesn't exist."""
    # Verify the ad exists
    result = await db.execute(select(Ad).where(Ad.id == ad_id))
    if not result.scalar_one_or_none():
        return None

    result = await db.execute(
        select(AdAnalytics).where(AdAnalytics.ad_id == ad_id)
    )
    analytics = result.scalar_one_or_none()
    if not analytics:
        analytics = AdAnalytics(ad_id=ad_id)
        db.add(analytics)
        await db.flush()
    return analytics


def _recalculate_ctr(analytics: AdAnalytics) -> None:
    if analytics.impressions > 0:
        analytics.ctr = round(analytics.clicks / analytics.impressions, 6)
    else:
        analytics.ctr = 0.0


async def record_impression(db: AsyncSession, ad_id: str) -> AdAnalytics | None:
    """Increment the impression counter for an ad and recalculate CTR."""
    analytics = await _get_or_create(db, ad_id)
    if not analytics:
        return None

    analytics.impressions += 1
    _recalculate_ctr(analytics)
    await db.flush()
    return analytics


async def record_click(db: AsyncSession, ad_id: str) -> AdAnalytics | None:
    """Increment the click counter for an ad and recalculate CTR."""
    analytics = await _get_or_create(db, ad_id)
    if not analytics:
        return None

    analytics.clicks += 1
    _recalculate_ctr(analytics)
    await db.flush()
    return analytics
