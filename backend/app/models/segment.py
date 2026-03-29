from sqlalchemy import CheckConstraint, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Segment(TimestampMixin, Base):
    __tablename__ = "segments"
    __table_args__ = (
        UniqueConstraint("gender", "year_group", "ac_type", "room_size", name="uq_segments_dimensions"),
        CheckConstraint("room_size IN (2, 3, 4)", name="ck_segments_room_size"),
    )

    segment_key: Mapped[str] = mapped_column(String, primary_key=True)
    gender: Mapped[str] = mapped_column(String, nullable=False)
    year_group: Mapped[str] = mapped_column(String, nullable=False)
    ac_type: Mapped[str] = mapped_column(String, nullable=False)
    room_size: Mapped[int] = mapped_column(Integer, nullable=False)
