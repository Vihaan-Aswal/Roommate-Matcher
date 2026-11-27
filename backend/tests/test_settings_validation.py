"""Production settings fail fast, but development remains zero-config."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.config import Settings

VALID_PRODUCTION = {
    "database_url": "postgresql://user:pass@db.example.com:5432/app",
    "app_env": "production",
    "app_jwt_secret": "a" * 32,
    "supabase_jwt_secret": "supabase-jwt-secret",
    "cleanup_job_secret": "cleanup-job-secret",
    "cors_allowed_origins": ["https://roommate-matcher.vercel.app"],
}


VALID_POSTGRES_DEVELOPMENT = {
    **VALID_PRODUCTION,
    "app_env": "development",
}


def _production(**overrides: object) -> Settings:
    return Settings(**{**VALID_PRODUCTION, **overrides})


def _postgres_development(**overrides: object) -> Settings:
    return Settings(**{**VALID_POSTGRES_DEVELOPMENT, **overrides})


def test_valid_production_settings_construct() -> None:
    settings = _production()

    assert settings.app_env == "production"
    assert settings.cors_allowed_origins == ["https://roommate-matcher.vercel.app"]


@pytest.mark.parametrize(
    ("field", "value", "name"),
    [
        ("app_jwt_secret", "", "APP_JWT_SECRET"),
        ("supabase_jwt_secret", "", "SUPABASE_JWT_SECRET"),
        ("cleanup_job_secret", None, "CLEANUP_JOB_SECRET"),
    ],
)
def test_missing_production_secret_names_the_env_var(
    field: str, value: object, name: str
) -> None:
    with pytest.raises(ValidationError, match=name):
        _production(**{field: value})


@pytest.mark.parametrize("secret", ["short", "change-me", "your-secret-key"])
def test_short_or_placeholder_app_jwt_secret_is_rejected(secret: str) -> None:
    with pytest.raises(ValidationError, match="APP_JWT_SECRET"):
        _production(app_jwt_secret=secret)


@pytest.mark.parametrize(
    ("field", "value", "name"),
    [
        ("app_jwt_secret", "", "APP_JWT_SECRET"),
        ("supabase_jwt_secret", "", "SUPABASE_JWT_SECRET"),
        ("cleanup_job_secret", None, "CLEANUP_JOB_SECRET"),
    ],
)
def test_postgres_development_missing_secret_names_the_env_var(
    field: str, value: object, name: str
) -> None:
    with pytest.raises(ValidationError, match=name):
        _postgres_development(**{field: value})


def test_valid_postgres_development_config_constructs() -> None:
    settings = _postgres_development()

    assert settings.app_env == "development"
    assert settings.database_url.startswith("postgresql")


@pytest.mark.parametrize("origin", ["http://localhost:5173", "https://127.0.0.1"])
def test_production_rejects_a_localhost_cors_origin(origin: str) -> None:
    with pytest.raises(ValidationError, match="CORS_ALLOWED_ORIGINS"):
        _production(cors_allowed_origins=[origin])


def test_postgres_development_allows_localhost_cors() -> None:
    settings = _postgres_development(
        cors_allowed_origins=["http://localhost:5173"]
    )

    assert settings.cors_allowed_origins == ["http://localhost:5173"]


def test_all_violations_are_reported_together() -> None:
    with pytest.raises(ValidationError) as exc_info:
        _production(
            app_jwt_secret="",
            supabase_jwt_secret="",
            cleanup_job_secret=None,
        )

    message = str(exc_info.value)
    for name in (
        "APP_JWT_SECRET",
        "SUPABASE_JWT_SECRET",
        "CLEANUP_JOB_SECRET",
    ):
        assert name in message


def test_development_allows_empty_secrets() -> None:
    settings = Settings(
        database_url="sqlite:///x",
        app_jwt_secret="",
        supabase_jwt_secret="",
        cleanup_job_secret=None,
        cors_allowed_origins=["http://localhost:5173"],
    )

    assert settings.app_env == "development"
