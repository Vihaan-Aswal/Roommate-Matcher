from sqlalchemy import CheckConstraint, Float, ForeignKey, Index, Integer, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class PreferenceProfile(TimestampMixin, Base):
    __tablename__ = "preference_profiles"
    __table_args__ = (
        CheckConstraint("has_preferences IN (0, 1)", name="ck_preference_profiles_has_preferences"),
        CheckConstraint("is_active IN (0, 1)", name="ck_preference_profiles_is_active"),
        Index(
            "ux_preference_profiles_one_active",
            "admission_number",
            unique=True,
            sqlite_where=text("is_active = 1"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    admission_number: Mapped[str] = mapped_column(ForeignKey("students.admission_number"), nullable=False, index=True)
    source_form_response_id: Mapped[int | None] = mapped_column(ForeignKey("form_responses.id"), nullable=True)

    has_preferences: Mapped[bool] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Integer, nullable=False, default=1)

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
