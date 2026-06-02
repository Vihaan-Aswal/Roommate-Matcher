"""Cascade delete on Student.segment_id

Revision ID: e26a92a336a7
Revises: e26a92a336a6
Create Date: 2026-06-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e26a92a336a7'
down_revision: Union[str, None] = '59c3bb185e91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('students_segment_id_fkey', 'students', type_='foreignkey')
    op.create_foreign_key('students_segment_id_fkey', 'students', 'segments', ['segment_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    op.drop_constraint('students_segment_id_fkey', 'students', type_='foreignkey')
    op.create_foreign_key('students_segment_id_fkey', 'students', 'segments', ['segment_id'], ['id'], ondelete='RESTRICT')
