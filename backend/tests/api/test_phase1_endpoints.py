from datetime import date
from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from app.models.preference_profile import PreferenceProfile
from app.models.room import Room
from app.models.segment import Segment
from app.models.student import Student


def _seed_student(db_session: Session, admission_number: str = "ADM200") -> None:
    db_session.add(
        Segment(
            segment_key="M_1st_year_AC_2",
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
        )
    )
    db_session.add(
        Student(
            admission_number=admission_number,
            full_name="API Student",
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
            dob=date(2005, 1, 1),
            segment_key="M_1st_year_AC_2",
        )
    )
    db_session.commit()


def test_form_submit_success(client: TestClient, db_session: Session) -> None:
    _seed_student(db_session)

    response = client.post(
        "/api/form/submit",
        json={
            "admission_number": "ADM200",
            "dob": "2005-01-01",
            "q1_raw": "Before 11 PM (early)",
            "q2_raw": "Very tidy - I like things clean and organized",
            "q3_raw": "Before 10 PM",
            "q4a_raw": "Mainly for sleeping/studying, not for hanging out",
            "q4b_raw": "Very uncomfortable",
            "q5a_raw": "Almost never",
            "q5b_raw": "Very uncomfortable",
            "q6_raw": "I need a 100% smoke-free room",
            "q7_raw": "I require an alcohol-free room",
            "q8_raw": "I am strict vegetarian and require a meat-free room",
            "q9_raw": "Budget-conscious - prefer to keep costs low",
            "q10_raw": "I prefer someone very similar to me",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["has_preferences"] is True


def test_form_submit_dob_mismatch_returns_400(client: TestClient, db_session: Session) -> None:
    _seed_student(db_session, admission_number="ADM201")

    response = client.post(
        "/api/form/submit",
        json={
            "admission_number": "ADM201",
            "dob": "2005-02-01",
            "q1_raw": "Before 11 PM (early)",
        },
    )

    assert response.status_code == 400
    payload = response.json()
    assert payload["detail"]["code"] == "dob_mismatch"


def test_form_submit_incomplete_submission_returns_400(client: TestClient, db_session: Session) -> None:
    _seed_student(db_session, admission_number="ADM205")

    response = client.post(
        "/api/form/submit",
        json={
            "admission_number": "ADM205",
            "dob": "2005-01-01",
            "q1_raw": "Before 11 PM (early)",
        },
    )

    assert response.status_code == 400
    payload = response.json()
    assert payload["detail"]["code"] == "incomplete_form_submission"


def test_segment_status_endpoint_returns_impossible(client: TestClient, db_session: Session) -> None:
    _seed_student(db_session, admission_number="ADM202")
    db_session.add(
        Student(
            admission_number="ADM203",
            full_name="Second Student",
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
            dob=date(2005, 1, 2),
            segment_key="M_1st_year_AC_2",
        )
    )
    db_session.add(
        Student(
            admission_number="ADM204",
            full_name="Third Student",
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
            dob=date(2005, 1, 3),
            segment_key="M_1st_year_AC_2",
        )
    )
    db_session.add(Room(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), room_id="A-900", segment_key="M_1st_year_AC_2", capacity=2, source="uploaded"))
    db_session.commit()

    response = client.get("/api/segments/M_1st_year_AC_2")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "Impossible"


def test_segment_status_endpoint_ready_when_no_rooms_uploaded(client: TestClient, db_session: Session) -> None:
    _seed_student(db_session, admission_number="ADM206")
    db_session.add(
        PreferenceProfile(
            admission_number="ADM206",
            has_preferences=1,
            is_active=1,
        )
    )
    db_session.commit()

    response = client.get("/api/segments/M_1st_year_AC_2")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "Ready"
    assert payload["total_capacity"] == 1


def test_segment_status_endpoint_returns_404_for_unknown_segment(client: TestClient) -> None:
    response = client.get("/api/segments/UNKNOWN")
    assert response.status_code == 404


def test_segments_list_endpoint_returns_segment_rows(client: TestClient, db_session: Session) -> None:
    _seed_student(db_session, admission_number="ADM220")

    response = client.get("/api/segments")
    assert response.status_code == 200

    payload = response.json()
    assert "segments" in payload
    assert len(payload["segments"]) == 1
    row = payload["segments"][0]
    assert row["segment_key"] == "M_1st_year_AC_2"
    assert row["room_size"] == 2


def test_segment_students_endpoint_returns_valid_invalid_missing_statuses(
    client: TestClient,
    db_session: Session,
) -> None:
    _seed_student(db_session, admission_number="ADM230")
    db_session.add_all(
        [
            Student(
                admission_number="ADM231",
                full_name="Invalid Form Student",
                gender="M",
                year_group="1st_year",
                ac_type="AC",
                room_size=2,
                dob=date(2005, 1, 2),
                segment_key="M_1st_year_AC_2",
            ),
            Student(
                admission_number="ADM232",
                full_name="Missing Form Student",
                gender="M",
                year_group="1st_year",
                ac_type="AC",
                room_size=2,
                dob=date(2005, 1, 3),
                segment_key="M_1st_year_AC_2",
            ),
        ]
    )
    db_session.add(
        PreferenceProfile(
            admission_number="ADM230",
            has_preferences=1,
            is_active=1,
        )
    )
    db_session.add(
        FormResponse(
            admission_number="ADM231",
            dob=date(2005, 1, 2),
            submitted_at=datetime.now(timezone.utc),
            validation_status="invalid",
            invalid_reason="dob_mismatch",
        )
    )
    db_session.commit()

    response = client.get("/api/segments/M_1st_year_AC_2/students")
    assert response.status_code == 200

    payload = response.json()
    rows = {row["admission_number"]: row for row in payload["students"]}
    assert rows["ADM230"]["preference_status"] == "valid"
    assert rows["ADM230"]["has_valid_preferences"] is True
    assert rows["ADM231"]["preference_status"] == "invalid"
    assert rows["ADM231"]["has_valid_preferences"] is False
    assert rows["ADM232"]["preference_status"] == "missing"
    assert rows["ADM232"]["has_valid_preferences"] is False


def test_form_status_endpoint_returns_aggregate_counts(client: TestClient, db_session: Session) -> None:
    _seed_student(db_session, admission_number="ADM240")
    db_session.add_all(
        [
            Student(
                admission_number="ADM241",
                full_name="Invalid Form Student",
                gender="M",
                year_group="1st_year",
                ac_type="AC",
                room_size=2,
                dob=date(2005, 1, 2),
                segment_key="M_1st_year_AC_2",
            ),
            Student(
                admission_number="ADM242",
                full_name="Missing Form Student",
                gender="M",
                year_group="1st_year",
                ac_type="AC",
                room_size=2,
                dob=date(2005, 1, 3),
                segment_key="M_1st_year_AC_2",
            ),
        ]
    )
    db_session.add(
        PreferenceProfile(
            admission_number="ADM240",
            has_preferences=1,
            is_active=1,
        )
    )
    db_session.add(
        FormResponse(
            admission_number="ADM241",
            dob=date(2005, 1, 2),
            submitted_at=datetime.now(timezone.utc),
            validation_status="invalid",
            invalid_reason="incomplete_form_submission",
        )
    )
    db_session.commit()

    response = client.get("/api/form/status")
    assert response.status_code == 200

    payload = response.json()
    assert payload["total_students"] == 3
    assert payload["valid_responses"] == 1
    assert payload["invalid_responses"] == 1
    assert payload["percentage_valid"] == 33.33
    assert len(payload["by_segment"]) == 1
    assert payload["by_segment"][0]["segment_key"] == "M_1st_year_AC_2"


def test_non_submitters_endpoint_returns_students_without_valid_profiles(
    client: TestClient,
    db_session: Session,
) -> None:
    _seed_student(db_session, admission_number="ADM250")
    db_session.add_all(
        [
            Student(
                admission_number="ADM251",
                full_name="Invalid Form Student",
                gender="M",
                year_group="1st_year",
                ac_type="AC",
                room_size=2,
                dob=date(2005, 1, 2),
                segment_key="M_1st_year_AC_2",
            ),
            Student(
                admission_number="ADM252",
                full_name="Missing Form Student",
                gender="M",
                year_group="1st_year",
                ac_type="AC",
                room_size=2,
                dob=date(2005, 1, 3),
                segment_key="M_1st_year_AC_2",
            ),
        ]
    )
    db_session.add(
        PreferenceProfile(
            admission_number="ADM250",
            has_preferences=1,
            is_active=1,
        )
    )
    db_session.add(
        FormResponse(
            admission_number="ADM251",
            dob=date(2005, 1, 2),
            submitted_at=datetime.now(timezone.utc),
            validation_status="invalid",
            invalid_reason="invalid_form_option",
        )
    )
    db_session.commit()

    response = client.get("/api/form/non-submitters")
    assert response.status_code == 200

    payload = response.json()
    ids = [row["admission_number"] for row in payload["non_submitters"]]
    assert payload["total_count"] == 2
    assert ids == ["ADM251", "ADM252"]
