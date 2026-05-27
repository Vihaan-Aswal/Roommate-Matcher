from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.upload import UploadSummaryResponse
from app.services.ingestion.room_csv import ingest_rooms_csv
from app.services.ingestion.student_csv import ingest_students_csv


router = APIRouter(tags=["upload"])

# DEPRECATED: Phase 3+ uses workspace-scoped endpoints:
#   POST /api/workspaces/{workspace_id}/students/upload/preview
#   POST /api/workspaces/{workspace_id}/students/upload/apply
#   POST /api/workspaces/{workspace_id}/rooms/upload/preview
#   POST /api/workspaces/{workspace_id}/rooms/upload/apply
# These legacy routes will be removed after all frontend calls are migrated.

# ROOT_DIR = Path(__file__).resolve().parents[4]
# ERROR_REPORT_DIR = ROOT_DIR / "data" / "error-reports"

# def _write_error_report(prefix: str, invalid_rows: list[dict[str, object]]) -> str | None:
#     ...

# async def _save_upload_to_temp(file: UploadFile) -> str:
#     ...

def _build_upload_response(result: dict[str, object], prefix: str) -> UploadSummaryResponse:
    invalid_rows = result["invalid_rows"]
    assert isinstance(invalid_rows, list)

    # error_report_name = _write_error_report(prefix, invalid_rows)
    error_report_name = None
    return UploadSummaryResponse(
        total_rows=int(result["total_rows"]),
        accepted_rows=int(result["accepted_rows"]),
        rejected_rows=int(result["rejected_rows"]),
        duplicate_rows=int(result["duplicate_rows"]),
        invalid_rows=invalid_rows,
        error_report_name=error_report_name,
    )


# DEPRECATED
@router.post("/students/upload", response_model=UploadSummaryResponse)
@router.post("/upload/students", response_model=UploadSummaryResponse, include_in_schema=False)
async def upload_students(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> UploadSummaryResponse:
    raise HTTPException(status_code=410, detail="Legacy upload is deprecated. Use workspace-scoped endpoints.")


# DEPRECATED
@router.post("/rooms/upload", response_model=UploadSummaryResponse)
@router.post("/upload/rooms", response_model=UploadSummaryResponse, include_in_schema=False)
async def upload_rooms(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> UploadSummaryResponse:
    raise HTTPException(status_code=410, detail="Legacy upload is deprecated. Use workspace-scoped endpoints.")


# DEPRECATED
# @router.get("/upload/error-reports/{report_name}")
# def download_error_report(report_name: str) -> FileResponse:
#     ...
