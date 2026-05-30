from __future__ import annotations

from datetime import date

from pydantic import BaseModel


import uuid
from pydantic import BaseModel



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
