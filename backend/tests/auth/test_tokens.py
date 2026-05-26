"""Tests for app JWT issue/verify round-trip."""
import uuid
from unittest.mock import patch

import jwt
import pytest

from app.auth.tokens import issue_demo_token, verify_app_token


@pytest.fixture(autouse=True)
def set_secret(monkeypatch):
    monkeypatch.setenv("APP_JWT_SECRET", "test-secret-32-chars-xxxxxxxxxxx")


def test_demo_token_round_trip():
    tenant_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    token = issue_demo_token(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        email="demo@test.com",
    )
    payload = verify_app_token(token)
    assert payload["tenant_id"] == str(tenant_id)
    assert payload["workspace_id"] == str(workspace_id)
    assert payload["email"] == "demo@test.com"
    assert payload["is_demo"] is True
    assert payload["role"] == "owner"


def test_verify_rejects_tampered_token():
    tenant_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    token = issue_demo_token(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        email="demo@test.com",
    )
    tampered = token[:-4] + "xxxx"
    with pytest.raises(jwt.InvalidTokenError):
        verify_app_token(tampered)


def test_verify_rejects_expired_token():
    from datetime import UTC, datetime, timedelta
    tenant_id = uuid.uuid4()
    token = issue_demo_token(
        tenant_id=tenant_id,
        workspace_id=uuid.uuid4(),
        email="demo@test.com",
        ttl_hours=-1,  # already expired
    )
    with pytest.raises(jwt.InvalidTokenError):
        verify_app_token(token)
