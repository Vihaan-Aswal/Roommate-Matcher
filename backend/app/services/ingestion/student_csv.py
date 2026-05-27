from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field as dc_field
from datetime import date
from pathlib import Path
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.segment import Segment
from app.models.student import Student
from app.models.form_response import FormResponse
from app.models.matching_run import MatchingRun
from app.services.ingestion.csv_utils import RowError, parse_csv_bytes, safe_text

REQUIRED_COLUMNS = {
    "admission_number",
    "full_name",
    "gender",
    "year_group",
    "ac_type",
    "room_size",
    "dob",
    "phone_number",
}
OPTIONAL_COLUMNS = {"segment_override"}


_PHONE_DIGITS_RE = re.compile(r"\d")

def _normalize_phone(value: str) -> str | None:
    """Strip whitespace, dashes, parentheses. Return digits-only string or None if < 4 digits."""
    digits = "".join(_PHONE_DIGITS_RE.findall(value))
    if len(digits) < 4:
        return None
    return digits

def _derive_phone_last4(normalized_phone: str) -> str:
    return normalized_phone[-4:]


def derive_segment_key(gender: str, year_group: str, ac_type: str, room_size: int) -> str:
    return f"{gender}_{year_group}_{ac_type}_{room_size}"


def _normalize_gender(value: str) -> str | None:
    normalized = value.strip().upper()
    if normalized in {"M", "MALE"}:
        return "M"
    if normalized in {"F", "FEMALE"}:
        return "F"
    return None


def _normalize_ac_type(value: str) -> str | None:
    normalized = value.strip().upper().replace("-", "")
    if normalized == "AC":
        return "AC"
    if normalized == "NONAC":
        return "NonAC"
    return None


def _parse_room_size(value: str) -> int | None:
    text_value = value.strip()
    if not text_value.isdigit():
        return None

    room_size = int(text_value)
    if room_size not in {2, 3, 4}:
        return None

    return room_size


def _parse_dob(value: str) -> date | None:
    text_value = value.strip()
    try:
        return date.fromisoformat(text_value)
    except ValueError:
        return None


def _parse_csv_bytes(csv_bytes: bytes) -> csv.DictReader:
    """Decode CSV bytes and return a DictReader. Raises ValueError on empty/invalid data."""
    return parse_csv_bytes(csv_bytes, REQUIRED_COLUMNS)


def _build_row_payload(row: dict[str, str | None], row_number: int) -> tuple[dict[str, object] | None, list[RowError]]:
    errors: list[RowError] = []

    admission_number = safe_text(row.get("admission_number"))
    if not admission_number:
        errors.append(RowError(row_number, "admission_number", "required", row.get("admission_number")))

    full_name = safe_text(row.get("full_name"))
    if not full_name:
        errors.append(RowError(row_number, "full_name", "required", row.get("full_name")))

    year_group = safe_text(row.get("year_group"))
    if not year_group:
        errors.append(RowError(row_number, "year_group", "required", row.get("year_group")))

    gender_raw = safe_text(row.get("gender"))
    gender = _normalize_gender(gender_raw)
    if gender is None:
        errors.append(RowError(row_number, "gender", "invalid_gender", row.get("gender")))

    ac_type_raw = safe_text(row.get("ac_type"))
    ac_type = _normalize_ac_type(ac_type_raw)
    if ac_type is None:
        errors.append(RowError(row_number, "ac_type", "invalid_ac_type", row.get("ac_type")))

    room_size_raw = safe_text(row.get("room_size"))
    room_size = _parse_room_size(room_size_raw)
    if room_size is None:
        errors.append(RowError(row_number, "room_size", "invalid_room_size", row.get("room_size")))

    dob_raw = safe_text(row.get("dob"))
    dob_value = _parse_dob(dob_raw)
    if dob_value is None:
        errors.append(RowError(row_number, "dob", "invalid_dob_iso_format", row.get("dob")))

    phone_raw = safe_text(row.get("phone_number"))
    phone_normalized = _normalize_phone(phone_raw) if phone_raw else None
    if phone_normalized is None:
        errors.append(RowError(row_number, "phone_number", "invalid_phone_number_min_4_digits", row.get("phone_number")))

    segment_override_raw = safe_text(row.get("segment_override"))
    if segment_override_raw:
        errors.append(
            RowError(
                row_number,
                "segment_override",
                "segment_override_not_supported_yet",
                row.get("segment_override"),
            )
        )

    if errors:
        return None, errors

    assert gender is not None
    assert ac_type is not None
    assert room_size is not None
    assert dob_value is not None

    segment_key = derive_segment_key(gender, year_group, ac_type, room_size)
    return {
        "admission_number": admission_number,
        "full_name": full_name,
        "gender": gender,
        "year_group": year_group,
        "ac_type": ac_type,
        "room_size": room_size,
        "dob": dob_value,
        "phone_number": phone_normalized,
        "phone_last4": _derive_phone_last4(phone_normalized) if phone_normalized else None,
        "segment_key": segment_key,
    }, []


