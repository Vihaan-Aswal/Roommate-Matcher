import uuid

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, ForeignKeyConstraint, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Room(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "rooms"
    __table_args__ = (
        UniqueConstraint("workspace_id", "segment_id", "room_id", name="uq_rooms_workspace_segment_room"),
        CheckConstraint("capacity IN (2, 3, 4)", name="ck_rooms_capacity"),
        CheckConstraint("source IN ('uploaded', 'generated')", name="ck_rooms_source"),
        ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_rooms_tenant_id", ondelete="CASCADE"),
        ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], name="fk_rooms_workspace_id", ondelete="CASCADE"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    segment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("segments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    room_id: Mapped[str] = mapped_column(String, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False, server_default="'uploaded'")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

