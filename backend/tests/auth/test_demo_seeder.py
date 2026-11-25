import uuid
from sqlalchemy import func, select

from app.models.form_response import FormResponse
from app.models.preference_profile import PreferenceProfile
from app.models.room import Room
from app.models.student import Student
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


def test_demo_seed_produces_the_exact_demo_dataset(client, db_session):
    response = client.post("/api/auth/demo", json={"email": "test@demo.com"})
    assert response.status_code == 200
    data = response.json()
    workspace_id = uuid.UUID(data["workspace_id"])

    assert (data["students_seeded"], data["rooms_seeded"], data["responses_seeded"]) == (
        96,
        38,
        96,
    )

    def count(model, *conditions):
        return db_session.scalar(
            select(func.count()).select_from(model).where(*conditions)
        )

    assert count(
        Student,
        Student.workspace_id == workspace_id,
        Student.is_active == True,
    ) == 96
    assert count(
        Room,
        Room.workspace_id == workspace_id,
        Room.is_active == True,
    ) == 38
    assert count(
        FormResponse,
        FormResponse.workspace_id == workspace_id,
        FormResponse.validation_status == "valid",
    ) == 96
    assert count(
        FormResponse,
        FormResponse.workspace_id == workspace_id,
        FormResponse.validation_status == "invalid",
    ) == 0
    assert count(
        PreferenceProfile,
        PreferenceProfile.workspace_id == workspace_id,
    ) == 96
    assert count(
        PreferenceProfile,
        PreferenceProfile.workspace_id == workspace_id,
        PreferenceProfile.is_active == True,
    ) == 96

    profiles = db_session.scalars(
        select(PreferenceProfile).where(PreferenceProfile.workspace_id == workspace_id)
    ).all()
    assert all(profile.has_preferences for profile in profiles)
    assert all(profile.source_form_response_id is not None for profile in profiles)
    assert all(profile.q1_enc is not None for profile in profiles)
