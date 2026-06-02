"""Unique constraint on TenantMembership

Revision ID: e26a92a336a8
Revises: e26a92a336a7
Create Date: 2026-06-03 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e26a92a336a8'
down_revision: Union[str, None] = 'e26a92a336a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check for duplicates before creating the constraint
    conn = op.get_bind()
    res = conn.execute(sa.text("SELECT tenant_id, supabase_user_id, count(*) FROM tenant_memberships GROUP BY tenant_id, supabase_user_id HAVING count(*) > 1"))
    duplicates = res.fetchall()
    if duplicates:
        raise ValueError(f"Cannot apply unique constraint uq_tenant_membership_tenant_user: found duplicate memberships {duplicates}")
        
    op.create_unique_constraint('uq_tenant_membership_tenant_user', 'tenant_memberships', ['tenant_id', 'supabase_user_id'])


def downgrade() -> None:
    op.drop_constraint('uq_tenant_membership_tenant_user', 'tenant_memberships', type_='unique')
