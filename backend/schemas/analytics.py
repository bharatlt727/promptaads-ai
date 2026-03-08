"""Schemas for analytics endpoints."""

from pydantic import BaseModel


class AnalyticsEvent(BaseModel):
    """Body for POST /analytics/impression and /analytics/click."""
    ad_id: str


class AnalyticsResponse(BaseModel):
    """Current analytics counters for an ad."""
    ad_id: str
    impressions: int
    clicks: int
    ctr: float

    model_config = {"from_attributes": True}
