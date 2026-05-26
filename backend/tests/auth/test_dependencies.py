"""Tests for get_authenticated_user and _is_platform_admin."""
import uuid
from unittest.mock import MagicMock, patch

import jwt
import pytest

from app.auth.contracts import AuthenticatedUser


def test_is_platform_admin_matches_email(monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "admin@example.com, boss@example.com")
    from app.config import get_settings
    get_settings.cache_clear()
    from importlib import reload
    import app.auth.dependencies as deps
    reload(deps)  # re-read env
    assert deps._is_platform_admin("admin@example.com") is True
    assert deps._is_platform_admin("ADMIN@EXAMPLE.COM") is True  # case-insensitive
    assert deps._is_platform_admin("other@example.com") is False


def test_is_platform_admin_empty_allowlist(monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "")
    from app.config import get_settings
    get_settings.cache_clear()
    from importlib import reload
    import app.auth.dependencies as deps
    reload(deps)
    assert deps._is_platform_admin("admin@example.com") is False
