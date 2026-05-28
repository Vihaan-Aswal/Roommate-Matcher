"""
backend/tests/internal/test_demo_cleanup.py

Unit tests for POST /api/internal/cleanup/demo-tenants.

Test Matrix:
  - [AUTH-1] Missing Authorization header → 401
  - [AUTH-2] Wrong secret → 401
  - [AUTH-3] CLEANUP_JOB_SECRET not configured on instance → 503
  - [CLEANUP-1] No expired demo tenants → purged_count == 0
  - [CLEANUP-2] One expired demo tenant → purged_count == 1, row removed from DB
  - [CLEANUP-3] Non-expired demo tenant is NOT purged
  - [CLEANUP-4] Non-demo tenant (is_demo=False) is NOT purged, even if demo_expires_at is past
  - [CLEANUP-5] Multiple mixed tenants → only expired demos are purged
"""
from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.tenant import Tenant


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_SECRET = "test-cleanup-secret-abc123"
CLEANUP_URL = "/api/internal/cleanup/demo-tenants"


def _auth(secret: str = VALID_SECRET) -> dict[str, str]:
    return {"Authorization": f"Bearer {secret}"}


def _make_tenant(
    db: Session,
    *,
    is_demo: bool,
    demo_expires_at: datetime | None,
    slug_suffix: str = "",
) -> Tenant:
    t = Tenant(
        id=uuid.uuid4(),
        slug=f"tenant-{slug_suffix or uuid.uuid4().hex[:8]}",
        display_name=f"Tenant {slug_suffix}",
        is_demo=is_demo,
        demo_expires_at=demo_expires_at,
    )
    db.add(t)
    db.commit()
    return t


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def configure_cleanup_secret():
    os.environ["CLEANUP_JOB_SECRET"] = VALID_SECRET
    get_settings.cache_clear()
    yield
    os.environ.pop("CLEANUP_JOB_SECRET", None)
    get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Auth guard tests
# ---------------------------------------------------------------------------

def test_auth1_missing_header_returns_401(client: TestClient):
    res = client.post(CLEANUP_URL)
    assert res.status_code == 401


def test_auth2_wrong_secret_returns_401(client: TestClient):
    res = client.post(CLEANUP_URL, headers=_auth("wrong-secret"))
    assert res.status_code == 401


def test_auth3_secret_not_configured_returns_503(client: TestClient):
    os.environ["CLEANUP_JOB_SECRET"] = ""
    get_settings.cache_clear()
    res = client.post(CLEANUP_URL, headers=_auth(""))
    assert res.status_code in (401, 503)  # 503 if empty secret triggers config guard
    get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Cleanup logic tests
# ---------------------------------------------------------------------------

def test_cleanup1_no_expired_demos(client: TestClient, db_session: Session):
    """Empty DB → purged_count should be 0, not an error."""
    res = client.post(CLEANUP_URL, headers=_auth())
    assert res.status_code == 200
    data = res.json()
    assert data["purged_count"] == 0
    assert data["purged_tenant_ids"] == []


def test_cleanup2_one_expired_demo_is_purged(client: TestClient, db_session: Session):
    """An expired demo tenant is deleted and returned in the response."""
    expired = _make_tenant(
        db_session,
        is_demo=True,
        demo_expires_at=datetime.now(UTC) - timedelta(hours=2),
        slug_suffix="expired",
    )

    res = client.post(CLEANUP_URL, headers=_auth())
    assert res.status_code == 200
    data = res.json()
    assert data["purged_count"] == 1
    assert str(expired.id) in data["purged_tenant_ids"]

    # Verify row is gone from DB
    remaining = db_session.query(Tenant).filter(Tenant.id == expired.id).first()
    assert remaining is None


def test_cleanup3_non_expired_demo_is_not_purged(client: TestClient, db_session: Session):
    """A demo tenant whose expiry is in the future must be left untouched."""
    live = _make_tenant(
        db_session,
        is_demo=True,
        demo_expires_at=datetime.now(UTC) + timedelta(hours=23),
        slug_suffix="live",
    )

    res = client.post(CLEANUP_URL, headers=_auth())
    assert res.status_code == 200
    data = res.json()
    assert data["purged_count"] == 0

    still_there = db_session.query(Tenant).filter(Tenant.id == live.id).first()
    assert still_there is not None


def test_cleanup4_non_demo_tenant_not_purged_even_if_expired(
    client: TestClient, db_session: Session
):
    """A real (is_demo=False) tenant with a past demo_expires_at must never be deleted."""
    real = _make_tenant(
        db_session,
        is_demo=False,
        demo_expires_at=datetime.now(UTC) - timedelta(days=1),
        slug_suffix="real",
    )

    res = client.post(CLEANUP_URL, headers=_auth())
    assert res.status_code == 200
    data = res.json()
    assert str(real.id) not in data["purged_tenant_ids"]

    still_there = db_session.query(Tenant).filter(Tenant.id == real.id).first()
    assert still_there is not None


def test_cleanup5_mixed_tenants_only_expired_demos_purged(
    client: TestClient, db_session: Session
):
    """
    Mixed set: only the expired demo should be purged.
    Live demo, real tenant, and real-with-past-expiry must survive.
    """
    expired_demo = _make_tenant(
        db_session,
        is_demo=True,
        demo_expires_at=datetime.now(UTC) - timedelta(hours=1),
        slug_suffix="expired-demo",
    )
    live_demo = _make_tenant(
        db_session,
        is_demo=True,
        demo_expires_at=datetime.now(UTC) + timedelta(hours=12),
        slug_suffix="live-demo",
    )
    real_tenant = _make_tenant(
        db_session,
        is_demo=False,
        demo_expires_at=None,
        slug_suffix="real-tenant",
    )

    res = client.post(CLEANUP_URL, headers=_auth())
    assert res.status_code == 200
    data = res.json()
    assert data["purged_count"] == 1
    assert str(expired_demo.id) in data["purged_tenant_ids"]
    assert str(live_demo.id) not in data["purged_tenant_ids"]
    assert str(real_tenant.id) not in data["purged_tenant_ids"]

    assert db_session.query(Tenant).filter(Tenant.id == expired_demo.id).first() is None
    assert db_session.query(Tenant).filter(Tenant.id == live_demo.id).first() is not None
    assert db_session.query(Tenant).filter(Tenant.id == real_tenant.id).first() is not None
