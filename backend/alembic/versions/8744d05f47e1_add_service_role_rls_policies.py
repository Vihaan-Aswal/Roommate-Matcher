"""add_service_role_rls_policies

Revision ID: 8744d05f47e1
Revises: 66d537ba5fdf
Create Date: 2026-05-29 05:31:43.352489

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8744d05f47e1'
down_revision: Union[str, None] = '66d537ba5fdf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables = [
        "alembic_version", "tenants", "workspaces", "tenant_memberships", 
        "segments", "students", "rooms", "preference_profiles", "form_responses", 
        "workspace_form_links", "matching_runs", "pair_scores", 
        "room_assignments", "platform_audit_events"
    ]
    for table in tables:
        op.execute(f"CREATE POLICY \"service_role_all\" ON {table} AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);")


def downgrade() -> None:
    tables = [
        "alembic_version", "tenants", "workspaces", "tenant_memberships", 
        "segments", "students", "rooms", "preference_profiles", "form_responses", 
        "workspace_form_links", "matching_runs", "pair_scores", 
        "room_assignments", "platform_audit_events"
    ]
    for table in tables:
        op.execute(f"DROP POLICY IF EXISTS \"service_role_all\" ON {table};")
