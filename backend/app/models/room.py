from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Room(TimestampMixin, Base):
    __tablename__ = "rooms"
    __table_args__ = (
        UniqueConstraint("segment_key", "room_id", name="uq_rooms_segment_room_id"),
        CheckConstraint("capacity IN (2, 3, 4)", name="ck_rooms_capacity"),
        CheckConstraint("source IN ('uploaded', 'generated')", name="ck_rooms_source"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    room_id: Mapped[str] = mapped_column(String, nullable=False)
    segment_key: Mapped[str] = mapped_column(ForeignKey("segments.segment_key"), nullable=False, index=True)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False, default="uploaded")
