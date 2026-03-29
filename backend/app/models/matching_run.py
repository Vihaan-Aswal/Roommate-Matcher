from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class MatchingRun(Base):
    __tablename__ = "matching_runs"
    __table_args__ = (
        CheckConstraint("scope IN ('segment', 'all_ready_segments')", name="ck_matching_runs_scope"),
        CheckConstraint("status IN ('pending', 'running', 'completed', 'failed')", name="ck_matching_runs_status"),
    )

    run_id: Mapped[str] = mapped_column(String, primary_key=True)
    scope: Mapped[str] = mapped_column(String, nullable=False)
    target_segment_key: Mapped[str | None] = mapped_column(ForeignKey("segments.segment_key"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
