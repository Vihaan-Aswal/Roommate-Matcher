import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.workspace_form_link import WorkspaceFormLink
from app.models.workspace import Workspace
from app.models.student import Student
from app.models.form_response import FormResponse
from app.models.preference_profile import PreferenceProfile
from app.services.ingestion.form_response import (
    _normalize_raw_answers,
    _validate_answer_options,
    _find_missing_answer_keys,
    _build_encoded_answers,
    _latest_valid_profile,
    _deactivate_active_profiles,
)

router = APIRouter()


class PublicFormSubmitPayload(BaseModel):
    submitted_admission_number: str
    submitted_phone_last4: str
    answers: dict[str, str | None]


@router.get("/{public_form_token}")
def get_public_form(public_form_token: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    link = db.scalars(
        select(WorkspaceFormLink).where(
            WorkspaceFormLink.public_form_token == public_form_token,
            WorkspaceFormLink.is_active == True,
        )
    ).first()

    if not link:
        return {"token_valid": False}

    workspace = db.get(Workspace, link.workspace_id)
    if not workspace:
        return {"token_valid": False}

    return {
        "workspace_display_name": workspace.name,
        "property_label": None,
        "is_open": True,
        "token_valid": True,
    }


@router.post("/{public_form_token}/submit")
def submit_public_form(
    public_form_token: str,
    payload: PublicFormSubmitPayload,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    link = db.scalars(
        select(WorkspaceFormLink).where(
            WorkspaceFormLink.public_form_token == public_form_token,
            WorkspaceFormLink.is_active == True,
        )
    ).first()

    if not link:
        raise HTTPException(status_code=400, detail={"error": "form_link_invalid"})

    workspace_id = link.workspace_id
    tenant_id = link.tenant_id

    student = db.scalars(
        select(Student).where(
            Student.workspace_id == workspace_id,
            Student.admission_number == payload.submitted_admission_number,
            Student.is_active == True,
        )
    ).first()

    submitted_at = datetime.now(timezone.utc).replace(tzinfo=None)

    normalized_answers = _normalize_raw_answers(payload.answers)

    if not student:
        db.add(
            FormResponse(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                student_id=None,
                submitted_admission_number=payload.submitted_admission_number,
                submitted_phone_last4=payload.submitted_phone_last4,
                submitted_at=submitted_at,
                validation_status="invalid",
                invalid_reason="student_not_found",
                **normalized_answers,
            )
        )
        db.commit()
        return {"status": "recorded", "valid": False, "error": "student_not_found"}

    if student.phone_last4 != payload.submitted_phone_last4:
        db.add(
            FormResponse(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                student_id=student.id,
                submitted_admission_number=payload.submitted_admission_number,
                submitted_phone_last4=payload.submitted_phone_last4,
                submitted_at=submitted_at,
                validation_status="invalid",
                invalid_reason="phone_mismatch",
                **normalized_answers,
            )
        )
        db.commit()
        return {"status": "recorded", "valid": False, "error": "phone_mismatch"}

    option_validation = _validate_answer_options(normalized_answers)
    missing_answer_keys = _find_missing_answer_keys(normalized_answers)

    if missing_answer_keys:
        db.add(
            FormResponse(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                student_id=student.id,
                submitted_admission_number=payload.submitted_admission_number,
                submitted_phone_last4=payload.submitted_phone_last4,
                submitted_at=submitted_at,
                validation_status="invalid",
                invalid_reason="incomplete_form_submission",
                **normalized_answers,
            )
        )
        db.commit()
        return {"status": "recorded", "valid": False, "error": "incomplete_form_submission"}

    if not option_validation.is_valid:
        db.add(
            FormResponse(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                student_id=student.id,
                submitted_admission_number=payload.submitted_admission_number,
                submitted_phone_last4=payload.submitted_phone_last4,
                submitted_at=submitted_at,
                validation_status="invalid",
                invalid_reason=option_validation.invalid_reason,
                **normalized_answers,
            )
        )
        db.commit()
        return {"status": "recorded", "valid": False, "error": "invalid_form_option"}

    form_response = FormResponse(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        student_id=student.id,
        submitted_admission_number=payload.submitted_admission_number,
        submitted_phone_last4=payload.submitted_phone_last4,
        submitted_at=submitted_at,
        validation_status="valid",
        invalid_reason=None,
        **normalized_answers,
    )
    db.add(form_response)
    db.flush()

    encoded_answers = _build_encoded_answers(normalized_answers)

    should_activate = True
    active_profile = _latest_valid_profile(db, student.id)
    if active_profile is not None:
        previous_response = db.get(FormResponse, active_profile.source_form_response_id)
        if previous_response is not None and previous_response.submitted_at > submitted_at:
            should_activate = False

    if should_activate:
        _deactivate_active_profiles(db, student.id)
        db.flush()

    profile = PreferenceProfile(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        student_id=student.id,
        source_form_response_id=form_response.id,
        has_preferences=True,
        is_active=should_activate,
        is_generated=False,
        **normalized_answers,
        **encoded_answers,
    )
    db.add(profile)
    db.commit()

    return {"status": "submitted", "valid": True}
