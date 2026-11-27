"""Postgres parity suite — gated on ``TEST_DATABASE_URL``.

SQLite is a stand-in, not proof: JSONB, RLS policies, ``alembic`` migrations and
database-side cascade semantics only exist on PostgreSQL. This module exercises
them against a real Postgres server and skips (never fakes) when one is absent.

Unblock locally (Docker Desktop must be running):

    docker run --rm -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
    $env:TEST_DATABASE_URL='postgresql+psycopg2://postgres:postgres@127.0.0.1:55432/postgres'
    cd backend
    uv run --extra dev pytest tests/integration/test_postgres_parity.py -q

Notes
-----
* The suite runs ``alembic upgrade head`` / ``downgrade base``, which drops every
  table in the target database. It refuses to run against a Supabase host and
  treats anything non-PostgreSQL as unusable.
* Migration ``8744d05f47e1`` creates policies for Supabase's ``service_role``.
  A vanilla ``postgres:16`` container does not have that role, so the fixture
  provisions it before migrating; the migration SQL itself is still executed
  unmodified against the real server.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, delete, func, select, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from app.models.matching_run import MatchingRun
from app.models.pair_score import PairScore
from app.models.preference_profile import PreferenceProfile
from app.models.room import Room
from app.models.room_assignment import RoomAssignment
from app.models.segment import Segment
from app.models.student import Student
from app.models.tenant import Tenant
from app.models.tenant_membership import TenantMembership
from app.models.workspace import Workspace

DATABASE_URL_ENV = "TEST_DATABASE_URL"
BACKEND_DIR = Path(__file__).resolve().parents[2]

APP_TABLES = (
    "tenants",
    "workspaces",
    "tenant_memberships",
    "segments",
    "students",
    "rooms",
    "preference_profiles",
    "form_responses",
    "workspace_form_links",
    "matching_runs",
    "pair_scores",
    "room_assignments",
    "platform_audit_events",
)

pytestmark = pytest.mark.skipif(
    not os.environ.get(DATABASE_URL_ENV),
    reason="Postgres parity requires TEST_DATABASE_URL",
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def database_url() -> str:
    url = os.environ.get(DATABASE_URL_ENV)
    assert url, "TEST_DATABASE_URL disappeared after collection"
    parsed = make_url(url)
    if parsed.get_backend_name() != "postgresql":
        pytest.skip("TEST_DATABASE_URL must point at PostgreSQL")
    if parsed.host and "supabase" in parsed.host.lower():
        pytest.skip("refusing to run the destructive parity suite against Supabase")
    return url


def _alembic(url: str, *args: str) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment["DATABASE_URL"] = url
    environment["ALEMBIC_DATABASE_URL"] = url
    environment.setdefault(
        "CLEANUP_JOB_SECRET", "test-cleanup-secret-32-characters-long"
    )
    completed = subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_DIR,
        env=environment,
        capture_output=True,
        text=True,
        timeout=300,
    )
    assert completed.returncode == 0, (
        f"alembic {' '.join(args)} failed (exit {completed.returncode})\n"
        f"stdout:\n{completed.stdout}\nstderr:\n{completed.stderr}"
    )
    return completed


def _expected_head_revision() -> str:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    head = ScriptDirectory.from_config(config).get_current_head()
    assert head
    return head


def _ensure_supabase_roles(engine: Engine) -> None:
    """Migration 8744d05f47e1 grants to Supabase's service_role."""
    with engine.begin() as connection:
        exists = connection.execute(
            text("SELECT 1 FROM pg_roles WHERE rolname = 'service_role'")
        ).first()
        if exists is None:
            connection.execute(text("CREATE ROLE service_role NOLOGIN"))


@pytest.fixture(scope="module", autouse=True)
def migrated_database(database_url: str) -> Iterator[Engine]:
    engine = create_engine(database_url, future=True)
    try:
        _ensure_supabase_roles(engine)
        _alembic(database_url, "upgrade", "head")
        yield engine
        _alembic(database_url, "downgrade", "base")
    finally:
        engine.dispose()


def _tables(engine: Engine) -> set[str]:
    with engine.connect() as connection:
        return set(
            connection.execute(
                text(
                    "SELECT tablename FROM pg_tables "
                    "WHERE schemaname = current_schema()"
                )
            ).scalars()
        )


