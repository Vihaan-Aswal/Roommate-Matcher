import uuid

from sqlalchemy import CheckConstraint, Float, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PairScore(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "pair_scores"
    __table_args__ = (
        UniqueConstraint(
            "matching_run_id", "segment_id", "student_a_id", "student_b_id",
            name="uq_pair_scores_run_segment_pair",
        ),
        CheckConstraint("pair_score >= 0.0 AND pair_score <= 1.0", name="ck_pair_scores_range"),
        CheckConstraint("student_a_id <> student_b_id", name="ck_pair_scores_distinct_students"),
        ForeignKey("tenants.id", name="fk_pair_scores_tenant_id", ondelete="CASCADE"),
        ForeignKey("workspaces.id", name="fk_pair_scores_workspace_id", ondelete="CASCADE"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    matching_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matching_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    segment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("segments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_a_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_b_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pair_score: Mapped[float] = mapped_column(Float, nullable=False)
    factor_breakdown_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
