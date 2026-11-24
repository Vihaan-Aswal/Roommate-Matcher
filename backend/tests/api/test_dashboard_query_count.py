from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.models.preference_profile import PreferenceProfile
from app.models.room import Room
from app.models.segment import Segment
from app.models.student import Student
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.services.dashboard.summary import get_workspace_dashboard_summary
from app.services.segments.status import compute_segment_status


def _statement_counter(db: Session):
    statements: list[str] = []

    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(db.bind, "before_cursor_execute", before_cursor_execute)
    return statements, before_cursor_execute


def _add_segment(
    db: Session,
    tenant_id: uuid.UUID,
    workspace_id: uuid.UUID,
    *,
    segment_key: str,
    gender: str,
    year_group: str,
    ac_type: str,
    student_count: int,
    valid_profiles: int,
    room_count: int,
) -> None:
    segment = Segment(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_key=segment_key,
        gender=gender,
        year_group=year_group,
        ac_type=ac_type,
        room_size=2,
    )
    db.add(segment)
    db.flush()

    for index in range(student_count):
        student = Student(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            segment_id=segment.id,
            admission_number=f"{segment_key}-{index:03d}",
            full_name=f"Student {index}",
            gender=gender,
            year_group=year_group,
            ac_type=ac_type,
            room_size=2,
            dob=date(2005, 1, 1),
            phone_number=f"98765{index:05d}",
            phone_last4=f"{index:04d}",
            is_active=True,
        )
        db.add(student)
        db.flush()
        if index < valid_profiles:
            db.add(
                PreferenceProfile(
                    tenant_id=tenant_id,
                    workspace_id=workspace_id,
                    student_id=student.id,
                    has_preferences=True,
                    is_active=True,
                )
            )

    for index in range(room_count):
        db.add(
            Room(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                segment_id=segment.id,
                room_id=f"{segment_key}-R{index}",
                capacity=2,
                source="uploaded",
                is_active=True,
            )
        )
    db.flush()


def test_dashboard_segment_counts_use_one_batched_status_pass(db_session: Session) -> None:
    tenant = Tenant(slug=f"dash-{uuid.uuid4().hex[:8]}", display_name="Dashboard Tenant")
    db_session.add(tenant)
    db_session.flush()
    workspace = Workspace(tenant_id=tenant.id, name="Dashboard Workspace", status="active", source="manual")
    db_session.add(workspace)
    db_session.flush()

    fixtures = [
        ("SEG_READY", "M", "1st_year", "AC", 4, 4, 2),
        ("SEG_READY_AUTO", "F", "1st_year", "AC", 3, 3, 0),
        ("SEG_IMPOSSIBLE", "M", "2nd_year", "AC", 5, 5, 2),
        ("SEG_RISK", "F", "2nd_year", "AC", 5, 3, 3),
        ("SEG_RISK_AUTO", "M", "3rd_year", "AC", 6, 4, 0),
        ("SEG_READY_TINY", "F", "3rd_year", "AC", 2, 2, 1),
    ]
    for segment_key, gender, year_group, ac_type, student_count, valid_profiles, room_count in fixtures:
        _add_segment(
            db_session,
            tenant.id,
            workspace.id,
            segment_key=segment_key,
            gender=gender,
            year_group=year_group,
            ac_type=ac_type,
            student_count=student_count,
            valid_profiles=valid_profiles,
            room_count=room_count,
        )

    expected = {"Ready": 0, "Impossible": 0, "Risk": 0}
    for segment_key, _, _, _, _, _, _ in fixtures:
        expected[compute_segment_status(db_session, segment_key, workspace.id).status] += 1
    assert set(expected) == {"Ready", "Impossible", "Risk"}
    assert expected == {"Ready": 3, "Impossible": 1, "Risk": 2}

    statements, listener = _statement_counter(db_session)
    summary = get_workspace_dashboard_summary(db_session, workspace)
    event.remove(db_session.bind, "before_cursor_execute", listener)

    assert summary.segments_status == {
        "total_segments": 6,
        "ready": expected["Ready"],
        "impossible": expected["Impossible"],
        "at_risk": expected["Risk"],
    }

    selects = [statement for statement in statements if statement.lstrip().upper().startswith("SELECT")]
    assert len(selects) <= 16, f"expected at most 16 queries, got {len(selects)}: {selects}"
