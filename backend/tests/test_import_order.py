"""Import-order and limiter wiring.

`app/api/routes/auth.py` and `public_form.py` used to import `limiter` from
`app.main`, so importing either router before `app.main` raised ImportError.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_routers_import_without_importing_app_main_first() -> None:
    env = os.environ.copy()
    env["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
    env["APP_JWT_SECRET"] = "testsecret" * 4

    result = subprocess.run(
        [sys.executable, "-c", "import app.api.routes.auth, app.api.routes.public_form"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr


def test_app_main_and_rate_limit_share_one_limiter() -> None:
    import app.main
    import app.rate_limit

    assert app.main.limiter is app.rate_limit.limiter


def test_rate_limit_storage_uri_is_read_from_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import get_settings

    monkeypatch.setenv("RATE_LIMIT_STORAGE_URI", "redis://example.invalid:6379/0")
    get_settings.cache_clear()
    try:
        assert get_settings().rate_limit_storage_uri == "redis://example.invalid:6379/0"
    finally:
        get_settings.cache_clear()
