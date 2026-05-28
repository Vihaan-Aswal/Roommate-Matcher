from datetime import date

from sqlalchemy.orm import Session

from app.models.preference_profile import PreferenceProfile
from app.models.room import Room
from app.models.segment import Segment
from app.models.student import Student
from app.services.segments.status import compute_segment_status


def _seed_segment(db_session: Session, segment_key: str, room_size: int, tenant_id=None, workspace_id=None) -> None:
    import uuid
    tenant_id = tenant_id or uuid.uuid4()
    workspace_id = workspace_id or uuid.uuid4()
    db_session.add(
        Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key=segment_key,
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=room_size,
        )
    )
    db_session.flush()
    db_session.commit()


def _add_students(db_session: Session, segment_key: str, count: int, tenant_id=None, workspace_id=None) -> None:
    import uuid
    tenant_id = tenant_id or uuid.uuid4()
    workspace_id = workspace_id or uuid.uuid4()
    segment = db_session.query(Segment).filter_by(segment_key=segment_key).first()
    for idx in range(count):
        admission_number = f"ADM{idx + 1:03d}"
        db_session.add(
            Student(tenant_id=tenant_id, workspace_id=workspace_id, admission_number=admission_number,
                full_name=f"Student {idx + 1}",
                gender="M",
                year_group="1st_year",
                ac_type="AC",
                room_size=2,
                dob=date(2005, 1, 1),
                segment_id=segment.id,
                phone_number="9876543210",
                phone_last4="3210",
                is_active=True,
            )
        )
    db_session.flush()
    db_session.commit()


def _add_rooms(db_session: Session, segment_key: str, room_ids: list[str], capacity: int, tenant_id=None, workspace_id=None) -> None:
    import uuid
    tenant_id = tenant_id or uuid.uuid4()
    workspace_id = workspace_id or uuid.uuid4()
    segment = db_session.query(Segment).filter_by(segment_key=segment_key).first()
    for room_id in room_ids:
        db_session.add(Room(tenant_id=tenant_id, workspace_id=workspace_id, room_id=room_id, segment_id=segment.id, capacity=capacity, source="uploaded", is_active=True))
    db_session.commit()


def _add_active_profiles(db_session: Session, admissions: list[str], has_preferences: int, tenant_id=None, workspace_id=None) -> None:
    import uuid
    tenant_id = tenant_id or uuid.uuid4()
    workspace_id = workspace_id or uuid.uuid4()
    for admission in admissions:
        student = db_session.query(Student).filter_by(admission_number=admission).first()
        db_session.add(
            PreferenceProfile(tenant_id=tenant_id, workspace_id=workspace_id, student_id=student.id,
                has_preferences=has_preferences,
                is_active=True,
            )
        )
    db_session.commit()


def test_compute_segment_status_ready(db_session: Session) -> None:
    import uuid
    tenant_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    segment_key = "M_1st_year_AC_2"
    _seed_segment(db_session, segment_key, room_size=2, tenant_id=tenant_id, workspace_id=workspace_id)
    _add_students(db_session, segment_key, count=4, tenant_id=tenant_id, workspace_id=workspace_id)
    _add_rooms(db_session, segment_key, ["R1", "R2"], capacity=2, tenant_id=tenant_id, workspace_id=workspace_id)
    _add_active_profiles(db_session, ["ADM001", "ADM002", "ADM003", "ADM004"], has_preferences=1, tenant_id=tenant_id, workspace_id=workspace_id)

    result = compute_segment_status(db_session, segment_key, workspace_id)

    assert result.status == "Ready"
    assert result.student_count == 4
    assert result.total_capacity == 4


def test_compute_segment_status_ready_without_uploaded_rooms(db_session: Session) -> None:
    import uuid
    tenant_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    segment_key = "M_1st_year_AC_2"
    _seed_segment(db_session, segment_key, room_size=2, tenant_id=tenant_id, workspace_id=workspace_id)
    _add_students(db_session, segment_key, count=3, tenant_id=tenant_id, workspace_id=workspace_id)
    _add_active_profiles(db_session, ["ADM001", "ADM002", "ADM003"], has_preferences=1, tenant_id=tenant_id, workspace_id=workspace_id)

    result = compute_segment_status(db_session, segment_key, workspace_id)

    assert result.status == "Ready"
    assert result.student_count == 3
    assert result.total_capacity == 3


def test_compute_segment_status_impossible_when_capacity_low(db_session: Session) -> None:
    import uuid
    tenant_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    segment_key = "M_1st_year_AC_2"
    _seed_segment(db_session, segment_key, room_size=2, tenant_id=tenant_id, workspace_id=workspace_id)
    _add_students(db_session, segment_key, count=5, tenant_id=tenant_id, workspace_id=workspace_id)
    _add_rooms(db_session, segment_key, ["R1", "R2"], capacity=2, tenant_id=tenant_id, workspace_id=workspace_id)

    result = compute_segment_status(db_session, segment_key, workspace_id)

    assert result.status == "Impossible"
    assert result.student_count == 5
    assert result.total_capacity == 4


def test_compute_segment_status_risk_when_missing_preferences_exceed_threshold(db_session: Session) -> None:
    import uuid
    tenant_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    segment_key = "M_1st_year_AC_2"
    _seed_segment(db_session, segment_key, room_size=2, tenant_id=tenant_id, workspace_id=workspace_id)
    _add_students(db_session, segment_key, count=5, tenant_id=tenant_id, workspace_id=workspace_id)
    _add_rooms(db_session, segment_key, ["R1", "R2", "R3"], capacity=2, tenant_id=tenant_id, workspace_id=workspace_id)
    _add_active_profiles(db_session, ["ADM001", "ADM002", "ADM003"], has_preferences=1, tenant_id=tenant_id, workspace_id=workspace_id)
    _add_active_profiles(db_session, ["ADM004", "ADM005"], has_preferences=0, tenant_id=tenant_id, workspace_id=workspace_id)

    result = compute_segment_status(db_session, segment_key, workspace_id)

    assert result.status == "Risk"
    assert result.missing_preferences_count == 2
    assert result.missing_preferences_ratio > 0.2


def test_compute_segment_status_raises_for_unknown_segment(db_session: Session) -> None:
    import uuid
    try:
        compute_segment_status(db_session, "UNKNOWN", uuid.uuid4())
        raise AssertionError("Expected KeyError for missing segment")
    except KeyError:
        pass
