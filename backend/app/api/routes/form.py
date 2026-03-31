from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.form import (
    FormStatusResponse,
    FormSubmissionRequest,
    FormSubmissionResponse,
    NonSubmitterResponseRow,
    NonSubmittersResponse,
)
from app.services.ingestion.form_collection import compute_form_collection_status, list_non_submitters
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


@router.get("/status", response_model=FormStatusResponse)
def get_form_status(db: Session = Depends(get_db)) -> FormStatusResponse:
    result = compute_form_collection_status(db)
    return FormStatusResponse(
        total_students=result.total_students,
        valid_responses=result.valid_responses,
        invalid_responses=result.invalid_responses,
        percentage_valid=result.percentage_valid,
        by_segment=[
            {
                "segment_key": row.segment_key,
                "total": row.total,
                "valid": row.valid,
                "percentage": row.percentage,
            }
            for row in result.by_segment
        ],
    )


@router.get("/non-submitters", response_model=NonSubmittersResponse)
def get_non_submitters(db: Session = Depends(get_db)) -> NonSubmittersResponse:
    rows = list_non_submitters(db)
    records = [
        NonSubmitterResponseRow(
            admission_number=row.admission_number,
            full_name=row.full_name,
            segment_key=row.segment_key,
        )
        for row in rows
    ]
    return NonSubmittersResponse(non_submitters=records, total_count=len(records))