@dataclass
class StudentDiffResult:
    total_csv_rows: int = 0
    valid_csv_rows: int = 0
    to_insert: list[dict] = dc_field(default_factory=list)
    to_update: list[dict] = dc_field(default_factory=list)  # each has {admission_number, changes: {field: {old, new}}, warnings: [...]}
    to_soft_delete: list[dict] = dc_field(default_factory=list)  # each has {admission_number, full_name, warnings: [...]}
    unchanged: list[str] = dc_field(default_factory=list)
    validation_errors: list[dict] = dc_field(default_factory=list)
    workspace_warnings: list[str] = dc_field(default_factory=list)


def plan_student_import(
    db: Session,
    workspace_id: UUID,
    tenant_id: UUID,
    csv_bytes: bytes,
) -> StudentDiffResult:
    """
    Parse the CSV in-memory, compare against existing active students in the workspace,
    and return a diff summary without making any database changes.
    """
    reader = _parse_csv_bytes(csv_bytes)
    result = StudentDiffResult()

    # Load existing active students for this workspace, keyed by admission_number
    existing_students: dict[str, Student] = {}
    for s in db.scalars(
        select(Student)
        .where(Student.workspace_id == workspace_id, Student.is_active == True)
    ).all():
        existing_students[s.admission_number] = s

    # Load existing segments for this workspace, keyed by segment_key
    existing_segments: dict[str, Segment] = {}
    for seg in db.scalars(
        select(Segment).where(Segment.workspace_id == workspace_id)
    ).all():
        existing_segments[seg.segment_key] = seg

    # Count form responses and matching runs for warning generation
    response_counts: dict[UUID, int] = {}
    for student_id, count in db.execute(
        select(FormResponse.student_id, func.count(FormResponse.id))
        .where(FormResponse.workspace_id == workspace_id, FormResponse.student_id.isnot(None))
        .group_by(FormResponse.student_id)
    ).all():
        response_counts[student_id] = count

    has_matching_runs = db.scalar(
        select(func.count(MatchingRun.id))
        .where(MatchingRun.workspace_id == workspace_id)
    ) > 0

    seen_in_csv: set[str] = set()
    mutable_fields = ("full_name", "gender", "year_group", "ac_type", "room_size", "dob", "phone_number", "phone_last4")

    for row_number, row in enumerate(reader, start=2):
        result.total_csv_rows += 1
        payload, row_errors = _build_row_payload(row, row_number)

        if row_errors:
            result.validation_errors.extend(e.as_dict() for e in row_errors)
            continue

        assert payload is not None
        adm = payload["admission_number"]
        assert isinstance(adm, str)

        if adm in seen_in_csv:
            result.validation_errors.append(
                RowError(row_number, "admission_number", "duplicate_admission_number_in_file", adm).as_dict()
            )
            continue

        seen_in_csv.add(adm)
        result.valid_csv_rows += 1

        if adm in existing_students:
            # Compare for updates
            existing = existing_students[adm]
            changes = {}
            for f in mutable_fields:
                old_val = getattr(existing, f)
                new_val = payload.get(f)
                if f == "dob":
                    # Compare date objects
                    if old_val != new_val:
                        changes[f] = {"old": str(old_val), "new": str(new_val)}
                elif str(old_val) != str(new_val) if old_val is not None else new_val is not None:
                    changes[f] = {"old": str(old_val) if old_val is not None else None, "new": str(new_val) if new_val is not None else None}

            if changes:
                warnings = []
                resp_count = response_counts.get(existing.id, 0)
                if resp_count > 0:
                    warnings.append(f"has {resp_count} form response(s)")
                result.to_update.append({
                    "admission_number": adm,
                    "full_name": payload["full_name"],
                    "action": "update",
                    "changes": changes,
                    "warnings": warnings,
                })
            else:
                result.unchanged.append(adm)
        else:
            # New student
            result.to_insert.append({
                "admission_number": adm,
                "full_name": payload["full_name"],
                "action": "insert",
                "changes": None,
                "warnings": [],
            })

    # Students in DB but missing from CSV → soft-delete candidates
    csv_admissions = seen_in_csv
    for adm, student in existing_students.items():
        if adm not in csv_admissions:
            warnings = []
            resp_count = response_counts.get(student.id, 0)
            if resp_count > 0:
                warnings.append(f"has {resp_count} form response(s) — these will be preserved")
            if has_matching_runs:
                warnings.append("included in existing matching run(s) — historical results preserved")
            result.to_soft_delete.append({
                "admission_number": adm,
                "full_name": student.full_name,
                "action": "soft_delete",
                "changes": None,
                "warnings": warnings,
            })

    if result.to_soft_delete and has_matching_runs:
        result.workspace_warnings.append(
            f"Removing {len(result.to_soft_delete)} student(s) from the active roster. "
            "Historical matching runs and form responses will be preserved."
        )

    return result


