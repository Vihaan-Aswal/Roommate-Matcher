"""enable_rls

Revision ID: 712aa19360fd
Revises: e26a92a336a6
Create Date: 2026-05-29 05:04:45.154259

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '712aa19360fd'
down_revision: Union[str, None] = 'e26a92a336a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables = [
        "tenants", "workspaces", "tenant_memberships", "segments", 
        "students", "rooms", "preference_profiles", "form_responses", 
        "workspace_form_links", "matching_runs", "pair_scores", 
        "room_assignments", "platform_audit_events"
    ]
    for table in tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    tables = [
        "tenants", "workspaces", "tenant_memberships", "segments", 
        "students", "rooms", "preference_profiles", "form_responses", 
        "workspace_form_links", "matching_runs", "pair_scores", 
        "room_assignments", "platform_audit_events"
    ]
    for table in tables:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
