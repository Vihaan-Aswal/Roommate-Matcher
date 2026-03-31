from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.api.test_matching_endpoints import _seed_ready_segment_with_profiles


def test_checker_endpoint_returns_group_compatibility(client: TestClient, db_session: Session) -> None:
    _seed_ready_segment_with_profiles(db_session)

    response = client.post(
        "/api/checker/compatibility",
        json={
            "segment_key": "M_1st_year_AC_2",
            "room_size": 2,
            "student_ids": ["MR001", "MR002"],
        },
    )
    assert response.status_code == 200

    payload = response.json()
    assert "group_score" in payload
    assert "group_label" in payload
    assert len(payload["students"]) == 2
    assert all(len(student["reasons"]) >= 1 for student in payload["students"])
    assert all("factor_trace" in student for student in payload["students"])
    assert all(isinstance(student["factor_trace"], list) for student in payload["students"])

    for student in payload["students"]:
        for item in student["factor_trace"]:
            assert set(item.keys()) == {
                "factor_key",
                "factor_class",
                "reason_bucket",
                "polarity",
                "template_id",
                "claim_scope",
            }


def test_checker_endpoint_rejects_invalid_group_size(client: TestClient, db_session: Session) -> None:
    _seed_ready_segment_with_profiles(db_session)

    response = client.post(
        "/api/checker/compatibility",
        json={
            "segment_key": "M_1st_year_AC_2",
            "room_size": 2,
            "student_ids": ["MR001"],
        },
    )
    assert response.status_code == 400
    assert "room_size" in response.json()["detail"]