@dataclass
class StudentApplyResult:
    inserted: int = 0
    updated: int = 0
    soft_deleted: int = 0
    unchanged: int = 0
    segments_created: int = 0
    errors: list[dict] = dc_field(default_factory=list)


def apply_student_import(
    db: Session,
    workspace_id: UUID,
    tenant_id: UUID,
    csv_bytes: bytes,
) -> StudentApplyResult:
    """
    Parse the CSV in-memory and apply upsert changes to the workspace.
    Students missing from the CSV are soft-deleted (is_active = False).
    New students are inserted. Existing students are updated if fields changed.
    Segments are auto-created as needed.
    """
    reader = _parse_csv_bytes(csv_bytes)
    result = StudentApplyResult()

    # Load existing active students
    existing_students: dict[str, Student] = {}
    for s in db.scalars(
        select(Student)
        .where(Student.workspace_id == workspace_id, Student.is_active == True)
    ).all():
        existing_students[s.admission_number] = s

    # Load existing segments
    existing_segments: dict[str, Segment] = {}
    for seg in db.scalars(
        select(Segment).where(Segment.workspace_id == workspace_id)
    ).all():
        existing_segments[seg.segment_key] = seg

    seen_in_csv: set[str] = set()
    mutable_fields = ("full_name", "gender", "year_group", "ac_type", "room_size", "dob", "phone_number", "phone_last4")

    for row_number, row in enumerate(reader, start=2):
        payload, row_errors = _build_row_payload(row, row_number)
        if row_errors:
            result.errors.extend(e.as_dict() for e in row_errors)
            continue

        assert payload is not None
        adm = payload["admission_number"]
        assert isinstance(adm, str)

        if adm in seen_in_csv:
            result.errors.append(
                RowError(row_number, "admission_number", "duplicate_admission_number_in_file", adm).as_dict()
            )
            continue

        seen_in_csv.add(adm)
        segment_key = payload["segment_key"]
        assert isinstance(segment_key, str)

        # Ensure segment exists
        if segment_key not in existing_segments:
            new_seg = Segment(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                segment_key=segment_key,
                gender=payload["gender"],
                year_group=payload["year_group"],
                ac_type=payload["ac_type"],
                room_size=payload["room_size"],
            )
            db.add(new_seg)
            db.flush()  # get the ID
            existing_segments[segment_key] = new_seg
            result.segments_created += 1

        segment = existing_segments[segment_key]

        if adm in existing_students:
            # Update existing student
            student = existing_students[adm]
            changed = False
            for f in mutable_fields:
                new_val = payload.get(f)
                old_val = getattr(student, f)
                if old_val != new_val:
                    setattr(student, f, new_val)
                    changed = True

            # Update segment FK if segment changed
            if student.segment_id != segment.id:
                student.segment_id = segment.id
                changed = True

            # Re-activate if was somehow inactive
            if not student.is_active:
                student.is_active = True
                changed = True

            if changed:
                result.updated += 1
            else:
                result.unchanged += 1
        else:
            # Check if there's an inactive student with same admission_number — reactivate
            inactive = db.scalar(
                select(Student).where(
                    Student.workspace_id == workspace_id,
                    Student.admission_number == adm,
                    Student.is_active == False,
                )
            )
            if inactive:
                # Reactivate and update
                for f in mutable_fields:
                    setattr(inactive, f, payload.get(f))
                inactive.segment_id = segment.id
                inactive.is_active = True
                result.updated += 1
            else:
                # Insert brand new
                db.add(Student(
                    tenant_id=tenant_id,
                    workspace_id=workspace_id,
                    segment_id=segment.id,
                    admission_number=adm,
                    full_name=payload["full_name"],
                    gender=payload["gender"],
                    year_group=payload["year_group"],
                    ac_type=payload["ac_type"],
                    room_size=payload["room_size"],
                    dob=payload["dob"],
                    phone_number=payload["phone_number"],
                    phone_last4=payload["phone_last4"],
                ))
                result.inserted += 1

    # Soft-delete students not in CSV
    for adm, student in existing_students.items():
        if adm not in seen_in_csv:
            student.is_active = False
            result.soft_deleted += 1

    db.commit()
    return result


