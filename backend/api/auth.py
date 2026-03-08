"""Authentication routes — register and login."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from services.auth import authenticate_user, create_token, register_user

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register a new advertiser account and return a JWT."""
    try:
        user = await register_user(db, body.email, body.password, body.company_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    token = create_token(user.id)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate an advertiser and return a JWT."""
    user = await authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user.id)
    return TokenResponse(access_token=token)
