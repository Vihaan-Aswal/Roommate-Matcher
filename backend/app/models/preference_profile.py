import uuid

from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, ForeignKeyConstraint, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import text

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PreferenceProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "preference_profiles"
    __table_args__ = (
        # Postgres partial unique index — replaces the old sqlite_where version
        Index(
            "ux_preference_profiles_one_active",
            "student_id",
            unique=True,
            postgresql_where=text("is_active = true"),
            sqlite_where=text("is_active = 1"),
        ),
        ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_preference_profiles_tenant_id", ondelete="CASCADE"),
        ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], name="fk_preference_profiles_workspace_id", ondelete="CASCADE"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_form_response_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("form_responses.id", ondelete="SET NULL"), nullable=True
    )

    has_preferences: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    is_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    # Raw answers
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

    # Encoded answers
    q1_enc: Mapped[float | None] = mapped_column(Float, nullable=True)
    q2_enc: Mapped[float | None] = mapped_column(Float, nullable=True)
    q3_enc: Mapped[float | None] = mapped_column(Float, nullable=True)
    q4a_enc: Mapped[float | None] = mapped_column(Float, nullable=True)
    q4b_enc: Mapped[float | None] = mapped_column(Float, nullable=True)
    q5a_enc: Mapped[float | None] = mapped_column(Float, nullable=True)
    q5b_enc: Mapped[float | None] = mapped_column(Float, nullable=True)
    q6_enc: Mapped[float | None] = mapped_column(Float, nullable=True)
    q7_enc: Mapped[float | None] = mapped_column(Float, nullable=True)
    q8_enc: Mapped[float | None] = mapped_column(Float, nullable=True)
    q9_enc: Mapped[float | None] = mapped_column(Float, nullable=True)
    q10_enc: Mapped[float | None] = mapped_column(Float, nullable=True)