def _seed_graph(session: Session) -> dict[str, Any]:
    tenant = Tenant(slug=f"pg-{uuid.uuid4().hex[:10]}", display_name="PG Parity Tenant")
    session.add(tenant)
    session.flush()

    workspace = Workspace(
        tenant_id=tenant.id, name="PG Parity Workspace", status="active", source="manual"
    )
    session.add(workspace)
    session.flush()

    segment = Segment(
        tenant_id=tenant.id,
        workspace_id=workspace.id,
        segment_key=f"PG_{uuid.uuid4().hex[:8]}",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    session.add(segment)
    session.flush()

    students = []
    for index in range(1, 3):
        student = Student(
            tenant_id=tenant.id,
            workspace_id=workspace.id,
            segment_id=segment.id,
            admission_number=f"PG-{index:03d}",
            full_name=f"PG Student {index}",
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
            dob=date(2005, 1, index),
            phone_number=f"98765000{index:02d}",
            phone_last4=f"00{index:02d}",
            is_active=True,
        )
        session.add(student)
        students.append(student)
    session.flush()

    profile = PreferenceProfile(
        tenant_id=tenant.id,
        workspace_id=workspace.id,
        student_id=students[0].id,
        has_preferences=True,
        is_active=True,
        is_generated=False,
        q1_enc=1.0,
        q2_enc=1.0,
        q3_enc=1.0,
        q4a_enc=0.0,
        q4b_enc=3.0,
        q5a_enc=0.0,
        q5b_enc=3.0,
        q6_enc=1.0,
        q7_enc=1.0,
        q8_enc=1.0,
        q9_enc=1.0,
        q10_enc=0.0,
    )
    session.add(profile)

    rooms = []
    for index in range(1, 3):
        room = Room(
            tenant_id=tenant.id,
            workspace_id=workspace.id,
            segment_id=segment.id,
            room_id=f"PG-R{index}",
            capacity=2,
            source="uploaded",
            is_active=True,
        )
        session.add(room)
        rooms.append(room)
    session.flush()

    run = MatchingRun(
        tenant_id=tenant.id,
        workspace_id=workspace.id,
        run_id=f"pg_run_{uuid.uuid4().hex[:12]}",
        scope="segment",
        target_segment_id=segment.id,
        status="completed",
        fairness_summary_json={
            "total_students": 2,
            "run_label_counts": {"Excellent": 0, "Good": 2, "Okay": 0, "Poor": 0},
            "nested": {"label_order": ["Excellent", "Good", "Okay", "Poor"]},
        },
    )
    session.add(run)
    session.flush()

    assignment = RoomAssignment(
        tenant_id=tenant.id,
        workspace_id=workspace.id,
        matching_run_id=run.id,
        segment_id=segment.id,
        room_id=rooms[0].room_id,
        room_label=rooms[0].room_id,
        assigned_students_json=[students[0].admission_number, students[1].admission_number],
        group_score=0.83,
        satisfaction_summary_json={
            "students": [
                {
                    "student_id": students[0].admission_number,
                    "roommate_ids": [students[1].admission_number],
                    "satisfaction_score": 0.83,
                    "satisfaction_label": "Good",
                    "is_at_risk": False,
                    "reasons": ["Strong sleep alignment"],
                    "factor_trace": [{"factor": "q1_enc", "weight": "high"}],
                }
            ]
        },
        needs_review=False,
    )
    session.add(assignment)

    pair_score = PairScore(
        tenant_id=tenant.id,
        workspace_id=workspace.id,
        matching_run_id=run.id,
        segment_id=segment.id,
        student_a_id=students[0].id,
        student_b_id=students[1].id,
        pair_score=0.83,
        factor_breakdown_json={"q1_enc": {"raw_score": 0.83, "weight_used": 0.2, "missing_data": False}},
    )
    session.add(pair_score)
    session.commit()

    return {
        "tenant_id": tenant.id,
        "workspace_id": workspace.id,
        "segment_id": segment.id,
        "student_ids": [student.id for student in students],
        "room_ids": [room.id for room in rooms],
        "run_id": run.id,
        "assignment_id": assignment.id,
        "pair_score_id": pair_score.id,
    }


# ---------------------------------------------------------------------------
# Migrations
# ---------------------------------------------------------------------------

def test_alembic_upgrade_head_then_downgrade_base_round_trip(
    database_url: str, migrated_database: Engine
) -> None:
    head = _expected_head_revision()

    with migrated_database.connect() as connection:
        version = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
        assert version == head
        assert set(APP_TABLES) <= _tables(migrated_database)
        indexes = set(
            connection.execute(
                text("SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()")
            ).scalars()
        )
        assert "ix_preference_profiles_source_form_response_id" in indexes
        assert "ix_matching_runs_workspace_id_id" in indexes

    _alembic(database_url, "downgrade", "base")

    tables_after_downgrade = _tables(migrated_database)
    assert set(APP_TABLES).isdisjoint(tables_after_downgrade)

    with migrated_database.connect() as connection:
        version_table = connection.execute(text("SELECT to_regclass('alembic_version')")).scalar_one()
        if version_table is not None:
            assert connection.execute(text("SELECT count(*) FROM alembic_version")).scalar_one() == 0

    # Leave the database migrated so the remaining tests can use it.
    _alembic(database_url, "upgrade", "head")
    with migrated_database.connect() as connection:
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == head


# ---------------------------------------------------------------------------
# JSONB
# ---------------------------------------------------------------------------

def test_jsonb_columns_store_and_query_structured_documents(migrated_database: Engine) -> None:
    session = Session(migrated_database, expire_on_commit=False)
    try:
        graph = _seed_graph(session)
        session.expunge_all()

        assignment = session.get(RoomAssignment, graph["assignment_id"])
        assert assignment is not None
        assert assignment.assigned_students_json == ["PG-001", "PG-002"]
        summary = assignment.satisfaction_summary_json
        assert isinstance(summary, dict)
        assert summary["students"][0]["student_id"] == "PG-001"
        assert summary["students"][0]["factor_trace"][0]["factor"] == "q1_enc"

        run = session.get(MatchingRun, graph["run_id"])
        assert run is not None
        assert run.fairness_summary_json["nested"]["label_order"][0] == "Excellent"

        pair_score = session.get(PairScore, graph["pair_score_id"])
        assert pair_score is not None
        assert pair_score.factor_breakdown_json["q1_enc"]["weight_used"] == 0.2
    finally:
        session.close()

    with migrated_database.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT table_name, column_name, data_type "
                "FROM information_schema.columns "
                "WHERE table_schema = current_schema() "
                "AND table_name IN ('room_assignments', 'matching_runs', 'pair_scores', 'platform_audit_events')"
            )
        ).all()
        column_types = {
            f"{row.table_name}.{row.column_name}": row.data_type
            for row in rows
            if (row.table_name, row.column_name)
            in {
                ("room_assignments", "assigned_students_json"),
                ("matching_runs", "fairness_summary_json"),
                ("pair_scores", "factor_breakdown_json"),
                ("platform_audit_events", "payload_json"),
            }
        }
        assert set(column_types) == {
            "room_assignments.assigned_students_json",
            "matching_runs.fairness_summary_json",
            "pair_scores.factor_breakdown_json",
            "platform_audit_events.payload_json",
        }
        assert set(column_types.values()) == {"jsonb"}

        contains = connection.execute(
            text(
                "SELECT count(*) FROM room_assignments "
                "WHERE assigned_students_json @> CAST(:needle AS jsonb)"
            ),
            {"needle": json.dumps(["PG-001"])},
        ).scalar_one()
        assert contains == 1


