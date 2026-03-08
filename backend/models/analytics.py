"""Ad analytics model — aggregate impression / click counters per ad."""

import uuid

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class AdAnalytics(Base):
    __tablename__ = "ad_analytics"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    ad_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("ads.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    impressions: Mapped[int] = mapped_column(Integer, default=0)
    clicks: Mapped[int] = mapped_column(Integer, default=0)
    ctr: Mapped[float] = mapped_column(Float, default=0.0)

    ad: Mapped["Ad"] = relationship("Ad", back_populates="analytics")  # noqa: F821
