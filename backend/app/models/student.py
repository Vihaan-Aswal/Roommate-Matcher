import uuid
from datetime import date

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, ForeignKeyConstraint, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Student(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "students"
    __table_args__ = (
        UniqueConstraint("workspace_id", "admission_number", name="uq_students_workspace_admission"),
        CheckConstraint("room_size IN (2, 3, 4)", name="ck_students_room_size"),
        ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_students_tenant_id", ondelete="CASCADE"),
        ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], name="fk_students_workspace_id", ondelete="CASCADE"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    segment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("segments.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    admission_number: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    gender: Mapped[str] = mapped_column(String, nullable=False)
    year_group: Mapped[str] = mapped_column(String, nullable=False)
    ac_type: Mapped[str] = mapped_column(String, nullable=False)
    room_size: Mapped[int] = mapped_column(Integer, nullable=False)
    dob: Mapped[date] = mapped_column(Date, nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String, nullable=True)
    phone_last4: Mapped[str] = mapped_column(String(4), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
