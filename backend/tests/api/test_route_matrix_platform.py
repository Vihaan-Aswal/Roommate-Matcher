"""Route matrix for /api/platform (platform-admin only).

Only the happy/not-found branches that the existing impersonation suite does
not already exercise are covered here.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.tenant import Tenant
from app.models.tenant_membership import TenantMembership
from app.models.workspace import Workspace


@pytest.fixture
def admin_headers(monkeypatch: pytest.MonkeyPatch, db_session: Session):
    monkeypatch.setenv("ADMIN_EMAILS", "matrix-admin@platform.test")
    get_settings.cache_clear()

    admin_user_id = uuid.uuid4()
    home_tenant = Tenant(
        id=uuid.uuid4(), slug="matrix-admin-home", display_name="Matrix Admin Home"
    )
    db_session.add(home_tenant)
    db_session.flush()
    db_session.add(
        TenantMembership(
            tenant_id=home_tenant.id,
            supabase_user_id=admin_user_id,
            email="matrix-admin@platform.test",
            role="owner",
        )
    )
    db_session.commit()

    settings = get_settings()
    token = jwt.encode(
        {
            "sub": str(admin_user_id),
            "email": "matrix-admin@platform.test",
            "aud": settings.supabase_jwt_audience,
            "iss": settings.supabase_jwt_issuer,
            "role": "authenticated",
            "exp": datetime.now(UTC) + timedelta(hours=1),
        },
        settings.supabase_jwt_secret,
        algorithm="HS256",
    )
    yield {"Authorization": f"Bearer {token}"}

    monkeypatch.undo()
    get_settings.cache_clear()


@pytest.fixture
def demo_tenant(db_session: Session) -> Tenant:
    tenant = Tenant(
        id=uuid.uuid4(),
        slug="matrix-demo",
        display_name="Matrix Demo",
        is_demo=True,
        demo_expires_at=datetime.now(UTC) + timedelta(hours=1),
    )
    db_session.add(tenant)
    db_session.commit()
    return tenant


def test_get_tenant_returns_workspace_count(
    client: TestClient,
    db_session: Session,
    admin_headers,
    demo_tenant: Tenant,
) -> None:
    workspace = Workspace(tenant_id=demo_tenant.id, name="Demo WS", source="demo_seed")
    db_session.add(workspace)
    db_session.commit()

    response = client.get(f"/api/platform/tenants/{demo_tenant.id}", headers=admin_headers)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["id"] == str(demo_tenant.id)
    assert payload["workspace_count"] == 1
    assert payload["is_demo"] is True
    assert payload["demo_expires_at"] is not None


def test_get_tenant_not_found(client: TestClient, admin_headers) -> None:
    response = client.get(f"/api/platform/tenants/{uuid.uuid4()}", headers=admin_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Tenant not found."


def test_get_tenant_rejects_non_uuid(client: TestClient, admin_headers) -> None:
    response = client.get("/api/platform/tenants/not-a-uuid", headers=admin_headers)
    assert response.status_code == 422


def test_list_tenant_workspaces_not_found(client: TestClient, admin_headers) -> None:
    response = client.get(
        f"/api/platform/tenants/{uuid.uuid4()}/workspaces", headers=admin_headers
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Tenant not found."


def test_impersonate_unknown_tenant_is_404(client: TestClient, admin_headers) -> None:
    response = client.post(
        f"/api/platform/tenants/{uuid.uuid4()}/impersonate",
        headers=admin_headers,
        json={"workspace_id": str(uuid.uuid4())},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Tenant not found."


def test_impersonate_malformed_workspace_id_is_400(
    client: TestClient, admin_headers, demo_tenant: Tenant
) -> None:
    response = client.post(
        f"/api/platform/tenants/{demo_tenant.id}/impersonate",
        headers=admin_headers,
        json={"workspace_id": "not-a-uuid"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "workspace_id must be a valid UUID."


def test_platform_routes_require_authentication(client: TestClient) -> None:
    for path in (
        "/api/platform/tenants",
        f"/api/platform/tenants/{uuid.uuid4()}",
        f"/api/platform/tenants/{uuid.uuid4()}/workspaces",
    ):
        response = client.get(path)
        assert response.status_code == 401, path
