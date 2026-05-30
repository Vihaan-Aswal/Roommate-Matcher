"""enable_rls_alembic_version

Revision ID: 66d537ba5fdf
Revises: 712aa19360fd
Create Date: 2026-05-29 05:29:21.477382

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '66d537ba5fdf'
down_revision: Union[str, None] = '712aa19360fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE alembic_version ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    op.execute("ALTER TABLE alembic_version DISABLE ROW LEVEL SECURITY;")
