from __future__ import annotations

from pydantic import BaseModel


# DEPRECATED: Phase 3+ uses schemas from app.schemas.ingestion
class InvalidRowSchema(BaseModel):
    row_number: int
    field: str
    reason: str
    raw_value: str | None


class UploadSummaryResponse(BaseModel):
    total_rows: int
    accepted_rows: int
    rejected_rows: int
    duplicate_rows: int
    invalid_rows: list[InvalidRowSchema]
    error_report_name: str | None
