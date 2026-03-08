"""Schemas for the ad matching engine endpoint."""

from __future__ import annotations

from pydantic import BaseModel, Field


class MatchRequest(BaseModel):
    """Input for POST /engine/match-ad."""
    user_prompt: str = Field(..., min_length=1, max_length=1000)
    top_k: int = Field(default=10, ge=1, le=50)
    relevance_weight: float = Field(default=0.70, ge=0.0, le=1.0)
    bid_weight: float = Field(default=0.30, ge=0.0, le=1.0)


class MatchResponse(BaseModel):
    """Single matched ad returned by the engine."""
    ad_id: str
    title: str
    text: str
    relevance_score: float
    bid_amount: float
    final_score: float


class MatchMultiRequest(BaseModel):
    """Input for POST /engine/match-ads (multi)."""
    user_prompt: str = Field(..., min_length=1, max_length=1000)
    n: int = Field(default=3, ge=1, le=10)
    top_k: int = Field(default=10, ge=1, le=50)
    relevance_weight: float = Field(default=0.70, ge=0.0, le=1.0)
    bid_weight: float = Field(default=0.30, ge=0.0, le=1.0)


class MatchMultiResponse(BaseModel):
    """Multiple matched ads."""
    ads: list[MatchResponse]
    total_candidates: int = 0
    pipeline_latency_ms: float = 0.0
