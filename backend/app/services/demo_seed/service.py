"""
demo_seed/service.py — Reusable demo seeder service.

Reads the CSV files from demo-data/ and seeds a workspace with:
  - Students (via apply_student_import)
  - Rooms (via apply_room_import)
  - Form responses (via ingest_form_responses_csv)

Does NOT run the matching algorithm.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from app.services.ingestion.student_csv import apply_student_import
from app.services.ingestion.room_csv import apply_room_import
from app.services.ingestion.form_response_csv import ingest_form_responses_csv


# Resolve CSV paths relative to the repository root.
# In production (Render), these files are included in the deployed codebase.
_DEMO_DATA_DIR = Path(__file__).resolve().parents[4] / "demo-data"

STUDENTS_CSV = _DEMO_DATA_DIR / "master_students.csv"
ROOMS_CSV = _DEMO_DATA_DIR / "rooms.csv"
FORM_RESPONSES_CSV = _DEMO_DATA_DIR / "form_responses.csv"


@dataclass(frozen=True)
class DemoSeedResult:
    students_inserted: int
    students_updated: int
    rooms_inserted: int
    rooms_updated: int
    form_responses_accepted: int
    form_responses_rejected: int


def seed_demo_workspace(
    db: Session,
    workspace_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> DemoSeedResult:
    """
    Seed a workspace with demo data from the CSV files.

    This function is idempotent-ish: it uses the existing upsert
    ingestion services, so re-running it on the same workspace
    will update rather than duplicate.

    Raises FileNotFoundError if the CSV files are missing.
    """
    for path in [STUDENTS_CSV, ROOMS_CSV, FORM_RESPONSES_CSV]:
        if not path.exists():
            raise FileNotFoundError(f"Demo seed file not found: {path}")

    # 1. Seed students
    with open(STUDENTS_CSV, "rb") as f:
        student_result = apply_student_import(db, workspace_id, tenant_id, f.read())

    # 2. Seed rooms
    with open(ROOMS_CSV, "rb") as f:
        room_result = apply_room_import(db, workspace_id, tenant_id, f.read())

    # 3. Seed form responses (creates preference profiles)
    form_result = ingest_form_responses_csv(db, workspace_id, str(FORM_RESPONSES_CSV))

    return DemoSeedResult(
        students_inserted=student_result.inserted,
        students_updated=student_result.updated,
        rooms_inserted=room_result.inserted,
        rooms_updated=room_result.updated,
        form_responses_accepted=form_result["accepted_rows"],
        form_responses_rejected=form_result["rejected_rows"],
    )
