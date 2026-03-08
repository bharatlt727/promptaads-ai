"""Ad model — represents a single advertisement."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class AdStatus(str, enum.Enum):
    """Possible states of an ad."""
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class Ad(Base):
    __tablename__ = "ads"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    advertiser_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    product_url: Mapped[str] = mapped_column(String(512), nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True, default=None)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="general")
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    bid_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.01)
    status: Mapped[AdStatus] = mapped_column(
        Enum(AdStatus, values_callable=lambda e: [x.value for x in e]),
        default=AdStatus.DRAFT,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # One-to-one: each ad has exactly one analytics record
    analytics: Mapped["AdAnalytics"] = relationship(  # noqa: F821
        "AdAnalytics", back_populates="ad", uselist=False, cascade="all, delete-orphan"
    )
