"""Route matrix for /api/workspaces: happy, invalid input, auth, not-found.

Every assertion goes through the real FastAPI dependency chain and an in-memory
SQLite session (see tests/conftest.py). No network, no sleeps.
"""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.segment import Segment
from app.models.workspace import Workspace

STUDENT_CSV_HEADER = (
    "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
)
STUDENT_CSV_ROWS = (
    "ADM900,Asha Rao,F,1st_year,AC,2,2005-01-15,9876543210\n"
    "ADM901,Bala Kumar,M,1st_year,AC,2,2005-03-22,9876543211\n"
)
ROOM_CSV_HEADER = "room_id,segment_key,capacity\n"


def _student_csv(rows: str = STUDENT_CSV_ROWS) -> bytes:
    return (STUDENT_CSV_HEADER + rows).encode("utf-8")


def _room_csv(rows: str) -> bytes:
    return (ROOM_CSV_HEADER + rows).encode("utf-8")


def test_workspace_form_link_is_stable_until_regenerated(
    client: TestClient, seed_tenant_and_user
) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]
    url = f"/api/workspaces/{workspace_id}/form-link"

    first = client.get(url, headers=headers)
    assert first.status_code == 200
    token = first.json()["token"]
    assert token

    again = client.get(url, headers=headers)
    assert again.status_code == 200
    assert again.json()["token"] == token

    regenerated = client.post(f"{url}/regenerate", headers=headers)
    assert regenerated.status_code == 200
    new_token = regenerated.json()["token"]
    assert new_token != token

    after = client.get(url, headers=headers)
    assert after.json()["token"] == new_token


def test_workspace_routes_reject_missing_token(client: TestClient, seed_tenant_and_user) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]

    for path in (
        f"/api/workspaces/{workspace_id}",
        f"/api/workspaces/{workspace_id}/dashboard",
        f"/api/workspaces/{workspace_id}/form-link",
        f"/api/workspaces/{workspace_id}/collection/status",
    ):
        response = client.get(path)
        assert response.status_code == 401, path
        assert response.headers["www-authenticate"] == "Bearer"


