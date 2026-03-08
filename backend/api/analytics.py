"""Analytics routes — record impressions and clicks."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from schemas.analytics import AnalyticsEvent, AnalyticsResponse
from services import analytics as analytics_service

router = APIRouter()


@router.post("/impression", response_model=AnalyticsResponse)
async def record_impression(
    body: AnalyticsEvent,
    db: AsyncSession = Depends(get_db),
):
    """Increment the impression counter for an ad."""
    result = await analytics_service.record_impression(db, body.ad_id)
    if not result:
        raise HTTPException(status_code=404, detail="Ad not found")
    return result


@router.post("/click", response_model=AnalyticsResponse)
async def record_click(
    body: AnalyticsEvent,
    db: AsyncSession = Depends(get_db),
):
    """Increment the click counter for an ad."""
    result = await analytics_service.record_click(db, body.ad_id)
    if not result:
        raise HTTPException(status_code=404, detail="Ad not found")
    return result
