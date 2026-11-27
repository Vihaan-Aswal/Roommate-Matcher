"""Integration tests for /api/auth/* endpoints using TestClient."""
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.main import app
from app.config import get_settings
from app.models.tenant import Tenant

@pytest.fixture(autouse=True)
def set_env(monkeypatch):
    monkeypatch.setenv("APP_JWT_SECRET", "test-secret-32-chars-xxxxxxxxxxx")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret-32-chars-xxxxxxxxxxx")
    monkeypatch.setenv("ADMIN_EMAILS", "")
    get_settings.cache_clear()
    yield
    # monkeypatch restores the env after this fixture; drop the cached Settings
    # object so the next module does not verify against this module's secret.
    get_settings.cache_clear()


def test_demo_endpoint_creates_session(client: TestClient):
    """POST /api/auth/demo returns a token and workspace metadata."""
    resp = client.post("/api/auth/demo", json={"email": "test@demo.com"})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert "tenant_id" in data
    assert "workspace_id" in data
    assert "expires_at" in data


def test_demo_endpoint_blocks_when_hourly_cap_reached(
    client: TestClient, db_session, monkeypatch
):
    monkeypatch.setenv("DEMO_GLOBAL_CAP_PER_HOUR", "2")
    get_settings.cache_clear()

    expires_at = datetime.now(UTC) + timedelta(hours=1)
    db_session.add_all(
        [
            Tenant(
                slug=f"demo-cap-{uuid.uuid4().hex[:6]}",
                display_name="Demo One",
                is_demo=True,
                demo_expires_at=expires_at,
            ),
            Tenant(
                slug=f"demo-cap-{uuid.uuid4().hex[:6]}",
                display_name="Demo Two",
                is_demo=True,
                demo_expires_at=expires_at,
            ),
        ]
    )
    db_session.commit()

    resp = client.post("/api/auth/demo", json={"email": "capped@demo.com"})

    assert resp.status_code == 429
    assert (
        resp.json()["detail"]
        == "The demo is busy right now. Please try again in a few minutes."
    )
    assert resp.headers["retry-after"] == "300"
    assert db_session.query(Tenant).count() == 2


def test_demo_cap_ignores_tenants_older_than_an_hour(
    client: TestClient, db_session, monkeypatch
):
    monkeypatch.setenv("DEMO_GLOBAL_CAP_PER_HOUR", "1")
    get_settings.cache_clear()

    db_session.add(
        Tenant(
            slug=f"demo-old-{uuid.uuid4().hex[:6]}",
            display_name="Old Demo",
            is_demo=True,
            demo_expires_at=datetime.now(UTC) + timedelta(days=1),
            created_at=datetime.now(UTC) - timedelta(hours=2),
        )
    )
    db_session.commit()

    resp = client.post("/api/auth/demo", json={"email": "after-old@demo.com"})

    assert resp.status_code == 200, resp.text


def test_demo_database_failure_returns_503_and_cleans_up(
    client: TestClient, db_session, monkeypatch
):
    def _fail(*args, **kwargs):
        raise SQLAlchemyError("database down")

    monkeypatch.setattr("app.api.routes.auth.seed_demo_workspace", _fail)

    resp = client.post(
        "/api/auth/demo",
        json={"email": "database-down@example.com"},
        headers={"Origin": "http://localhost:5173"},
    )

    assert resp.status_code == 503
    assert "demo database" in resp.json()["detail"].lower()
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert db_session.query(Tenant).count() == 0


def test_me_endpoint_with_demo_token(client: TestClient):
    """GET /api/auth/me returns correct context when using a demo token."""
    # First create a demo session
    demo_resp = client.post("/api/auth/demo", json={"email": "me@test.com"})
    assert demo_resp.status_code == 200
    token = demo_resp.json()["token"]

    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    me = me_resp.json()
    assert me["is_demo"] is True
    assert me["email"] == "me@test.com"
    assert me["role"] == "owner"
    assert me["auth_kind"] == "app_jwt"


def test_me_endpoint_without_token(client: TestClient):
    """GET /api/auth/me returns 401 when no token provided."""
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_endpoint_with_bad_token(client: TestClient):
    """GET /api/auth/me returns 401 for an invalid token."""
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"})
    assert resp.status_code == 401


def test_logout_endpoint(client: TestClient):
    """POST /api/auth/logout returns 204 with a valid demo token."""
    demo_resp = client.post("/api/auth/demo", json={"email": "logout@test.com"})
    token = demo_resp.json()["token"]
    resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204