def test_workspace_routes_reject_foreign_or_missing_workspace(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    headers = seed_tenant_and_user["headers"]
    other_tenant_id = uuid.uuid4()
    other_workspace = Workspace(
        tenant_id=other_tenant_id, name="Not Mine", status="draft", source="manual"
    )
    # A workspace row under a tenant the caller does not belong to.
    db_session.add(other_workspace)
    db_session.commit()

    for workspace_id in (other_workspace.id, uuid.uuid4()):
        response = client.get(f"/api/workspaces/{workspace_id}", headers=headers)
        assert response.status_code == 403
        assert response.json()["detail"] == "Workspace not found or access denied."


def test_workspace_form_link_for_foreign_workspace_is_403(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    headers = seed_tenant_and_user["headers"]
    foreign = Workspace(
        tenant_id=uuid.uuid4(), name="Foreign", status="draft", source="manual"
    )
    db_session.add(foreign)
    db_session.commit()

    response = client.get(f"/api/workspaces/{foreign.id}/form-link", headers=headers)
    assert response.status_code == 403


def test_workspace_scoped_routes_reject_a_foreign_workspace(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    headers = seed_tenant_and_user["headers"]
    foreign = Workspace(
        tenant_id=uuid.uuid4(), name="Foreign Matrix", status="draft", source="manual"
    )
    db_session.add(foreign)
    db_session.commit()

    base = f"/api/workspaces/{foreign.id}"
    for path in (
        base,
        f"{base}/dashboard",
        f"{base}/form-link",
        f"{base}/collection/status",
        f"{base}/collection/non-submitters",
        f"{base}/segments",
        f"{base}/segments/ANY_SEGMENT/students",
        f"{base}/matching/runs",
        f"{base}/fairness/run_any",
        f"{base}/exports/assignments/run_any",
    ):
        response = client.get(path, headers=headers)
        assert response.status_code == 403, path
        assert response.json()["detail"] == "Workspace not found or access denied."

    for path in (f"{base}/form-link/regenerate", f"{base}/magic-fill"):
        response = client.post(path, headers=headers)
        assert response.status_code == 403, path


def test_collection_status_and_non_submitters_are_empty_for_new_workspace(
    client: TestClient, seed_tenant_and_user
) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    status = client.get(f"/api/workspaces/{workspace_id}/collection/status", headers=headers)
    assert status.status_code == 200
    assert status.json()["total_students"] == 0
    assert status.json()["percentage_valid"] == 0.0

    non_submitters = client.get(
        f"/api/workspaces/{workspace_id}/collection/non-submitters", headers=headers
    )
    assert non_submitters.status_code == 200
    assert non_submitters.json() == {"non_submitters": [], "total_count": 0}


def test_student_upload_preview_then_apply_round_trip(
    client: TestClient, seed_tenant_and_user
) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]
    url = f"/api/workspaces/{workspace_id}/students/upload"

    preview = client.post(
        f"{url}/preview",
        headers=headers,
        files={"file": ("students.csv", _student_csv(), "text/csv")},
    )
    assert preview.status_code == 200, preview.text
    preview_payload = preview.json()
    assert preview_payload["total_csv_rows"] == 2
    assert preview_payload["valid_csv_rows"] == 2
    assert preview_payload["to_insert"] == 2
    assert preview_payload["to_update"] == 0
    assert preview_payload["diff_entries"][0]["action"] == "insert"

    apply_response = client.post(
        f"{url}/apply",
        headers=headers,
        files={"file": ("students.csv", _student_csv(), "text/csv")},
    )
    assert apply_response.status_code == 200, apply_response.text
    apply_payload = apply_response.json()
    assert apply_payload["inserted"] == 2
    assert apply_payload["segments_created"] == 2
    assert apply_payload["errors"] == []

    second_preview = client.post(
        f"{url}/preview",
        headers=headers,
        files={"file": ("students.csv", _student_csv(), "text/csv")},
    )
    assert second_preview.status_code == 200
    assert second_preview.json()["unchanged"] == 2
    assert second_preview.json()["to_insert"] == 0


def test_student_upload_rejects_invalid_csv(
    client: TestClient, seed_tenant_and_user
) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]
    bad_csv = b"not_a_student_column\nvalue\n"

    preview = client.post(
        f"/api/workspaces/{workspace_id}/students/upload/preview",
        headers=headers,
        files={"file": ("students.csv", bad_csv, "text/csv")},
    )
    assert preview.status_code == 400
    assert "Missing required columns" in preview.json()["detail"]

    apply_response = client.post(
        f"/api/workspaces/{workspace_id}/students/upload/apply",
        headers=headers,
        files={"file": ("students.csv", bad_csv, "text/csv")},
    )
    assert apply_response.status_code == 400
    assert "Missing required columns" in apply_response.json()["detail"]


def test_room_upload_preview_then_apply_round_trip(
    client: TestClient, seed_tenant_and_user
) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]
    base = f"/api/workspaces/{workspace_id}"

    student_apply = client.post(
        f"{base}/students/upload/apply",
        headers=headers,
        files={"file": ("students.csv", _student_csv(), "text/csv")},
    )
    assert student_apply.status_code == 200
    segment_key = "F_1st_year_AC_2"

    rooms_csv = _room_csv(f"R-101,{segment_key},2\nR-102,{segment_key},2\n")
    preview = client.post(
        f"{base}/rooms/upload/preview",
        headers=headers,
        files={"file": ("rooms.csv", rooms_csv, "text/csv")},
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["to_insert"] == 2
    assert preview.json()["validation_errors"] == []

    apply_response = client.post(
        f"{base}/rooms/upload/apply",
        headers=headers,
        files={"file": ("rooms.csv", rooms_csv, "text/csv")},
    )
    assert apply_response.status_code == 200, apply_response.text
    assert apply_response.json()["inserted"] == 2

    second_preview = client.post(
        f"{base}/rooms/upload/preview",
        headers=headers,
        files={"file": ("rooms.csv", rooms_csv, "text/csv")},
    )
    assert second_preview.status_code == 200
    assert second_preview.json()["to_insert"] == 0
    assert second_preview.json()["unchanged"] == 2


def test_room_upload_rejects_invalid_csv(client: TestClient, seed_tenant_and_user) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]
    bad_csv = b"bad_column\nvalue\n"

    preview = client.post(
        f"/api/workspaces/{workspace_id}/rooms/upload/preview",
        headers=headers,
        files={"file": ("rooms.csv", bad_csv, "text/csv")},
    )
    assert preview.status_code == 400
    assert "Missing required columns" in preview.json()["detail"]

    apply_response = client.post(
        f"/api/workspaces/{workspace_id}/rooms/upload/apply",
        headers=headers,
        files={"file": ("rooms.csv", bad_csv, "text/csv")},
    )
    assert apply_response.status_code == 400
    assert "Missing required columns" in apply_response.json()["detail"]


