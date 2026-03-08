"""Schemas for authentication endpoints."""

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    """Advertiser registration payload."""
    email: EmailStr
    password: str
    company_name: str


class LoginRequest(BaseModel):
    """Login payload (same for all roles)."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT token returned after register / login."""
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Public-facing user representation."""
    id: str
    email: str
    company_name: str
    is_active: bool

    model_config = {"from_attributes": True}
