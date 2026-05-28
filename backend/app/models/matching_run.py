import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, String, Text, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base, UUIDPrimaryKeyMixin


class MatchingRun(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "matching_runs"
    __table_args__ = (
        CheckConstraint("scope IN ('segment', 'all_ready_segments')", name="ck_matching_runs_scope"),
        CheckConstraint(
            "status IN ('pending', 'running', 'completed', 'failed')",
            name="ck_matching_runs_status",
        ),
        ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_matching_runs_tenant_id", ondelete="CASCADE"),
        ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], name="fk_matching_runs_workspace_id", ondelete="CASCADE"),
        Index("ix_matching_runs_workspace_id_id", "workspace_id", "id"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    run_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    scope: Mapped[str] = mapped_column(String, nullable=False)
    target_segment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("segments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    fairness_summary_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    requested_by_supabase_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    requested_by_email: Mapped[str | None] = mapped_column(String, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
