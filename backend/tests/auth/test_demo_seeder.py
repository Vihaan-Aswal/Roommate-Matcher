import uuid
from app.models.workspace import Workspace

def test_demo_endpoint_seeds_workspace(client, db_session):
    """POST /api/auth/demo should create tenant, workspace, and seed data."""
    response = client.post("/api/auth/demo", json={"email": "test@demo.com"})
    assert response.status_code == 200
    data = response.json()
    assert data["students_seeded"] > 0
    assert data["rooms_seeded"] > 0
    assert data["responses_seeded"] > 0

    # Verify workspace is marked as seeded
    ws = db_session.query(Workspace).filter_by(id=uuid.UUID(data["workspace_id"])).first()
    assert ws.is_demo_seeded is True
    assert ws.status == "active"
