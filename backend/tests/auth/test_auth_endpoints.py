"""Integration tests for /api/auth/* endpoints using TestClient."""
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import get_settings

@pytest.fixture(autouse=True)
def set_env(monkeypatch):
    monkeypatch.setenv("APP_JWT_SECRET", "test-secret-32-chars-xxxxxxxxxxx")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret-32-chars-xxxxxxxxxxx")
    monkeypatch.setenv("ADMIN_EMAILS", "")
    get_settings.cache_clear()

client = TestClient(app)


def test_demo_endpoint_creates_session():
    """POST /api/auth/demo returns a token and workspace metadata."""
    resp = client.post("/api/auth/demo", json={"email": "test@demo.com"})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert "tenant_id" in data
    assert "workspace_id" in data
    assert "expires_at" in data


def test_me_endpoint_with_demo_token():
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


def test_me_endpoint_without_token():
    """GET /api/auth/me returns 401 when no token provided."""
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_endpoint_with_bad_token():
    """GET /api/auth/me returns 401 for an invalid token."""
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"})
    assert resp.status_code == 401


def test_logout_endpoint():
    """POST /api/auth/logout returns 204 with a valid demo token."""
    demo_resp = client.post("/api/auth/demo", json={"email": "logout@test.com"})
    token = demo_resp.json()["token"]
    resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204
