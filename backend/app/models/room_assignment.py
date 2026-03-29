from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class RoomAssignment(TimestampMixin, Base):
    __tablename__ = "room_assignments"
    __table_args__ = (
        UniqueConstraint("run_id", "segment_key", "room_id", name="uq_room_assignments_run_segment_room"),
        CheckConstraint("group_score >= 0.0 AND group_score <= 1.0", name="ck_room_assignments_group_score_range"),
        CheckConstraint("needs_review IN (0, 1)", name="ck_room_assignments_needs_review"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("matching_runs.run_id"), nullable=False, index=True)
    segment_key: Mapped[str] = mapped_column(ForeignKey("segments.segment_key"), nullable=False, index=True)
    room_id: Mapped[str] = mapped_column(String, nullable=False)
    room_label: Mapped[str | None] = mapped_column(String, nullable=True)
    assigned_students_json: Mapped[str] = mapped_column(Text, nullable=False)
    group_score: Mapped[float] = mapped_column(Float, nullable=False)
    satisfaction_summary_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    needs_review: Mapped[bool] = mapped_column(Integer, nullable=False, default=0)
