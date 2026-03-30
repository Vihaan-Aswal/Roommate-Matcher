from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.form import FormSubmissionRequest, FormSubmissionResponse
from app.services.ingestion.form_response import QUESTION_KEYS, FormIntakeError, ingest_form_response


router = APIRouter(prefix="/form", tags=["form"])


@router.post("/submit", response_model=FormSubmissionResponse)
def submit_form(
    payload: FormSubmissionRequest,
    db: Session = Depends(get_db),
) -> FormSubmissionResponse:
    answers = {question: getattr(payload, question) for question in QUESTION_KEYS}

    try:
        result = ingest_form_response(
            db=db,
            admission_number=payload.admission_number,
            dob=payload.dob,
            raw_answers=answers,
        )
    except FormIntakeError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": exc.code, "message": exc.message},
        ) from exc

    return FormSubmissionResponse(
        success=True,
        message="Form response recorded successfully.",
        has_preferences=bool(result["has_preferences"]),
    )
