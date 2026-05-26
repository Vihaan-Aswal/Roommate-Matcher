import uuid

from sqlalchemy import CheckConstraint, ForeignKey, ForeignKeyConstraint, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Segment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "segments"
    __table_args__ = (
        UniqueConstraint("workspace_id", "segment_key", name="uq_segments_workspace_segment_key"),
        UniqueConstraint("workspace_id", "gender", "year_group", "ac_type", "room_size", name="uq_segments_workspace_dimensions"),
        CheckConstraint("room_size IN (2, 3, 4)", name="ck_segments_room_size"),
        ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_segments_tenant_id", ondelete="CASCADE"),
        ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], name="fk_segments_workspace_id", ondelete="CASCADE"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    segment_key: Mapped[str] = mapped_column(String, nullable=False)
    gender: Mapped[str] = mapped_column(String, nullable=False)
    year_group: Mapped[str] = mapped_column(String, nullable=False)
    ac_type: Mapped[str] = mapped_column(String, nullable=False)
    room_size: Mapped[int] = mapped_column(Integer, nullable=False)
