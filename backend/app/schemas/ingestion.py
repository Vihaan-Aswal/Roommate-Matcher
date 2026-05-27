from __future__ import annotations

from typing import Any
from pydantic import BaseModel
from app.schemas.upload import InvalidRowSchema

# -- Student Diff --

class StudentDiffEntry(BaseModel):
    admission_number: str
    full_name: str
    action: str  # "insert" | "update" | "soft_delete"
    changes: dict[str, Any] | None = None  # field -> {old, new} for updates
    warnings: list[str] = []  # e.g. "has 2 form responses", "included in run RUN-20250501"

class StudentImportDiffResponse(BaseModel):
    workspace_id: str
    total_csv_rows: int
    valid_csv_rows: int
    to_insert: int
    to_update: int
    to_soft_delete: int
    unchanged: int
    validation_errors: list[InvalidRowSchema]
    diff_entries: list[StudentDiffEntry]
    warnings: list[str]  # workspace-level warnings

class StudentImportApplyResponse(BaseModel):
    workspace_id: str
    inserted: int
    updated: int
    soft_deleted: int
    unchanged: int
    segments_created: int
    errors: list[InvalidRowSchema]

# -- Room Diff --

class RoomDiffEntry(BaseModel):
    room_id: str
    segment_key: str
    action: str  # "insert" | "update" | "soft_delete"
    changes: dict[str, Any] | None = None
    warnings: list[str] = []

class RoomImportDiffResponse(BaseModel):
    workspace_id: str
    total_csv_rows: int
    valid_csv_rows: int
    to_insert: int
    to_update: int
    to_soft_delete: int
    unchanged: int
    validation_errors: list[InvalidRowSchema]
    diff_entries: list[RoomDiffEntry]
    warnings: list[str]

class RoomImportApplyResponse(BaseModel):
    workspace_id: str
    inserted: int
    updated: int
    soft_deleted: int
    unchanged: int
    errors: list[InvalidRowSchema]
