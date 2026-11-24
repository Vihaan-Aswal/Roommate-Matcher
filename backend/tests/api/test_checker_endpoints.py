from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.services.scoring.constants import FACTOR_BASE_WEIGHTS, SCORING_FACTOR_KEYS
from app.services.scoring.types import FactorScore, PairResult
from tests.api.test_matching_endpoints import _seed_ready_segment_with_profiles


def test_checker_endpoint_returns_group_compatibility(client: TestClient, db_session: Session, seed_tenant_and_user) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    auth_headers = seed_tenant_and_user["headers"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    
    _seed_ready_segment_with_profiles(db_session, tenant_id, workspace_id)

    response = client.post(
        f"/api/workspaces/{workspace_id}/checker/compatibility",
        json={
            "segment_key": "M_1st_year_AC_2",
            "room_size": 2,
            "student_ids": ["MR001", "MR002"],
        },
        headers=auth_headers
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


def test_checker_endpoint_rejects_invalid_group_size(client: TestClient, db_session: Session, seed_tenant_and_user) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    auth_headers = seed_tenant_and_user["headers"]
    workspace_id = seed_tenant_and_user["workspace_id"]

    _seed_ready_segment_with_profiles(db_session, tenant_id, workspace_id)

    response = client.post(
        f"/api/workspaces/{workspace_id}/checker/compatibility",
        json={
            "segment_key": "M_1st_year_AC_2",
            "room_size": 2,
            "student_ids": ["MR001"],
        },
        headers=auth_headers
    )
    assert response.status_code == 400
    assert "room_size" in response.json()["detail"]


def test_checker_applies_the_excellent_safety_gate(
    client: TestClient, db_session: Session, seed_tenant_and_user, monkeypatch
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    auth_headers = seed_tenant_and_user["headers"]
    workspace_id = seed_tenant_and_user["workspace_id"]

    _seed_ready_segment_with_profiles(db_session, tenant_id, workspace_id)

    high_score_but_unsafe = PairResult(
        pair_score=0.95,
        factor_breakdown={
            key: FactorScore(
                raw_score=0.95,
                weight_used=FACTOR_BASE_WEIGHTS[key],
                missing_data=False,
            )
            for key in SCORING_FACTOR_KEYS
        },
        excellent_candidate=False,
    )
    monkeypatch.setattr(
        "app.services.orchestration.checker_workflow.compute_segment_pair_scores",
        lambda _profiles: {("MR001", "MR002"): high_score_but_unsafe},
    )

    response = client.post(
        f"/api/workspaces/{workspace_id}/checker/compatibility",
        json={
            "segment_key": "M_1st_year_AC_2",
            "room_size": 2,
            "student_ids": ["MR001", "MR002"],
        },
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    payload = response.json()

    assert {row["satisfaction_label"] for row in payload["students"]} == {"Good"}
    assert payload["group_label"] == "Good"
