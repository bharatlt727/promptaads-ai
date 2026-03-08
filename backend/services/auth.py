"""Authentication service — register, login, token creation."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import create_access_token, hash_password, verify_password
from models.user import User


async def register_user(
    db: AsyncSession,
    email: str,
    password: str,
    company_name: str,
) -> User:
    """Create a new advertiser account.

    Raises ValueError if the email is already taken.
    """
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise ValueError("Email already registered")

    user = User(
        email=email,
        hashed_password=hash_password(password),
        company_name=company_name,
    )
    db.add(user)
    await db.flush()
    return user


async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str,
) -> User | None:
    """Verify credentials and return the user, or None."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def create_token(user_id: str) -> str:
    """Issue a JWT for the given user id."""
    return create_access_token(subject=user_id)
