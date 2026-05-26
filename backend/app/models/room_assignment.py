import uuid

from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, ForeignKeyConstraint, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class RoomAssignment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "room_assignments"
    __table_args__ = (
        UniqueConstraint(
            "matching_run_id", "segment_id", "room_id",
            name="uq_room_assignments_run_segment_room",
        ),
        CheckConstraint(
            "group_score >= 0.0 AND group_score <= 1.0",
            name="ck_room_assignments_group_score_range",
        ),
        ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_room_assignments_tenant_id", ondelete="CASCADE"),
        ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], name="fk_room_assignments_workspace_id", ondelete="CASCADE"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    matching_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matching_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    segment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("segments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    room_id: Mapped[str] = mapped_column(String, nullable=False)
    room_label: Mapped[str | None] = mapped_column(String, nullable=True)
    assigned_students_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    group_score: Mapped[float] = mapped_column(Float, nullable=False)
    satisfaction_summary_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    needs_review: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
