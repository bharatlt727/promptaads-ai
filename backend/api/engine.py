"""Ad matching engine routes.

POST /engine/match-ad   — return the single best ad
POST /engine/match-ads  — return top-N ads
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from engine.engine_service import EngineService
from schemas.engine import (
    MatchMultiRequest,
    MatchMultiResponse,
    MatchRequest,
    MatchResponse,
)

logger = structlog.get_logger()
router = APIRouter()


@router.post("/match-ad", response_model=MatchResponse)
async def match_ad_endpoint(
    body: MatchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Match a user prompt to the most relevant active ad.

    Pipeline: embed prompt → Qdrant search → rank (relevance × bid) → LLM rewrite.
    """
    svc = EngineService.get_instance()
    result = await svc.match(
        body.user_prompt,
        db,
        top_k=body.top_k,
        relevance_weight=body.relevance_weight,
        bid_weight=body.bid_weight,
    )
    if not result:
        raise HTTPException(status_code=404, detail="No matching ad found")
    return MatchResponse(
        ad_id=result.ad_id,
        title=result.title,
        text=result.text,
        relevance_score=result.relevance_score,
        bid_amount=result.bid_amount,
        final_score=result.final_score,
    )


@router.post("/match-ads", response_model=MatchMultiResponse)
async def match_ads_endpoint(
    body: MatchMultiRequest,
    db: AsyncSession = Depends(get_db),
):
    """Return the top-N matching ads for a user prompt."""
    svc = EngineService.get_instance()
    results = await svc.match_top_n(
        body.user_prompt,
        db,
        n=body.n,
        top_k=body.top_k,
        relevance_weight=body.relevance_weight,
        bid_weight=body.bid_weight,
    )
    if not results:
        raise HTTPException(status_code=404, detail="No matching ads found")
    return MatchMultiResponse(
        ads=[
            MatchResponse(
                ad_id=r.ad_id,
                title=r.title,
                text=r.text,
                relevance_score=r.relevance_score,
                bid_amount=r.bid_amount,
                final_score=r.final_score,
            )
            for r in results
        ],
        total_candidates=results[0].debug.get("total_candidates", 0) if results else 0,
        pipeline_latency_ms=results[0].pipeline_latency_ms if results else 0.0,
    )
