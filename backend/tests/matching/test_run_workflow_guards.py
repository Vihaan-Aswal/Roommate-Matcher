"""Guard clauses and failure handling in the matching run workflow."""
from __future__ import annotations

import uuid
from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.models.matching_run import MatchingRun
from app.models.preference_profile import PreferenceProfile
from app.models.room import Room
from app.models.segment import Segment
from app.models.student import Student
from app.services.orchestration.run_workflow import run_matching_workflow


def _segment(db_session: Session, tenant_id, workspace_id, *, key: str, students: int) -> Segment:
    segment = Segment(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_key=key,
        gender="F",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()

    student_rows = []
    for idx in range(1, students + 1):
        student = Student(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            segment_id=segment.id,
            admission_number=f"WF{idx:03d}",
            full_name=f"Workflow Student {idx}",
            gender="F",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
            dob=date(2005, 1, idx),
            phone_last4="3210",
            is_active=True,
        )
        student_rows.append(student)
    db_session.add_all(student_rows)
    db_session.flush()
    db_session.add_all(
        [
            PreferenceProfile(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                student_id=student.id,
                has_preferences=True,
                is_active=True,
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
            for student in student_rows
        ]
    )
    db_session.commit()
    return segment


def test_workflow_requires_scope_specific_segment_key(
    db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]

    with pytest.raises(ValueError, match="segment_key is required"):
        run_matching_workflow(db_session, workspace_id, tenant_id, "segment", None)
    with pytest.raises(ValueError, match="segment_key must be null"):
        run_matching_workflow(
            db_session, workspace_id, tenant_id, "all_ready_segments", "SOME_SEGMENT"
        )
    with pytest.raises(ValueError, match="Invalid scope"):
        run_matching_workflow(db_session, workspace_id, tenant_id, "everything", None)


def test_workflow_rejects_segment_without_students(
    db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    _segment(db_session, tenant_id, workspace_id, key="F_1st_year_AC_2", students=0)

    with pytest.raises(ValueError, match="No students found"):
        run_matching_workflow(
            db_session, workspace_id, tenant_id, "segment", "F_1st_year_AC_2"
        )


def test_workflow_generates_room_ids_when_none_uploaded(
    db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    _segment(db_session, tenant_id, workspace_id, key="F_1st_year_AC_2", students=2)

    result = run_matching_workflow(
        db_session, workspace_id, tenant_id, "segment", "F_1st_year_AC_2"
    )

    assert result.status == "completed"
    assert result.segments_matched == 1


def test_workflow_marks_run_failed_when_room_count_is_short(
    db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    segment = _segment(
        db_session, tenant_id, workspace_id, key="F_1st_year_AC_2", students=4
    )
    # Capacity says Ready (4 beds) but there is only one physical room for a
    # 2-bed segment, so artifact persistence must fail after the run row exists.
    db_session.add(
        Room(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            segment_id=segment.id,
            room_id="BIG-1",
            capacity=4,
            source="uploaded",
            is_active=True,
        )
    )
    db_session.commit()

    with pytest.raises(ValueError, match="Not enough rooms"):
        run_matching_workflow(
            db_session, workspace_id, tenant_id, "segment", "F_1st_year_AC_2"
        )

    failed_run = db_session.query(MatchingRun).one()
    assert failed_run.status == "failed"
    assert "Not enough rooms" in (failed_run.error_message or "")
    assert failed_run.finished_at is not None
    assert uuid.UUID(str(failed_run.id))


def test_fairness_snapshot_unknown_run_raises(db_session: Session, seed_tenant_and_user) -> None:
    from app.services.orchestration.run_workflow import get_run_fairness_snapshot

    with pytest.raises(KeyError, match="Matching run not found"):
        get_run_fairness_snapshot(
            db_session, "run_missing", seed_tenant_and_user["workspace_id"]
        )


def test_fairness_snapshot_leaves_non_list_segments_untouched(
    db_session: Session, seed_tenant_and_user
) -> None:
    import json

    from app.services.orchestration.run_workflow import get_run_fairness_snapshot

    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    db_session.add(
        MatchingRun(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            run_id="run_string_segments",
            scope="segment",
            status="completed",
            fairness_summary_json=json.dumps({"total_students": 1, "by_segment": "nope"}),
        )
    )
    db_session.commit()

    snapshot = get_run_fairness_snapshot(db_session, "run_string_segments", workspace_id)

    assert snapshot["by_segment"] == "nope"
