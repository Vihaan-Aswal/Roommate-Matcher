"""add phase 1 contract indexes

Revision ID: 0002_phase1_contract_indices
Revises: 0001_phase0_init
Create Date: 2026-03-30 00:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0002_phase1_contract_indices"
down_revision: Union[str, None] = "0001_phase0_init"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_form_responses_admission_submitted_at",
        "form_responses",
        ["admission_number", "submitted_at"],
        unique=False,
    )

    op.create_index(
        "ux_preference_profiles_one_active",
        "preference_profiles",
        ["admission_number"],
        unique=True,
        sqlite_where=sa.text("is_active = 1"),
    )


def downgrade() -> None:
    op.drop_index("ux_preference_profiles_one_active", table_name="preference_profiles")
    op.drop_index("ix_form_responses_admission_submitted_at", table_name="form_responses")