# ---------------------------------------------------------------------------
# RLS
# ---------------------------------------------------------------------------

def test_rls_is_enabled_and_service_role_policies_exist(migrated_database: Engine) -> None:
    with migrated_database.connect() as connection:
        rls_flags = dict(
            connection.execute(
                text(
                    "SELECT relname, relrowsecurity FROM pg_class "
                    "WHERE relkind = 'r' "
                    "AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())"
                )
            ).all()
        )
        for table in (*APP_TABLES, "alembic_version"):
            assert rls_flags.get(table) is True, f"RLS is not enabled on {table}"

        policies = connection.execute(
            text("SELECT tablename, policyname FROM pg_policies WHERE schemaname = current_schema()")
        ).all()
        service_role_policies = {
            row.tablename for row in policies if row.policyname == "service_role_all"
        }
        assert service_role_policies == set(APP_TABLES) | {"alembic_version"}


# ---------------------------------------------------------------------------
# Cascade semantics
# ---------------------------------------------------------------------------

def test_deleting_a_segment_cascades_students_rooms_assignments_and_pair_scores(
    migrated_database: Engine,
) -> None:
    session = Session(migrated_database, expire_on_commit=False)
    try:
        graph = _seed_graph(session)
        segment_id = graph["segment_id"]

        # Core DELETE, not ORM: the database must perform the cascade itself.
        session.execute(delete(Segment).where(Segment.id == segment_id))
        session.commit()
        session.expire_all()

        assert session.scalar(
            select(func.count()).select_from(Student).where(Student.segment_id == segment_id)
        ) == 0
        assert session.scalar(
            select(func.count()).select_from(Room).where(Room.segment_id == segment_id)
        ) == 0
        assert session.scalar(
            select(func.count())
            .select_from(RoomAssignment)
            .where(RoomAssignment.segment_id == segment_id)
        ) == 0
        assert session.scalar(
            select(func.count()).select_from(PairScore).where(PairScore.segment_id == segment_id)
        ) == 0
        assert session.scalar(
            select(func.count())
            .select_from(PreferenceProfile)
            .where(PreferenceProfile.student_id.in_(graph["student_ids"]))
        ) == 0

        run = session.get(MatchingRun, graph["run_id"])
        assert run is not None, "the run must survive a segment delete"
        assert run.target_segment_id is None
    finally:
        session.close()


