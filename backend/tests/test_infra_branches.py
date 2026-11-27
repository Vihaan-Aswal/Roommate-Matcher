"""Infrastructure branches: app wiring, DB session lifecycle, token secrets."""
from __future__ import annotations

import sqlalchemy
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.auth.tokens import issue_demo_token
from app.config import get_settings


# ---------------------------------------------------------------------------
# main.py helpers and showcase wiring
# ---------------------------------------------------------------------------


def test_showcase_exclusion_helper_handles_exact_prefix_and_relative_paths() -> None:
    from app.main import _is_showcase_excluded_path

    assert _is_showcase_excluded_path("/health") is True
    assert _is_showcase_excluded_path("health") is True
    assert _is_showcase_excluded_path("openapi.json") is True
    assert _is_showcase_excluded_path("/api") is True
    assert _is_showcase_excluded_path("/api/workspaces") is True
    assert _is_showcase_excluded_path("/docs") is True
    assert _is_showcase_excluded_path("/static/app.js") is True
    assert _is_showcase_excluded_path("/admin/dashboard") is False
    assert _is_showcase_excluded_path("/") is False


def test_is_within_directory_rejects_siblings(tmp_path: Path) -> None:
    from app.main import _is_within_directory

    dist = tmp_path / "dist"
    dist.mkdir()
    inside = dist / "index.html"
    inside.write_text("ok", encoding="utf-8")
    outside = tmp_path / "secret.txt"
    outside.write_text("nope", encoding="utf-8")

    assert _is_within_directory(inside, dist) is True
    assert _is_within_directory(outside, dist) is False


def test_showcase_serves_root_and_dist_files_without_assets_dir(tmp_path: Path) -> None:
    from app.main import create_app

    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html>root-index</html>", encoding="utf-8")
    (dist / "manifest.json").write_text('{"name": "showcase"}', encoding="utf-8")

    app = create_app(frontend_dist_dir=dist)
    client = TestClient(app)

    root = client.get("/")
    assert root.status_code == 200
    assert "root-index" in root.text

    asset = client.get("/manifest.json")
    assert asset.status_code == 200
    assert "showcase" in asset.text

    fallback = client.get("/deep/unknown/route")
    assert "root-index" in fallback.text


# ---------------------------------------------------------------------------
# database.py
# ---------------------------------------------------------------------------


def test_get_db_yields_a_session_and_closes_it() -> None:
    from app.database import get_db

    generator = get_db()
    session = next(generator)
    assert hasattr(session, "close")
    generator.close()


def test_database_engine_adds_postgres_pool_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.config
    import app.database

    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg2://user:pass@localhost/db")
    monkeypatch.setenv("CLEANUP_JOB_SECRET", "test-cleanup-secret-32-characters-long")
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", '["https://example.com"]')
    app.config.get_settings.cache_clear()
    captured: dict[str, object] = {}
    real_create_engine = sqlalchemy.create_engine

    def _capture(url: str, **kwargs):
        captured["url"] = url
        captured["kwargs"] = kwargs
        return real_create_engine("sqlite+pysqlite:///:memory:")

    monkeypatch.setattr(sqlalchemy, "create_engine", _capture)
    source = Path(app.database.__file__).read_text(encoding="utf-8")

    try:
        exec(compile(source, app.database.__file__, "exec"), {})
    finally:
        app.config.get_settings.cache_clear()

    assert str(captured["url"]).startswith("postgresql")
    kwargs = captured["kwargs"]
    assert kwargs["pool_size"] == 5
    assert kwargs["max_overflow"] == 10


# ---------------------------------------------------------------------------
# token secrets must be configured
# ---------------------------------------------------------------------------


def test_app_tokens_require_a_configured_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_JWT_SECRET", "")
    get_settings.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="APP_JWT_SECRET is not set"):
            issue_demo_token(
                tenant_id=uuid.uuid4(), workspace_id=uuid.uuid4(), email="x@example.com"
            )
    finally:
        get_settings.cache_clear()


def test_impersonation_requires_a_configured_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services.platform.impersonation import _secret

    monkeypatch.setenv("APP_JWT_SECRET", "")
    get_settings.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="APP_JWT_SECRET is not set"):
            _secret()
    finally:
        get_settings.cache_clear()


# ---------------------------------------------------------------------------
# public form token service rollback
# ---------------------------------------------------------------------------


class _EmptyScalars:
    def first(self):
        return None


class _FailingSession:
    def __init__(self) -> None:
        self.rolled_back = False
        self.added: list[object] = []

    def scalars(self, *_args, **_kwargs):
        return _EmptyScalars()

    def add(self, obj) -> None:
        self.added.append(obj)

    def flush(self) -> None:
        return None

    def commit(self) -> None:
        raise RuntimeError("commit failed")

    def rollback(self) -> None:
        self.rolled_back = True


def test_regenerate_token_rolls_back_on_failure() -> None:
    from app.services.public_form.token_service import regenerate_token

    session = _FailingSession()

    with pytest.raises(RuntimeError, match="commit failed"):
        regenerate_token(session, uuid.uuid4(), uuid.uuid4())

    assert session.rolled_back is True
    assert session.added, "the new link row must be added before the failed commit"


# ---------------------------------------------------------------------------
# demo seed missing files
# ---------------------------------------------------------------------------


def test_demo_seed_requires_all_fixture_files(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    from app.services.demo_seed import service as demo_seed

    missing = tmp_path / "does-not-exist.csv"
    monkeypatch.setattr(demo_seed, "STUDENTS_CSV", missing)
    monkeypatch.setattr(demo_seed, "ROOMS_CSV", missing)
    monkeypatch.setattr(demo_seed, "FORM_RESPONSES_CSV", missing)

    with pytest.raises(FileNotFoundError, match="Demo seed file not found"):
        demo_seed.seed_demo_workspace(None, uuid.uuid4(), uuid.uuid4())
