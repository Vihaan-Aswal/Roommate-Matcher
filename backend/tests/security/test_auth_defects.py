from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi import HTTPException

from app.auth.dependencies import get_authenticated_user
from app.auth.supabase import verify_supabase_jwt
from app.config import get_settings


def _settings():
    return get_settings()


def _supabase_token(*, sub: str = "not-a-uuid") -> str:
    settings = _settings()
    return jwt.encode(
        {
            "sub": sub,
            "email": "user@example.com",
            "aud": settings.supabase_jwt_audience,
            "iss": settings.supabase_jwt_issuer,
            "role": "authenticated",
            "exp": datetime.now(UTC) + timedelta(hours=1),
        },
        settings.supabase_jwt_secret,
        algorithm="HS256",
    )


def test_asymmetric_token_with_missing_kid_is_invalid_not_500(monkeypatch) -> None:
    settings = _settings()
    monkeypatch.setattr(settings, "supabase_project_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_jwt_issuer", "https://example.supabase.co/auth/v1")

    class FailingJwksClient:
        def get_signing_key_from_jwt(self, token: str):
            raise jwt.PyJWKClientError("Unable to find a signing key that matches ''")

    monkeypatch.setattr("app.auth.supabase.get_jwks_client", lambda: FailingJwksClient())

    header = jwt.utils.base64url_encode(b'{"alg":"RS256","typ":"JWT"}').decode()
    payload = jwt.utils.base64url_encode(b'{"sub":"x"}').decode()
    token = f"{header}.{payload}.signature"

    with pytest.raises(jwt.InvalidTokenError) as error:
        verify_supabase_jwt(token)

    assert not isinstance(error.value, jwt.PyJWKClientError)


def test_supabase_token_with_non_uuid_subject_is_401(db_session) -> None:
    token = _supabase_token(sub="not-a-uuid")

    with pytest.raises(HTTPException) as error:
        import asyncio

        asyncio.run(get_authenticated_user(authorization=f"Bearer {token}", db=db_session))

    assert error.value.status_code == 401


def test_app_token_with_non_uuid_tenant_is_401(db_session) -> None:
    settings = _settings()
    token = jwt.encode(
        {
            "sub": f"demo:{uuid.uuid4()}",
            "email": "demo@example.com",
            "tenant_id": "not-a-uuid",
            "workspace_id": str(uuid.uuid4()),
            "role": "owner",
            "is_demo": True,
            "exp": datetime.now(UTC) + timedelta(hours=1),
        },
        settings.app_jwt_secret,
        algorithm="HS256",
    )

    with pytest.raises(HTTPException) as error:
        import asyncio

        asyncio.run(get_authenticated_user(authorization=f"Bearer {token}", db=db_session))

    assert error.value.status_code == 401
