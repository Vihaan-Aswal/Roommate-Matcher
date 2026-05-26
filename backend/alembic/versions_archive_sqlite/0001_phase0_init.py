"""create phase 0 core tables

Revision ID: 0001_phase0_init
Revises:
Create Date: 2026-03-30 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001_phase0_init"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "segments",
        sa.Column("segment_key", sa.String(), nullable=False),
        sa.Column("gender", sa.String(), nullable=False),
        sa.Column("year_group", sa.String(), nullable=False),
        sa.Column("ac_type", sa.String(), nullable=False),
        sa.Column("room_size", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("room_size IN (2, 3, 4)", name="ck_segments_room_size"),
        sa.PrimaryKeyConstraint("segment_key"),
        sa.UniqueConstraint("gender", "year_group", "ac_type", "room_size", name="uq_segments_dimensions"),
    )

    op.create_table(
        "students",
        sa.Column("admission_number", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("gender", sa.String(), nullable=False),
        sa.Column("year_group", sa.String(), nullable=False),
        sa.Column("ac_type", sa.String(), nullable=False),
        sa.Column("room_size", sa.Integer(), nullable=False),
        sa.Column("dob", sa.Date(), nullable=False),
        sa.Column("segment_key", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("room_size IN (2, 3, 4)", name="ck_students_room_size"),
        sa.ForeignKeyConstraint(["segment_key"], ["segments.segment_key"]),
        sa.PrimaryKeyConstraint("admission_number"),
    )
    op.create_index("ix_students_segment_key", "students", ["segment_key"], unique=False)
    op.create_index("ix_students_year_gender_ac", "students", ["year_group", "gender", "ac_type"], unique=False)

    op.create_table(
        "rooms",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("room_id", sa.String(), nullable=False),
        sa.Column("segment_key", sa.String(), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(), server_default="uploaded", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("capacity IN (2, 3, 4)", name="ck_rooms_capacity"),
        sa.CheckConstraint("source IN ('uploaded', 'generated')", name="ck_rooms_source"),
        sa.ForeignKeyConstraint(["segment_key"], ["segments.segment_key"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("segment_key", "room_id", name="uq_rooms_segment_room_id"),
    )
    op.create_index("ix_rooms_segment_key", "rooms", ["segment_key"], unique=False)

    op.create_table(
        "form_responses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("admission_number", sa.String(), nullable=False),
        sa.Column("dob", sa.Date(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("validation_status", sa.String(), nullable=False),
        sa.Column("invalid_reason", sa.Text(), nullable=True),
        sa.Column("q1_raw", sa.Text(), nullable=True),
        sa.Column("q2_raw", sa.Text(), nullable=True),
        sa.Column("q3_raw", sa.Text(), nullable=True),
        sa.Column("q4a_raw", sa.Text(), nullable=True),
        sa.Column("q4b_raw", sa.Text(), nullable=True),
        sa.Column("q5a_raw", sa.Text(), nullable=True),
        sa.Column("q5b_raw", sa.Text(), nullable=True),
        sa.Column("q6_raw", sa.Text(), nullable=True),
        sa.Column("q7_raw", sa.Text(), nullable=True),
        sa.Column("q8_raw", sa.Text(), nullable=True),
        sa.Column("q9_raw", sa.Text(), nullable=True),
        sa.Column("q10_raw", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("validation_status IN ('valid', 'invalid')", name="ck_form_responses_status"),
        sa.ForeignKeyConstraint(["admission_number"], ["students.admission_number"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_form_responses_admission_number", "form_responses", ["admission_number"], unique=False)
    op.create_index("ix_form_responses_submitted_at", "form_responses", ["submitted_at"], unique=False)
    op.create_index("ix_form_responses_validation_status", "form_responses", ["validation_status"], unique=False)

    op.create_table(
        "preference_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("admission_number", sa.String(), nullable=False),
        sa.Column("source_form_response_id", sa.Integer(), nullable=True),
        sa.Column("has_preferences", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Integer(), nullable=False),
        sa.Column("q1_raw", sa.Text(), nullable=True),
        sa.Column("q2_raw", sa.Text(), nullable=True),
        sa.Column("q3_raw", sa.Text(), nullable=True),
        sa.Column("q4a_raw", sa.Text(), nullable=True),
        sa.Column("q4b_raw", sa.Text(), nullable=True),
        sa.Column("q5a_raw", sa.Text(), nullable=True),
        sa.Column("q5b_raw", sa.Text(), nullable=True),
        sa.Column("q6_raw", sa.Text(), nullable=True),
        sa.Column("q7_raw", sa.Text(), nullable=True),
        sa.Column("q8_raw", sa.Text(), nullable=True),
        sa.Column("q9_raw", sa.Text(), nullable=True),
        sa.Column("q10_raw", sa.Text(), nullable=True),
        sa.Column("q1_enc", sa.REAL(), nullable=True),
        sa.Column("q2_enc", sa.REAL(), nullable=True),
        sa.Column("q3_enc", sa.REAL(), nullable=True),
        sa.Column("q4a_enc", sa.REAL(), nullable=True),
        sa.Column("q4b_enc", sa.REAL(), nullable=True),
        sa.Column("q5a_enc", sa.REAL(), nullable=True),
        sa.Column("q5b_enc", sa.REAL(), nullable=True),
        sa.Column("q6_enc", sa.REAL(), nullable=True),
        sa.Column("q7_enc", sa.REAL(), nullable=True),
        sa.Column("q8_enc", sa.REAL(), nullable=True),
        sa.Column("q9_enc", sa.REAL(), nullable=True),
        sa.Column("q10_enc", sa.REAL(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("has_preferences IN (0, 1)", name="ck_preference_profiles_has_preferences"),
        sa.CheckConstraint("is_active IN (0, 1)", name="ck_preference_profiles_is_active"),
        sa.ForeignKeyConstraint(["admission_number"], ["students.admission_number"]),
        sa.ForeignKeyConstraint(["source_form_response_id"], ["form_responses.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_preference_profiles_admission_number", "preference_profiles", ["admission_number"], unique=False)
    op.create_index("ix_preference_profiles_admission_active", "preference_profiles", ["admission_number", "is_active"], unique=False)

    op.create_table(
        "matching_runs",
        sa.Column("run_id", sa.String(), nullable=False),
        sa.Column("scope", sa.String(), nullable=False),
        sa.Column("target_segment_key", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("scope IN ('segment', 'all_ready_segments')", name="ck_matching_runs_scope"),
        sa.CheckConstraint("status IN ('pending', 'running', 'completed', 'failed')", name="ck_matching_runs_status"),
        sa.ForeignKeyConstraint(["target_segment_key"], ["segments.segment_key"]),
        sa.PrimaryKeyConstraint("run_id"),
    )
    op.create_index("ix_matching_runs_created_at", "matching_runs", ["created_at"], unique=False)
    op.create_index("ix_matching_runs_status", "matching_runs", ["status"], unique=False)
    op.create_index("ix_matching_runs_target_segment_key", "matching_runs", ["target_segment_key"], unique=False)

    op.create_table(
        "pair_scores",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.String(), nullable=False),
        sa.Column("segment_key", sa.String(), nullable=False),
        sa.Column("student_a", sa.String(), nullable=False),
        sa.Column("student_b", sa.String(), nullable=False),
        sa.Column("pair_score", sa.REAL(), nullable=False),
        sa.Column("factor_breakdown_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("pair_score >= 0.0 AND pair_score <= 1.0", name="ck_pair_scores_range"),
        sa.CheckConstraint("student_a <> student_b", name="ck_pair_scores_distinct_students"),
        sa.ForeignKeyConstraint(["run_id"], ["matching_runs.run_id"]),
        sa.ForeignKeyConstraint(["segment_key"], ["segments.segment_key"]),
        sa.ForeignKeyConstraint(["student_a"], ["students.admission_number"]),
        sa.ForeignKeyConstraint(["student_b"], ["students.admission_number"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "segment_key", "student_a", "student_b", name="uq_pair_scores_run_segment_pair"),
    )
    op.create_index("ix_pair_scores_run_segment", "pair_scores", ["run_id", "segment_key"], unique=False)
    op.create_index("ix_pair_scores_student_a", "pair_scores", ["student_a"], unique=False)
    op.create_index("ix_pair_scores_student_b", "pair_scores", ["student_b"], unique=False)

    op.create_table(
        "room_assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.String(), nullable=False),
        sa.Column("segment_key", sa.String(), nullable=False),
        sa.Column("room_id", sa.String(), nullable=False),
        sa.Column("room_label", sa.String(), nullable=True),
        sa.Column("assigned_students_json", sa.Text(), nullable=False),
        sa.Column("group_score", sa.REAL(), nullable=False),
        sa.Column("satisfaction_summary_json", sa.Text(), nullable=True),
        sa.Column("needs_review", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("group_score >= 0.0 AND group_score <= 1.0", name="ck_room_assignments_group_score_range"),
        sa.CheckConstraint("needs_review IN (0, 1)", name="ck_room_assignments_needs_review"),
        sa.ForeignKeyConstraint(["run_id"], ["matching_runs.run_id"]),
        sa.ForeignKeyConstraint(["segment_key"], ["segments.segment_key"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "segment_key", "room_id", name="uq_room_assignments_run_segment_room"),
    )
    op.create_index("ix_room_assignments_run_segment", "room_assignments", ["run_id", "segment_key"], unique=False)
    op.create_index("ix_room_assignments_needs_review", "room_assignments", ["needs_review"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_room_assignments_needs_review", table_name="room_assignments")
    op.drop_index("ix_room_assignments_run_segment", table_name="room_assignments")
    op.drop_table("room_assignments")

    op.drop_index("ix_pair_scores_student_b", table_name="pair_scores")
    op.drop_index("ix_pair_scores_student_a", table_name="pair_scores")
    op.drop_index("ix_pair_scores_run_segment", table_name="pair_scores")
    op.drop_table("pair_scores")

    op.drop_index("ix_matching_runs_target_segment_key", table_name="matching_runs")
    op.drop_index("ix_matching_runs_status", table_name="matching_runs")
    op.drop_index("ix_matching_runs_created_at", table_name="matching_runs")
    op.drop_table("matching_runs")

    op.drop_index("ix_preference_profiles_admission_active", table_name="preference_profiles")
    op.drop_index("ix_preference_profiles_admission_number", table_name="preference_profiles")
    op.drop_table("preference_profiles")

    op.drop_index("ix_form_responses_validation_status", table_name="form_responses")
    op.drop_index("ix_form_responses_submitted_at", table_name="form_responses")
    op.drop_index("ix_form_responses_admission_number", table_name="form_responses")
    op.drop_table("form_responses")

    op.drop_index("ix_rooms_segment_key", table_name="rooms")
    op.drop_table("rooms")

    op.drop_index("ix_students_year_gender_ac", table_name="students")
    op.drop_index("ix_students_segment_key", table_name="students")
    op.drop_table("students")

    op.drop_table("segments")