def test_segments_list_is_empty_for_new_workspace(
    client: TestClient, seed_tenant_and_user
) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    response = client.get(f"/api/workspaces/{workspace_id}/segments", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"segments": []}


def test_segment_students_unknown_segment_is_404(
    client: TestClient, seed_tenant_and_user
) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    response = client.get(
        f"/api/workspaces/{workspace_id}/segments/DOES_NOT_EXIST/students",
        headers=headers,
    )
    assert response.status_code == 404
    assert "Segment not found" in response.json()["detail"]


def test_segment_students_requires_matching_workspace(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    headers = seed_tenant_and_user["headers"]
    other_workspace = Workspace(
        tenant_id=seed_tenant_and_user["tenant_id"],
        name="Sibling",
        status="draft",
        source="manual",
    )
    db_session.add(other_workspace)
    db_session.flush()
    db_session.add(
        Segment(
            tenant_id=seed_tenant_and_user["tenant_id"],
            workspace_id=other_workspace.id,
            segment_key="M_1st_year_AC_2",
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
        )
    )
    db_session.commit()

    response = client.get(
        f"/api/workspaces/{seed_tenant_and_user['workspace_id']}/segments/M_1st_year_AC_2/students",
        headers=headers,
    )
    assert response.status_code == 404


def test_magic_fill_workspace_wide_then_reports_skips(
    client: TestClient, seed_tenant_and_user
) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]
    base = f"/api/workspaces/{workspace_id}"

    client.post(
        f"{base}/students/upload/apply",
        headers=headers,
        files={"file": ("students.csv", _student_csv(), "text/csv")},
    )

    # No body at all: MagicFillRequest() is the documented default.
    first = client.post(f"{base}/magic-fill", headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["profiles_created"] == 2
    assert first.json()["students_skipped"] == 0
    assert first.json()["segment_key"] is None

    second = client.post(f"{base}/magic-fill", headers=headers, json={})
    assert second.status_code == 200
    assert second.json()["profiles_created"] == 0
    assert second.json()["students_skipped"] == 2


def test_magic_fill_segment_scoped(client: TestClient, seed_tenant_and_user) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]
    base = f"/api/workspaces/{workspace_id}"

    client.post(
        f"{base}/students/upload/apply",
        headers=headers,
        files={"file": ("students.csv", _student_csv(), "text/csv")},
    )

    response = client.post(
        f"{base}/magic-fill",
        headers=headers,
        json={"segment_key": "F_1st_year_AC_2"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["segment_key"] == "F_1st_year_AC_2"
    assert response.json()["profiles_created"] == 1


def test_magic_fill_unknown_segment_is_404(
    client: TestClient, seed_tenant_and_user
) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    response = client.post(
        f"/api/workspaces/{workspace_id}/magic-fill",
        headers=headers,
        json={"segment_key": "NOPE_1st_year_AC_2"},
    )
    assert response.status_code == 404
    assert "not found in this workspace" in response.json()["detail"]
