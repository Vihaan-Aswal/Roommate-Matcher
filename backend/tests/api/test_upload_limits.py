"""Upload size limits: every CSV upload endpoint must reject >5MB.

Two layers are exercised:
  * the declared ``Content-Length`` check (HTTP level)
  * the incremental chunk read that guards against a spoofed/absent length
    (handler level, because httpx always sets Content-Length)
"""
from __future__ import annotations

import io
import uuid

import pytest
from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.api.routes.workspaces import (
    apply_room_upload,
    apply_student_upload,
    preview_room_upload,
    preview_student_upload,
)
from app.auth.contracts import AuthenticatedUser
from app.config import MAX_CSV_UPLOAD_BYTES
from app.models.tenant import Tenant
from app.models.workspace import Workspace

_OVERSIZED = b"a" * (MAX_CSV_UPLOAD_BYTES + 1)
_UPLOAD_PATHS = (
    "students/upload/preview",
    "students/upload/apply",
    "rooms/upload/preview",
    "rooms/upload/apply",
)


def _handler_cases():
    return (
        (preview_student_upload, "student preview"),
        (apply_student_upload, "student apply"),
        (preview_room_upload, "room preview"),
        (apply_room_upload, "room apply"),
    )


@pytest.mark.parametrize("upload_path", _UPLOAD_PATHS)
def test_oversized_content_length_is_rejected_with_413(
    client: TestClient, seed_tenant_and_user, upload_path: str
) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    response = client.post(
        f"/api/workspaces/{workspace_id}/{upload_path}",
        headers={**headers, "Content-Length": str(len(_OVERSIZED))},
        files={"file": ("large.csv", b"dummy content", "text/csv")},
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "File too large. Maximum size is 5MB."


@pytest.mark.parametrize("handler,label", _handler_cases())
def test_chunked_read_rejects_oversized_body_without_content_length(
    db_session: Session, seed_tenant_and_user, handler, label: str
) -> None:
    user = AuthenticatedUser(
        auth_kind="app_jwt",
        supabase_user_id=str(uuid.uuid4()),
        email="upload@example.com",
        tenant_id=seed_tenant_and_user["tenant_id"],
        role="owner",
    )
    tenant = db_session.get(Tenant, seed_tenant_and_user["tenant_id"])
    workspace = db_session.get(Workspace, seed_tenant_and_user["workspace_id"])
    assert tenant is not None and workspace is not None

    request_without_length = Request({"type": "http", "method": "POST", "headers": []})
    upload = UploadFile(filename="large.csv", file=io.BytesIO(_OVERSIZED))

    with pytest.raises(HTTPException) as exc_info:
        handler(
            workspace_id=workspace.id,
            request=request_without_length,
            file=upload,
            db=db_session,
            workspace_ctx=(user, tenant, workspace),
        )

    assert exc_info.value.status_code == 413, label
    assert exc_info.value.detail == "File too large. Maximum size is 5MB."
