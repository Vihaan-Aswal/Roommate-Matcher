from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.routes import upload as upload_routes
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


def test_upload_students_returns_structured_invalid_rows_and_report(
    client: TestClient,
    tmp_path: Path,
) -> None:
    upload_routes.ERROR_REPORT_DIR = tmp_path / "error-reports"

    content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob\n"
        "ADM301,Valid User,M,1st_year,AC,2,2005-01-01\n"
        "ADM302,Invalid User,F,1st_year,AC,2,not-a-date\n"
    )

    response = client.post(
        "/api/upload/students",
        files={"file": ("students.csv", content, "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted_rows"] == 1
    assert payload["rejected_rows"] == 1
    assert payload["invalid_rows"][0]["field"] == "dob"
    assert payload["error_report_name"] is not None

    report_response = client.get(f"/api/upload/error-reports/{payload['error_report_name']}")
    assert report_response.status_code == 200
    assert "text/csv" in report_response.headers["content-type"]


def test_upload_rooms_validates_unknown_segment_and_returns_report(
    client: TestClient,
    tmp_path: Path,
) -> None:
    upload_routes.ERROR_REPORT_DIR = tmp_path / "error-reports"

    content = "room_id,segment_key,capacity\nA-1,UNKNOWN_SEGMENT,2\n"
    response = client.post(
        "/api/upload/rooms",
        files={"file": ("rooms.csv", content, "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted_rows"] == 0
    assert payload["rejected_rows"] == 1
    assert payload["invalid_rows"][0]["reason"] == "unknown_segment"
    assert payload["error_report_name"] is not None


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
    db_session.add(Room(room_id="A-900", segment_key="M_1st_year_AC_2", capacity=2, source="uploaded"))
    db_session.commit()

    response = client.get("/api/segments/M_1st_year_AC_2")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "Impossible"


def test_segment_status_endpoint_returns_404_for_unknown_segment(client: TestClient) -> None:
    response = client.get("/api/segments/UNKNOWN")
    assert response.status_code == 404
