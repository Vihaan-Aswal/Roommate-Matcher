from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class FormSubmissionRequest(BaseModel):
    admission_number: str
    dob: date

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
