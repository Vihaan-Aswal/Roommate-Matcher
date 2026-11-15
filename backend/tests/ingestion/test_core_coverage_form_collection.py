from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from app.models.segment import Segment
from app.models.student import Student
from app.services.ingestion.form_collection import compute_form_collection_status, list_non_submitters


def _seed_student(db_session: Session, admission_number: str) -> Student:
    segment = Segment(
        tenant_id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        segment_key="M_1st_year_AC_2",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()
    student = Student(
        tenant_id=segment.tenant_id,
        workspace_id=segment.workspace_id,
        admission_number=admission_number,
        full_name=f"Student {admission_number}",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 1),
        segment_id=segment.id,
        phone_number="9876541234",
        phone_last4="1234",
        is_active=True,
    )
    db_session.add(segment)
    db_session.add(student)
    db_session.commit()
    return student


def test_latest_form_status_per_admission_uses_only_the_most_recent_row(
    db_session: Session,
) -> None:
    student = _seed_student(db_session, "ADM-COLL-1")

    db_session.add_all(
        [
            FormResponse(
                tenant_id=student.tenant_id,
                workspace_id=student.workspace_id,
                student_id=student.id,
                submitted_admission_number="ADM-COLL-1",
                submitted_phone_last4="9999",
                submitted_at=datetime(2026, 3, 30, 12, 0, tzinfo=timezone.utc),
                validation_status="invalid",
                invalid_reason="phone_mismatch",
            ),
            FormResponse(
                tenant_id=student.tenant_id,
                workspace_id=student.workspace_id,
                student_id=student.id,
                submitted_admission_number="ADM-COLL-1",
                submitted_phone_last4="1234",
                submitted_at=datetime(2026, 3, 29, 12, 0, tzinfo=timezone.utc),
                validation_status="valid",
            ),
        ]
    )
    db_session.commit()

    status = compute_form_collection_status(db_session, student.workspace_id)

    assert status.total_students == 1
    assert status.valid_responses == 0
    assert status.invalid_responses == 1
    assert status.by_segment[0].segment_key == "M_1st_year_AC_2"


def test_list_non_submitters_returns_active_students_without_a_valid_response(
    db_session: Session,
) -> None:
    student = _seed_student(db_session, "ADM-COLL-2")

    rows = list_non_submitters(db_session, student.workspace_id)

    assert len(rows) == 1
    assert rows[0].admission_number == "ADM-COLL-2"
    assert rows[0].full_name == "Student ADM-COLL-2"
    assert rows[0].segment_key == "M_1st_year_AC_2"
