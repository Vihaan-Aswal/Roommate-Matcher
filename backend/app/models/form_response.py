import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base, UUIDPrimaryKeyMixin


class FormResponse(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "form_responses"
    __table_args__ = (
        CheckConstraint(
            "validation_status IN ('valid', 'invalid')", name="ck_form_responses_status"
        ),
        Index(
            "ix_form_responses_workspace_admission_submitted",
            "workspace_id", "submitted_admission_number", "submitted_at",
        ),
        ForeignKey("tenants.id", name="fk_form_responses_tenant_id", ondelete="CASCADE"),
        ForeignKey("workspaces.id", name="fk_form_responses_workspace_id", ondelete="CASCADE"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True
    )
    submitted_admission_number: Mapped[str] = mapped_column(String, nullable=False)
    submitted_phone_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    validation_status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    invalid_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Raw answers — preserved exactly
    q1_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    q2_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    q3_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    q4a_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    q4b_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    q5a_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    q5b_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    q6_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    q7_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    q8_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    q9_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    q10_raw: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
