from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Student(TimestampMixin, Base):
    __tablename__ = "students"
    __table_args__ = (CheckConstraint("room_size IN (2, 3, 4)", name="ck_students_room_size"),)

    admission_number: Mapped[str] = mapped_column(String, primary_key=True)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    gender: Mapped[str] = mapped_column(String, nullable=False)
    year_group: Mapped[str] = mapped_column(String, nullable=False)
    ac_type: Mapped[str] = mapped_column(String, nullable=False)
    room_size: Mapped[int] = mapped_column(Integer, nullable=False)
    dob: Mapped[date] = mapped_column(Date, nullable=False)
    segment_key: Mapped[str] = mapped_column(ForeignKey("segments.segment_key"), nullable=False, index=True)
