import uuid
from datetime import datetime
import pytest
from sqlalchemy.orm import Session

from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.models.workspace_form_link import WorkspaceFormLink
from app.models.student import Student
from app.models.segment import Segment

@pytest.fixture
def test_setup(db_session: Session):
    tenant = Tenant(id=uuid.uuid4(), slug=f"t-{uuid.uuid4().hex[:6]}", display_name="T")
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)

    workspace = Workspace(tenant_id=tenant.id, name="W", status="draft", source="manual")
    db_session.add(workspace)
    db_session.commit()
    db_session.refresh(workspace)

    segment = Segment(tenant_id=tenant.id, workspace_id=workspace.id, segment_key="TEST", gender="M", year_group="Y1", ac_type="AC", room_size=2)
    db_session.add(segment)
    db_session.commit()
    db_session.refresh(segment)

    token = WorkspaceFormLink(tenant_id=tenant.id, workspace_id=workspace.id, public_form_token="VALID_TOKEN", is_active=True)
    db_session.add(token)
    db_session.commit()
    db_session.refresh(token)

    student = Student(
        tenant_id=tenant.id,
        workspace_id=workspace.id,
        segment_id=segment.id,
        admission_number="ADM001",
        full_name="John Doe",
        gender="M",
        year_group="Y1",
        ac_type="AC",
        room_size=2,
        dob=datetime(2000, 1, 1).date(),
        phone_number="1234567890",
        phone_last4="7890",
        is_active=True,
    )
    db_session.add(student)
    db_session.commit()
    db_session.refresh(student)

    return {"tenant": tenant, "workspace": workspace, "token": token, "student": student}
