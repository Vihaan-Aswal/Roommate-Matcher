"""Role matrix: viewer tokens may read but must not write.

The gated routes are checked with a real app JWT that carries
``role="viewer"``. An owner token proves the same routes still work for
editors, and a read proves the gate is on writes only.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.tokens import issue_demo_token
from app.config import get_settings
from app.models.room import Room
from app.models.segment import Segment
from app.models.student import Student
from app.models.workspace_form_link import WorkspaceFormLink

TENANT_DETAIL = "Your role cannot modify this tenant."
WORKSPACE_DETAIL = "Your role cannot modify this workspace."


def _mint_app_token(
    *, tenant_id: uuid.UUID, workspace_id: uuid.UUID, role: str, is_demo: bool
) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": f"role:{uuid.uuid4()}",
        "email": "role-matrix@test.local",
        "tenant_id": str(tenant_id),
        "workspace_id": str(workspace_id),
        "role": role,
        "is_demo": is_demo,
        "iat": now,
        "exp": now + timedelta(hours=1),
    }
    return jwt.encode(payload, get_settings().app_jwt_secret, algorithm="HS256")


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _seed_workspace_data(db_session: Session, seed_tenant_and_user) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]

    segment = Segment(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_key="ROLE_M_1_AC_2",
        gender="M",
        year_group="1",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()

    for index in (1, 2):
        db_session.add(
            Student(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                segment_id=segment.id,
                admission_number=f"ROLE-{index}",
                full_name=f"Role Student {index}",
                gender="M",
                year_group="1",
                ac_type="AC",
                room_size=2,
                dob=datetime(2000, 1, index).date(),
                phone_number="9876500011",
                phone_last4="0011",
                is_active=True,
            )
        )

    db_session.add(
        Room(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            segment_id=segment.id,
            room_id="ROLE-R1",
            capacity=2,
            source="uploaded",
            is_active=True,
        )
    )
    db_session.add(
        WorkspaceFormLink(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            public_form_token="ROLE-TOKEN",
            is_active=True,
        )
    )
    db_session.commit()


def _write_requests(workspace_id: uuid.UUID) -> list[tuple[str, str, dict]]:
    csv_file = {"file": ("upload.csv", b"header\nvalue\n", "text/csv")}
    return [
        ("POST", "/api/workspaces", {"json": {"name": "Viewer Workspace"}}),
        (
            "POST",
            f"/api/workspaces/{workspace_id}/students/upload/preview",
            {"files": csv_file},
        ),
        (
            "POST",
            f"/api/workspaces/{workspace_id}/students/upload/apply",
            {"files": csv_file},
        ),
        (
            "POST",
            f"/api/workspaces/{workspace_id}/rooms/upload/preview",
            {"files": csv_file},
        ),
        (
            "POST",
            f"/api/workspaces/{workspace_id}/rooms/upload/apply",
            {"files": csv_file},
        ),
        ("POST", f"/api/workspaces/{workspace_id}/form-link/regenerate", {}),
        ("POST", f"/api/workspaces/{workspace_id}/magic-fill", {"json": {}}),
        (
            "POST",
            f"/api/workspaces/{workspace_id}/matching/runs",
            {"json": {"scope": "all_ready_segments", "segment_key": None}},
        ),
    ]


def test_viewer_is_forbidden_on_every_write_route(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    _seed_workspace_data(db_session, seed_tenant_and_user)
    workspace_id = seed_tenant_and_user["workspace_id"]
    viewer_token = _mint_app_token(
        tenant_id=seed_tenant_and_user["tenant_id"],
        workspace_id=workspace_id,
        role="viewer",
        is_demo=False,
    )
    headers = _bearer(viewer_token)

    for method, path, kwargs in _write_requests(workspace_id):
        expected_detail = TENANT_DETAIL if path == "/api/workspaces" else WORKSPACE_DETAIL
        response = client.request(method, path, headers=headers, **kwargs)
        assert response.status_code == 403, f"{path}: {response.status_code} {response.text}"
        assert response.json()["detail"] == expected_detail


def test_owner_can_write_while_viewer_can_still_read(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    _seed_workspace_data(db_session, seed_tenant_and_user)
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]

    owner_token = issue_demo_token(
        tenant_id=tenant_id, workspace_id=workspace_id, email="owner@test.local"
    )
    owner_write = client.post(
        f"/api/workspaces/{workspace_id}/magic-fill",
        json={},
        headers=_bearer(owner_token),
    )
    assert owner_write.status_code == 200, owner_write.text

    viewer_token = _mint_app_token(
        tenant_id=tenant_id, workspace_id=workspace_id, role="viewer", is_demo=False
    )
    viewer_read = client.get(
        f"/api/workspaces/{workspace_id}/segments", headers=_bearer(viewer_token)
    )
    assert viewer_read.status_code == 200, viewer_read.text
