import uuid
import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.models.workspace import Workspace
from app.models.segment import Segment
from app.models.student import Student
from app.main import app

def test_checker_scoping(db_session: Session, client: TestClient, seed_tenant_and_user):
    tenant_id = seed_tenant_and_user["tenant_id"]
    headers = seed_tenant_and_user["headers"]

    ws1 = Workspace(tenant_id=tenant_id, name="WS 1", status="draft", source="manual")
    ws2 = Workspace(tenant_id=tenant_id, name="WS 2", status="draft", source="manual")
    db_session.add_all([ws1, ws2])
    db_session.commit()

    seg1 = Segment(
        tenant_id=tenant_id,
        workspace_id=ws1.id,
        segment_key="WS1-M-1",
        gender="M",
        year_group="Freshman",
        ac_type="Non-AC",
        room_size=2
    )
    seg2 = Segment(
        tenant_id=tenant_id,
        workspace_id=ws2.id,
        segment_key="WS1-M-1",
        gender="M",
        year_group="Freshman",
        ac_type="Non-AC",
        room_size=2
    )
    db_session.add_all([seg1, seg2])
    db_session.commit()

    import datetime
    s1_ws1 = Student(
        tenant_id=tenant_id, workspace_id=ws1.id, segment_id=seg1.id,
        admission_number="STU-1", full_name="Student 1", gender="M",
        year_group="Freshman", ac_type="Non-AC", room_size=2, dob=datetime.date(2000, 1, 1),
        phone_last4="1234", is_active=True
    )
    s2_ws1 = Student(
        tenant_id=tenant_id, workspace_id=ws1.id, segment_id=seg1.id,
        admission_number="STU-2", full_name="Student 2", gender="M",
        year_group="Freshman", ac_type="Non-AC", room_size=2, dob=datetime.date(2000, 1, 1),
        phone_last4="1234", is_active=True
    )
    s1_ws2 = Student(
        tenant_id=tenant_id, workspace_id=ws2.id, segment_id=seg2.id,
        admission_number="STU-3", full_name="Student 3", gender="M",
        year_group="Freshman", ac_type="Non-AC", room_size=2, dob=datetime.date(2000, 1, 1),
        phone_last4="1234", is_active=True
    )
    db_session.add_all([s1_ws1, s2_ws1, s1_ws2])
    db_session.commit()

    # Valid check in ws1
    response = client.post(
        f"/api/checker/{ws1.id}/compatibility",
        headers=headers,
        json={
            "segment_key": "WS1-M-1",
            "room_size": 2,
            "student_ids": ["STU-1", "STU-2"]
        }
    )
    assert response.status_code == 200

    # Invalid check crossing workspaces
    response = client.post(
        f"/api/checker/{ws1.id}/compatibility",
        headers=headers,
        json={
            "segment_key": "WS1-M-1",
            "room_size": 2,
            "student_ids": ["STU-1", "STU-3"]
        }
    )
    assert response.status_code == 404
    assert "not found in this workspace" in response.json()["detail"].lower()
