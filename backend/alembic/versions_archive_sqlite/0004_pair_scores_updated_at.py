"""add updated_at column on pair_scores

Revision ID: 0004_pair_scores_updated_at
Revises: 0003_matching_runs_fairness_snapshot
Create Date: 2026-04-01 02:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0004_pair_scores_updated_at"
down_revision: Union[str, None] = "0003_matching_runs_fairness_snapshot"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("pair_scores") as batch_op:
        batch_op.add_column(
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("pair_scores") as batch_op:
        batch_op.drop_column("updated_at")
