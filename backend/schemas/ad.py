"""Schemas for ad CRUD endpoints."""

from datetime import datetime

from pydantic import BaseModel

from models.ad import AdStatus


class AdCreate(BaseModel):
    """Payload accepted by POST /ads/create."""
    title: str
    description: str
    product_url: str
    category: str = "general"
    keywords: list[str] = []
    bid_amount: float = 0.01
    status: AdStatus = AdStatus.DRAFT


class AdUpdate(BaseModel):
    """Partial-update payload for PUT /ads/update/{ad_id}."""
    title: str | None = None
    description: str | None = None
    product_url: str | None = None
    category: str | None = None
    keywords: list[str] | None = None
    bid_amount: float | None = None
    status: AdStatus | None = None


class AdResponse(BaseModel):
    """Ad representation returned to clients."""
    id: str
    advertiser_id: str
    title: str
    description: str
    product_url: str
    category: str
    keywords: list[str]
    bid_amount: float
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
