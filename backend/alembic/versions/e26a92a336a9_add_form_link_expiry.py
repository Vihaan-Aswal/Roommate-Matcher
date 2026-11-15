"""add form link expiry

Revision ID: e26a92a336a9
Revises: e26a92a336a8
Create Date: 2026-11-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e26a92a336a9"
down_revision: Union[str, None] = "e26a92a336a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "workspace_form_links",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Existing links get a fresh 30-day window instead of becoming invalid on deploy.
    op.execute(
        "UPDATE workspace_form_links "
        "SET expires_at = now() + interval '30 days' "
        "WHERE expires_at IS NULL"
    )
    op.alter_column("workspace_form_links", "expires_at", nullable=False)


def downgrade() -> None:
    op.drop_column("workspace_form_links", "expires_at")
