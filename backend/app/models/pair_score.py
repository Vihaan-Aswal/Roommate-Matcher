from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class PairScore(TimestampMixin, Base):
    __tablename__ = "pair_scores"
    __table_args__ = (
        UniqueConstraint("run_id", "segment_key", "student_a", "student_b", name="uq_pair_scores_run_segment_pair"),
        CheckConstraint("pair_score >= 0.0 AND pair_score <= 1.0", name="ck_pair_scores_range"),
        CheckConstraint("student_a <> student_b", name="ck_pair_scores_distinct_students"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("matching_runs.run_id"), nullable=False, index=True)
    segment_key: Mapped[str] = mapped_column(ForeignKey("segments.segment_key"), nullable=False, index=True)
    student_a: Mapped[str] = mapped_column(ForeignKey("students.admission_number"), nullable=False, index=True)
    student_b: Mapped[str] = mapped_column(ForeignKey("students.admission_number"), nullable=False, index=True)
    pair_score: Mapped[float] = mapped_column(Float, nullable=False)
    factor_breakdown_json: Mapped[str] = mapped_column(Text, nullable=False)
