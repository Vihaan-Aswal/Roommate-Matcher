"""Segment status edge cases: as_dict, impossible overviews, missing profiles."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.models.preference_profile import PreferenceProfile
from app.models.form_response import FormResponse
from app.models.room import Room
from app.models.segment import Segment
from app.models.student import Student
from app.services.segments.status import (
    compute_segment_status,
    get_segment_students_preference_status,
    list_segment_overviews,
)


def _seed(db_session: Session) -> tuple[uuid.UUID, uuid.UUID]:
    from app.models.tenant import Tenant
    from app.models.workspace import Workspace

    tenant = Tenant(slug=f"seg-{uuid.uuid4().hex[:8]}", display_name="Segment Tenant")
    db_session.add(tenant)
    db_session.flush()
    workspace = Workspace(tenant_id=tenant.id, name="Segment WS", status="draft")
    db_session.add(workspace)
    db_session.commit()
    return tenant.id, workspace.id


def _segment(db_session: Session, tenant_id, workspace_id, *, key: str, gender: str) -> Segment:
    segment = Segment(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_key=key,
        gender=gender,
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()
    return segment


def _student(
    db_session: Session, tenant_id, workspace_id, segment: Segment, *, admission: str
) -> Student:
    student = Student(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_id=segment.id,
        admission_number=admission,
        full_name=f"Status Student {admission}",
        gender=segment.gender,
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 1),
        phone_last4="3210",
        is_active=True,
    )
    db_session.add(student)
    db_session.flush()
    return student


def test_segment_status_as_dict_rounds_ratio() -> None:
    from app.services.segments.status import SegmentStatusResult

    result = SegmentStatusResult(
        segment_key="SEG",
        status="Risk",
        reason="reason",
        student_count=3,
        total_capacity=2,
        missing_preferences_count=2,
        missing_preferences_ratio=0.666666,
    )

    payload = result.as_dict()
    assert payload["segment_key"] == "SEG"
    assert payload["missing_preferences_ratio"] == 0.6667


def test_overviews_flag_impossible_and_ready_segments(db_session: Session) -> None:
    tenant_id, workspace_id = _seed(db_session)

    impossible = _segment(
        db_session, tenant_id, workspace_id, key="IMPOSSIBLE_F_1st_year_AC_2", gender="F"
    )
    students = [
        _student(
            db_session,
            tenant_id,
            workspace_id,
            impossible,
            admission=f"IMP00{idx}",
        )
        for idx in (1, 2, 3)
    ]
    db_session.add(
        Room(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            segment_id=impossible.id,
            room_id="IMP-R1",
            capacity=2,
            source="uploaded",
            is_active=True,
        )
    )

    ready = _segment(
        db_session, tenant_id, workspace_id, key="READY_M_1st_year_AC_2", gender="M"
    )
    ready_student = _student(
        db_session, tenant_id, workspace_id, ready, admission="READY001"
    )
    db_session.add(
        PreferenceProfile(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            student_id=ready_student.id,
            has_preferences=True,
            is_active=True,
        )
    )
    db_session.commit()
    assert len(students) == 3

    overviews = {row.segment_key: row for row in list_segment_overviews(db_session, workspace_id)}

    assert overviews["IMPOSSIBLE_F_1st_year_AC_2"].status == "Impossible"
    assert overviews["IMPOSSIBLE_F_1st_year_AC_2"].total_capacity == 2
    assert overviews["READY_M_1st_year_AC_2"].status == "Ready"


def test_compute_segment_status_is_risk_without_uploaded_rooms(db_session: Session) -> None:
    tenant_id, workspace_id = _seed(db_session)
    segment = _segment(
        db_session, tenant_id, workspace_id, key="RISK_F_1st_year_AC_2", gender="F"
    )
    _student(db_session, tenant_id, workspace_id, segment, admission="RISK001")
    db_session.commit()

    status = compute_segment_status(db_session, "RISK_F_1st_year_AC_2", workspace_id)

    assert status.status == "Risk"
    assert "auto-generated at matching time" in status.reason
    assert status.total_capacity == 1


def test_student_preference_status_reports_missing_when_profile_has_none(
    db_session: Session,
) -> None:
    tenant_id, workspace_id = _seed(db_session)
    segment = _segment(
        db_session, tenant_id, workspace_id, key="MISS_F_1st_year_AC_2", gender="F"
    )
    student = _student(db_session, tenant_id, workspace_id, segment, admission="MISS001")
    db_session.add(
        PreferenceProfile(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            student_id=student.id,
            has_preferences=False,
            is_active=True,
        )
    )
    db_session.commit()

    result = get_segment_students_preference_status(
        db_session, "MISS_F_1st_year_AC_2", workspace_id
    )

    assert result.room_size == 2
    assert result.students[0].preference_status == "missing"
    assert result.students[0].has_valid_preferences is False


def test_student_preference_status_uses_latest_of_several_form_responses(
    db_session: Session,
) -> None:
    tenant_id, workspace_id = _seed(db_session)
    segment = _segment(
        db_session, tenant_id, workspace_id, key="FORM_F_1st_year_AC_2", gender="F"
    )
    student = _student(db_session, tenant_id, workspace_id, segment, admission="FORM001")
    for offset, submitted_at in enumerate(
        (
            datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc),
            datetime(2026, 1, 2, 9, 0, tzinfo=timezone.utc),
        )
    ):
        db_session.add(
            FormResponse(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                student_id=student.id,
                submitted_admission_number="FORM001",
                submitted_phone_last4="3210",
                submitted_at=submitted_at,
                validation_status="invalid",
                invalid_reason=f"invalid_option_for_q{offset + 1}_raw",
            )
        )
    db_session.commit()

    result = get_segment_students_preference_status(
        db_session, "FORM_F_1st_year_AC_2", workspace_id
    )

    assert result.students[0].preference_status == "invalid"
