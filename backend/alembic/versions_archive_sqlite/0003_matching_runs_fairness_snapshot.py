"""add fairness snapshot column on matching_runs

Revision ID: 0003_matching_runs_fairness_snapshot
Revises: 0002_phase1_contract_indices
Create Date: 2026-04-01 00:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0003_matching_runs_fairness_snapshot"
down_revision: Union[str, None] = "0002_phase1_contract_indices"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("matching_runs", sa.Column("fairness_summary_json", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("matching_runs", "fairness_summary_json")
