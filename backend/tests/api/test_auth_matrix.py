"""Auth matrix: token parsing, token types, tenant/workspace gates, provider modes.

Covers both auth endpoints (via TestClient) and the JWT verification layer
directly. Everything is local: no Supabase calls, no JWKS fetch - the JWKS
client is replaced with an offline double only where a real fetch would occur.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.supabase import (
    get_jwks_client,
    verify_supabase_jwt,
)
from app.auth.tokens import issue_demo_token
from app.config import get_settings
from app.models.tenant import Tenant
from app.models.tenant_membership import TenantMembership

SUPABASE_SECRET = "testsecret" * 4
SUPABASE_ISSUER = "https://test.supabase.co/auth/v1"


def _supabase_token(
    *,
    user_id: uuid.UUID | str | None = None,
    email: str = "member@example.com",
    expires_in: timedelta = timedelta(hours=1),
    secret: str = SUPABASE_SECRET,
) -> str:
    settings = get_settings()
    return jwt.encode(
        {
            "sub": str(user_id or uuid.uuid4()),
            "email": email,
            "aud": settings.supabase_jwt_audience,
            "iss": settings.supabase_jwt_issuer,
            "role": "authenticated",
            "exp": datetime.now(UTC) + expires_in,
        },
        secret,
        algorithm="HS256",
    )


def _add_membership(db_session: Session, user_id: uuid.UUID, email: str) -> Tenant:
    tenant = Tenant(id=uuid.uuid4(), slug=f"auth-{uuid.uuid4().hex[:6]}", display_name="Auth Tenant")
    db_session.add(tenant)
    db_session.flush()
    db_session.add(
        TenantMembership(
            tenant_id=tenant.id,
            supabase_user_id=user_id,
            email=email,
            role="owner",
        )
    )
    db_session.commit()
    return tenant


@pytest.fixture
def admin_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ADMIN_EMAILS", "root@example.com")
    get_settings.cache_clear()
    yield
    monkeypatch.undo()
    get_settings.cache_clear()


# ---------------------------------------------------------------------------
# /api/auth/me - header parsing and token kinds
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("authorization", "detail"),
    [
        ("Token abc", "Missing or malformed Authorization header"),
        ("Bearer", "Missing or malformed Authorization header"),
        ("Bearer ", "Bearer token is empty."),
        ("Bearer not-a-jwt", "Token is invalid or expired."),
    ],
)
def test_me_rejects_malformed_authorization(
    client: TestClient, authorization: str, detail: str
) -> None:
    response = client.get("/api/auth/me", headers={"Authorization": authorization})
    assert response.status_code == 401
    assert detail in response.json()["detail"]
    assert response.headers["www-authenticate"] == "Bearer"


def test_me_with_supabase_token_returns_supabase_context(
    client: TestClient, db_session: Session
) -> None:
    user_id = uuid.uuid4()
    _add_membership(db_session, user_id, "member@example.com")

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {_supabase_token(user_id=user_id)}"},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["auth_kind"] == "supabase"
    assert payload["supabase_user_id"] == str(user_id)
    assert payload["is_demo"] is False
    assert payload["impersonated_tenant_id"] is None


def test_me_with_impersonation_token_exposes_impersonated_tenant(
    client: TestClient, db_session: Session
) -> None:
    admin_id = uuid.uuid4()
    tenant = _add_membership(db_session, admin_id, "admin@example.com")
    workspace_id = uuid.uuid4()

    settings = get_settings()
    token = jwt.encode(
        {
            "sub": f"impersonate:{admin_id}",
            "email": "admin@example.com",
            "tenant_id": str(tenant.id),
            "workspace_id": str(workspace_id),
            "role": "owner",
            "is_demo": False,
            "impersonated_tenant": str(tenant.id),
            "exp": datetime.now(UTC) + timedelta(hours=1),
        },
        settings.app_jwt_secret,
        algorithm="HS256",
    )

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["auth_kind"] == "app_jwt"
    assert payload["impersonated_tenant_id"] == str(tenant.id)


# ---------------------------------------------------------------------------
# /api/auth/session
# ---------------------------------------------------------------------------


def test_session_exchange_rejects_invalid_supabase_token(client: TestClient) -> None:
    response = client.post("/api/auth/session", json={"access_token": "garbage"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired Supabase token."


def test_session_exchange_requires_membership(client: TestClient) -> None:
    response = client.post(
        "/api/auth/session", json={"access_token": _supabase_token()}
    )
    assert response.status_code == 403
    assert "No tenant membership found" in response.json()["detail"]


def test_session_exchange_returns_session_metadata(
    client: TestClient, db_session: Session
) -> None:
    user_id = uuid.uuid4()
    tenant = _add_membership(db_session, user_id, "member@example.com")

    response = client.post(
        "/api/auth/session",
        json={"access_token": _supabase_token(user_id=user_id)},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "supabase_user_id": str(user_id),
        "email": "member@example.com",
        "tenant_id": str(tenant.id),
        "role": "owner",
        "is_platform_admin": False,
    }


def test_session_exchange_flags_allowlisted_admin(
    client: TestClient, db_session: Session, admin_env
) -> None:
    user_id = uuid.uuid4()
    _add_membership(db_session, user_id, "root@example.com")

    response = client.post(
        "/api/auth/session",
        json={"access_token": _supabase_token(user_id=user_id, email="root@example.com")},
    )
    assert response.status_code == 200
    assert response.json()["is_platform_admin"] is True


def test_platform_admin_gate_rejects_impersonation_tokens(
    client: TestClient, db_session: Session, admin_env
) -> None:
    admin_id = uuid.uuid4()
    tenant = _add_membership(db_session, admin_id, "root@example.com")
    settings = get_settings()
    token = jwt.encode(
        {
            "sub": f"impersonate:{admin_id}",
            "email": "root@example.com",
            "tenant_id": str(tenant.id),
            "workspace_id": str(uuid.uuid4()),
            "role": "owner",
            "is_demo": False,
            "impersonated_tenant": str(tenant.id),
            "exp": datetime.now(UTC) + timedelta(hours=1),
        },
        settings.app_jwt_secret,
        algorithm="HS256",
    )

    response = client.get(
        "/api/platform/tenants", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Platform administrator access required."


# ---------------------------------------------------------------------------
# /api/auth/logout & /api/auth/demo
# ---------------------------------------------------------------------------


def test_logout_accepts_supabase_sessions(client: TestClient, db_session: Session) -> None:
    user_id = uuid.uuid4()
    _add_membership(db_session, user_id, "member@example.com")

    response = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {_supabase_token(user_id=user_id)}"},
    )
    assert response.status_code == 204
    assert response.content == b""


def test_demo_session_survives_missing_seed_files(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _missing_seed(*args, **kwargs):
        raise FileNotFoundError("demo-data is not deployed")

    monkeypatch.setattr("app.api.routes.auth.seed_demo_workspace", _missing_seed)

    response = client.post("/api/auth/demo", json={"email": "seedless@example.com"})
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["students_seeded"] == 0
    assert payload["rooms_seeded"] == 0
    assert payload["responses_seeded"] == 0
    assert payload["token"]


# ---------------------------------------------------------------------------
# Tenant/workspace guards reached through a real route
# ---------------------------------------------------------------------------


def test_token_for_missing_tenant_is_404(client: TestClient) -> None:
    token = issue_demo_token(
        tenant_id=uuid.uuid4(), workspace_id=uuid.uuid4(), email="ghost@example.com"
    )
    response = client.get(
        "/api/workspaces", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


def test_expired_app_token_is_401(client: TestClient) -> None:
    token = issue_demo_token(
        tenant_id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        email="expired@example.com",
        ttl_hours=-1,
    )
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# app/auth/supabase.py - verification modes and client caching
# ---------------------------------------------------------------------------


def _stub_settings(**overrides) -> SimpleNamespace:
    base = {
        "supabase_jwt_secret": SUPABASE_SECRET,
        "supabase_jwt_issuer": SUPABASE_ISSUER,
        "supabase_jwt_audience": "authenticated",
        "supabase_project_url": "https://test.supabase.co",
        "supabase_anon_key": "anon-key",
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_verify_supabase_jwt_rejects_malformed_token() -> None:
    with pytest.raises(jwt.InvalidTokenError):
        verify_supabase_jwt("this-is-not-a-jwt")


def test_verify_supabase_jwt_hs256_round_trip(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.auth.supabase.get_settings", lambda: _stub_settings())
    user_id = uuid.uuid4()

    payload = verify_supabase_jwt(_supabase_token(user_id=user_id))

    assert payload["sub"] == str(user_id)
    assert payload["email"] == "member@example.com"


def test_verify_supabase_jwt_rejects_wrong_issuer(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.auth.supabase.get_settings",
        lambda: _stub_settings(supabase_jwt_issuer="https://other.supabase.co/auth/v1"),
    )
    with pytest.raises(jwt.InvalidTokenError):
        verify_supabase_jwt(_supabase_token())


def test_verify_supabase_jwt_requires_configured_hs256(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.auth.supabase.get_settings",
        lambda: _stub_settings(supabase_jwt_secret=""),
    )
    with pytest.raises(jwt.InvalidTokenError, match="not configured"):
        verify_supabase_jwt(_supabase_token())


def test_verify_supabase_jwt_requires_configured_asymmetric_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.auth.supabase.get_settings",
        lambda: _stub_settings(supabase_project_url=""),
    )
    rsa_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": "member@example.com",
            "aud": "authenticated",
            "iss": SUPABASE_ISSUER,
            "exp": datetime.now(UTC) + timedelta(hours=1),
        },
        rsa_key,
        algorithm="RS256",
    )

    with pytest.raises(jwt.InvalidTokenError, match="not configured"):
        verify_supabase_jwt(token)


def test_verify_supabase_jwt_uses_jwks_for_asymmetric_tokens(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    rsa_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    user_id = uuid.uuid4()
    token = jwt.encode(
        {
            "sub": str(user_id),
            "email": "member@example.com",
            "aud": "authenticated",
            "iss": SUPABASE_ISSUER,
            "exp": datetime.now(UTC) + timedelta(hours=1),
        },
        rsa_key,
        algorithm="RS256",
        headers={"kid": "test-key"},
    )

    class _FakeJWKS:
        def __init__(self) -> None:
            self.requested: list[str] = []

        def get_signing_key_from_jwt(self, raw_token: str):
            self.requested.append(raw_token)
            return SimpleNamespace(key=rsa_key.public_key())

    fake = _FakeJWKS()
    monkeypatch.setattr("app.auth.supabase.get_settings", lambda: _stub_settings())
    monkeypatch.setattr("app.auth.supabase.get_jwks_client", lambda: fake)

    payload = verify_supabase_jwt(token)

    assert payload["sub"] == str(user_id)
    assert fake.requested == [token]


def test_get_jwks_client_is_cached_and_points_at_project(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created: list[str] = []

    class _FakeClient:
        def __init__(self, url: str) -> None:
            created.append(url)

    monkeypatch.setattr("app.auth.supabase.PyJWKClient", _FakeClient)
    monkeypatch.setattr("app.auth.supabase._jwks_client", None)
    monkeypatch.setattr("app.auth.supabase.get_settings", lambda: _stub_settings())

    first = get_jwks_client()
    second = get_jwks_client()

    assert first is second
    assert created == ["https://test.supabase.co/auth/v1/.well-known/jwks.json"]


def test_verify_supabase_jwt_wraps_jwks_client_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    rsa_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": "member@example.com",
            "aud": "authenticated",
            "iss": SUPABASE_ISSUER,
            "exp": datetime.now(UTC) + timedelta(hours=1),
        },
        rsa_key,
        algorithm="RS256",
        headers={"kid": "missing-key"},
    )

    class _BrokenJWKS:
        def get_signing_key_from_jwt(self, raw_token: str):
            raise jwt.PyJWKClientError("no matching key")

    monkeypatch.setattr("app.auth.supabase.get_settings", lambda: _stub_settings())
    monkeypatch.setattr("app.auth.supabase.get_jwks_client", lambda: _BrokenJWKS())

    with pytest.raises(jwt.InvalidTokenError, match="Unable to resolve signing key"):
        verify_supabase_jwt(token)
