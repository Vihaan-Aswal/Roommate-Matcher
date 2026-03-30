from __future__ import annotations

import csv
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.upload import UploadSummaryResponse
from app.services.ingestion.room_csv import ingest_rooms_csv
from app.services.ingestion.student_csv import ingest_students_csv


router = APIRouter(prefix="/upload", tags=["upload"])

ROOT_DIR = Path(__file__).resolve().parents[4]
ERROR_REPORT_DIR = ROOT_DIR / "data" / "error-reports"


def _write_error_report(prefix: str, invalid_rows: list[dict[str, object]]) -> str | None:
    if not invalid_rows:
        return None

    ERROR_REPORT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_name = f"{prefix}_errors_{timestamp}.csv"
    report_path = ERROR_REPORT_DIR / report_name

    with report_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["row_number", "field", "reason", "raw_value"],
        )
        writer.writeheader()
        writer.writerows(invalid_rows)

    return report_name


async def _save_upload_to_temp(file: UploadFile) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as handle:
        content = await file.read()
        handle.write(content)
        return handle.name


@router.post("/students", response_model=UploadSummaryResponse)
async def upload_students(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> UploadSummaryResponse:
    temp_path = await _save_upload_to_temp(file)
    try:
        result = ingest_students_csv(db, temp_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        Path(temp_path).unlink(missing_ok=True)

    error_report_name = _write_error_report("students", result["invalid_rows"])
    return UploadSummaryResponse(
        total_rows=result["total_rows"],
        accepted_rows=result["accepted_rows"],
        rejected_rows=result["rejected_rows"],
        duplicate_rows=result["duplicate_rows"],
        invalid_rows=result["invalid_rows"],
        error_report_name=error_report_name,
    )


@router.post("/rooms", response_model=UploadSummaryResponse)
async def upload_rooms(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> UploadSummaryResponse:
    temp_path = await _save_upload_to_temp(file)
    try:
        result = ingest_rooms_csv(db, temp_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        Path(temp_path).unlink(missing_ok=True)

    error_report_name = _write_error_report("rooms", result["invalid_rows"])
    return UploadSummaryResponse(
        total_rows=result["total_rows"],
        accepted_rows=result["accepted_rows"],
        rejected_rows=result["rejected_rows"],
        duplicate_rows=result["duplicate_rows"],
        invalid_rows=result["invalid_rows"],
        error_report_name=error_report_name,
    )


@router.get("/error-reports/{report_name}")
def download_error_report(report_name: str) -> FileResponse:
    if Path(report_name).name != report_name:
        raise HTTPException(status_code=400, detail="Invalid report name")

    report_path = ERROR_REPORT_DIR / report_name
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Error report not found")

    return FileResponse(
        path=report_path,
        media_type="text/csv",
        filename=report_name,
    )