def test_deleting_an_expired_demo_tenant_removes_every_child_row(
    migrated_database: Engine,
) -> None:
    """The cleanup job deletes the tenant row; every child row must go with it."""
    session = Session(migrated_database, expire_on_commit=False)
    try:
        graph = _seed_graph(session)
        tenant_id = graph["tenant_id"]
        workspace_id = graph["workspace_id"]
        student_ids = graph["student_ids"]

        tenant = session.get(Tenant, tenant_id)
        assert tenant is not None
        tenant.is_demo = True
        tenant.demo_expires_at = datetime.now(timezone.utc) - timedelta(hours=1)

        session.add(
            PreferenceProfile(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                student_id=student_ids[1],
                has_preferences=True,
                is_active=True,
                is_generated=False,
                q1_enc=1.0,
                q2_enc=1.0,
                q3_enc=1.0,
                q4a_enc=0.0,
                q4b_enc=3.0,
                q5a_enc=0.0,
                q5b_enc=3.0,
                q6_enc=1.0,
                q7_enc=1.0,
                q8_enc=1.0,
                q9_enc=1.0,
                q10_enc=0.0,
            )
        )
        for index, student_id in enumerate(student_ids, start=1):
            session.add(
                FormResponse(
                    tenant_id=tenant_id,
                    workspace_id=workspace_id,
                    student_id=student_id,
                    submitted_admission_number=f"PG-{index:03d}",
                    submitted_phone_last4=f"00{index:02d}",
                    submitted_at=datetime.now(timezone.utc),
                    validation_status="valid",
                )
            )
        session.add(
            RoomAssignment(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                matching_run_id=graph["run_id"],
                segment_id=graph["segment_id"],
                room_id="PG-R2",
                room_label="PG-R2",
                assigned_students_json=["PG-002"],
                group_score=0.5,
                satisfaction_summary_json={"students": []},
                needs_review=False,
            )
        )
        session.commit()

        # Raw SQL, like the cleanup route: no ORM cascade may help here.
        session.execute(
            text("DELETE FROM tenants WHERE id = CAST(:id AS uuid)"), {"id": str(tenant_id)}
        )
        session.commit()
        session.expire_all()

        for model in (
            Workspace,
            Segment,
            Student,
            Room,
            PreferenceProfile,
            FormResponse,
            MatchingRun,
            PairScore,
            RoomAssignment,
        ):
            remaining = session.scalar(
                select(func.count()).select_from(model).where(model.tenant_id == tenant_id)
            )
            assert remaining == 0, f"{model.__name__} rows survived the tenant delete"
        assert session.scalar(
            select(func.count()).select_from(Tenant).where(Tenant.id == tenant_id)
        ) == 0
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Constraints added by later migrations
# ---------------------------------------------------------------------------

def test_duplicate_tenant_membership_is_rejected_by_the_database(migrated_database: Engine) -> None:
    session = Session(migrated_database, expire_on_commit=False)
    try:
        tenant = Tenant(slug=f"pg-members-{uuid.uuid4().hex[:10]}", display_name="PG Members")
        session.add(tenant)
        session.flush()

        user_id = uuid.uuid4()
        session.add(
            TenantMembership(
                tenant_id=tenant.id,
                supabase_user_id=user_id,
                email="first@parity.local",
                role="owner",
            )
        )
        session.commit()

        session.add(
            TenantMembership(
                tenant_id=tenant.id,
                supabase_user_id=user_id,
                email="duplicate@parity.local",
                role="admin",
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

        assert session.scalar(
            select(func.count())
            .select_from(TenantMembership)
            .where(
                TenantMembership.tenant_id == tenant.id,
                TenantMembership.supabase_user_id == user_id,
            )
        ) == 1
    finally:
        session.close()

    with migrated_database.connect() as connection:
        constraint = connection.execute(
            text("SELECT conname FROM pg_constraint WHERE conname = :name"),
            {"name": "uq_tenant_membership_tenant_user"},
        ).scalar_one_or_none()
        assert constraint == "uq_tenant_membership_tenant_user"
