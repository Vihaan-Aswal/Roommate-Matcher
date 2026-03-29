from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class FormResponse(Base):
    __tablename__ = "form_responses"
    __table_args__ = (CheckConstraint("validation_status IN ('valid', 'invalid')", name="ck_form_responses_status"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    admission_number: Mapped[str] = mapped_column(ForeignKey("students.admission_number"), nullable=False, index=True)
    dob: Mapped[date] = mapped_column(Date, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    validation_status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    invalid_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

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

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
