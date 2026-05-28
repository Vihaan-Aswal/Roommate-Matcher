from __future__ import annotations

from datetime import date

from pydantic import BaseModel


import uuid
from pydantic import BaseModel

class FormSubmissionRequest(BaseModel):
    workspace_id: uuid.UUID
    admission_number: str
    phone_last4: str

    q1_raw: str | None = None
    q2_raw: str | None = None
    q3_raw: str | None = None
    q4a_raw: str | None = None
    q4b_raw: str | None = None
    q5a_raw: str | None = None
    q5b_raw: str | None = None
    q6_raw: str | None = None
    q7_raw: str | None = None
    q8_raw: str | None = None
    q9_raw: str | None = None
    q10_raw: str | None = None


class FormSubmissionResponse(BaseModel):
    success: bool
    message: str
    code: str | None = None
    has_preferences: bool | None = None


class FormStatusSegmentSummary(BaseModel):
    segment_key: str
    total: int
    valid: int
    percentage: float


class FormStatusResponse(BaseModel):
    total_students: int
    valid_responses: int
    invalid_responses: int
    percentage_valid: float
    by_segment: list[FormStatusSegmentSummary]


class NonSubmitterResponseRow(BaseModel):
    admission_number: str
    full_name: str
    segment_key: str


class NonSubmittersResponse(BaseModel):
    non_submitters: list[NonSubmitterResponseRow]
    total_count: int
