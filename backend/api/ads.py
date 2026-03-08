"""Ad CRUD routes — create, list, update, delete."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user
from db.session import get_db
from models.user import User
from schemas.ad import AdCreate, AdResponse, AdUpdate
from services import ad as ad_service

router = APIRouter()


@router.post("/create", response_model=AdResponse)
async def create_ad(
    body: AdCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new ad and index it in the vector store."""
    ad = await ad_service.create_ad(db, user.id, body)
    return ad


@router.get("/list", response_model=list[AdResponse])
async def list_ads(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all ads belonging to the authenticated advertiser."""
    return await ad_service.list_ads(db, user.id)


@router.put("/update/{ad_id}", response_model=AdResponse)
async def update_ad(
    ad_id: str,
    body: AdUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an ad and re-index its embedding."""
    ad = await ad_service.update_ad(db, ad_id, user.id, body)
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    return ad


@router.delete("/delete/{ad_id}")
async def delete_ad(
    ad_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an ad and remove its embedding from the vector store."""
    success = await ad_service.delete_ad(db, ad_id, user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Ad not found")
    return {"detail": "Ad deleted successfully"}
