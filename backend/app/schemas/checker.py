from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class CheckerRequest(BaseModel):
    segment_key: str
    room_size: int
    student_ids: list[str]
    precomputed_satisfaction: dict[str, float] | None = None
    precomputed_labels: dict[str, Literal["Excellent", "Good", "Okay", "Poor"]] | None = None


class CheckerStudentResult(BaseModel):
    admission_number: str
    satisfaction_score: float
    satisfaction_label: Literal["Excellent", "Good", "Okay", "Poor"]
    reasons: list[str]
    is_at_risk: bool


class CheckerResponse(BaseModel):
    group_score: float
    group_label: Literal["Excellent", "Good", "Okay", "Poor"]
    at_risk_students: list[str]
    students: list[CheckerStudentResult]