# DEPRECATED: Legacy insert-only ingestion.
# Phase 3+ uses plan_student_import() and apply_student_import().
# This function is retained for backward compatibility with existing tests
# and will be removed after all routes are migrated to the new flow.
def ingest_students_csv(db: Session, csv_path: str) -> dict[str, object]:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    invalid_rows: list[dict[str, int | str | None]] = []
    accepted_rows = 0
    rejected_rows = 0
    duplicate_rows = 0

    existing_students = {
        admission_number
        for admission_number in db.scalars(select(Student.admission_number)).all()
    }
    existing_segments = {
        segment_key for segment_key in db.scalars(select(Segment.segment_key)).all()
    }
    seen_in_file: set[str] = set()

    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise ValueError("CSV file is empty or missing header row")
        actual_columns = {name.strip() for name in reader.fieldnames}
        missing = sorted(REQUIRED_COLUMNS - actual_columns)
        if missing:
            raise ValueError(f"Missing required columns: {', '.join(missing)}")

        for row_number, row in enumerate(reader, start=2):
            row_payload, row_errors = _build_row_payload(row, row_number)
            if row_errors:
                rejected_rows += 1
                invalid_rows.extend(error.as_dict() for error in row_errors)
                continue

            assert row_payload is not None
            admission_number = row_payload["admission_number"]
            assert isinstance(admission_number, str)

            if admission_number in seen_in_file:
                duplicate_rows += 1
                rejected_rows += 1
                invalid_rows.append(
                    RowError(
                        row_number,
                        "admission_number",
                        "duplicate_admission_number_in_file",
                        admission_number,
                    ).as_dict()
                )
                continue

            if admission_number in existing_students:
                duplicate_rows += 1
                rejected_rows += 1
                invalid_rows.append(
                    RowError(
                        row_number,
                        "admission_number",
                        "admission_number_already_exists",
                        admission_number,
                    ).as_dict()
                )
                continue

            seen_in_file.add(admission_number)
            existing_students.add(admission_number)

            segment_key = row_payload["segment_key"]
            assert isinstance(segment_key, str)
            if segment_key not in existing_segments:
                db.add(
                    Segment(
                        segment_key=segment_key,
                        gender=row_payload["gender"],
                        year_group=row_payload["year_group"],
                        ac_type=row_payload["ac_type"],
                        room_size=row_payload["room_size"],
                    )
                )
                existing_segments.add(segment_key)

            db.add(
                Student(
                    admission_number=admission_number,
                    full_name=row_payload["full_name"],
                    gender=row_payload["gender"],
                    year_group=row_payload["year_group"],
                    ac_type=row_payload["ac_type"],
                    room_size=row_payload["room_size"],
                    dob=row_payload["dob"],
                    segment_key=segment_key,
                )
            )
            accepted_rows += 1

    db.commit()

    return {
        "total_rows": accepted_rows + rejected_rows,
        "accepted_rows": accepted_rows,
        "rejected_rows": rejected_rows,
        "duplicate_rows": duplicate_rows,
        "invalid_rows": invalid_rows,
    }
