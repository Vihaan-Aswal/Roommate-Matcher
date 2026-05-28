from collections.abc import Generator
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["APP_JWT_SECRET"] = "testsecret" * 4
os.environ["SUPABASE_JWT_SECRET"] = "testsecret" * 4

import app.models  # noqa: F401
from app.database import get_db
from app.main import app
from app.models.base import Base
from app.models.student import Student
from app.models.segment import Segment
from app.models.room import Room
from app.models.preference_profile import PreferenceProfile
from app.models.room_assignment import RoomAssignment
from app.models.pair_score import PairScore
from app.models.form_response import FormResponse
from sqlalchemy.orm import synonym, column_property
from sqlalchemy import select

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)

    session_local = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = session_local()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def _override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


import uuid
import os
from typing import Any
from app.auth.tokens import issue_demo_token
from app.models.tenant import Tenant
from app.models.tenant_membership import TenantMembership

@pytest.fixture(autouse=True)
def setup_env():
    os.environ["APP_JWT_SECRET"] = "testsecret" * 4
    os.environ["SUPABASE_JWT_SECRET"] = "testsecret" * 4

@pytest.fixture
def seed_tenant_and_user(db_session: Session) -> dict[str, Any]:
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    print(f"DEBUG IN FIXTURE: tenant={tenant_id}, workspace={workspace_id}")
    
    tenant = Tenant(id=tenant_id, slug="test-tenant", display_name="Test Tenant")
    db_session.add(tenant)
    db_session.flush()
    
    membership = TenantMembership(
        tenant_id=tenant_id,
        supabase_user_id=user_id,
        email="test@example.com",
        role="owner"
    )
    db_session.add(membership)

    from app.models.workspace import Workspace
    workspace = Workspace(id=workspace_id, tenant_id=tenant_id, name="Test Workspace")
    db_session.add(workspace)

    db_session.commit()
    
    token = issue_demo_token(tenant_id=tenant_id, workspace_id=workspace_id, email="test@example.com")
    
    return {
        "tenant_id": tenant_id,
        "workspace_id": workspace_id,
        "supabase_user_id": user_id,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"}
    }
