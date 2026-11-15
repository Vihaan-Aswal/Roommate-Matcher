"""Contract tests: frontend catalogs must match the backend they talk to.

These tests parse the TypeScript sources directly (no node needed) and compare
them with the backend constants/models. Any drift fails the build:

  * ``frontend/src/lib/formQuestions.ts`` question ids
    == backend ``QUESTION_KEYS`` == ``PreferenceProfile`` raw-answer columns
  * ``frontend/src/lib/apiClient.ts`` ``FormSubmissionPayload`` fields
    == the public submit endpoint's identity fields + the twelve answer keys
  * the assignment CSV header constant and its four-slot cap.

Nothing here reaches the network or a database.
"""
from __future__ import annotations

import csv
import io
import re
from pathlib import Path
from types import SimpleNamespace

from app.api.routes.exports import _iter_assignment_rows
from app.api.routes.public_form import PublicFormSubmitPayload
from app.models.preference_profile import PreferenceProfile
from app.services.ingestion.form_response import QUESTION_KEYS

_LIB_DIR = Path(__file__).resolve().parents[3] / "frontend" / "src" / "lib"
_FORM_QUESTIONS_TS = _LIB_DIR / "formQuestions.ts"
_API_CLIENT_TS = _LIB_DIR / "apiClient.ts"

_EXPECTED_ANSWER_ORDER = [
    "q1_raw",
    "q2_raw",
    "q3_raw",
    "q4a_raw",
    "q4b_raw",
    "q5a_raw",
    "q5b_raw",
    "q6_raw",
    "q7_raw",
    "q8_raw",
    "q9_raw",
    "q10_raw",
]

_IDENTITY_FIELDS = ["admission_number", "phone_last4"]


def _parse_form_question_ids() -> list[str]:
    source = _FORM_QUESTIONS_TS.read_text(encoding="utf-8")
    # Question configs only: `id: "qN_raw"`. The interface union uses `| "..."`.
    return re.findall(r'id:\s*"([^"]+)"', source)


def _parse_form_submission_payload_fields() -> list[str]:
    source = _API_CLIENT_TS.read_text(encoding="utf-8")
    match = re.search(
        r"export interface FormSubmissionPayload\s*\{(?P<body>.*?)\n\}",
        source,
        re.DOTALL,
    )
    assert match is not None, "FormSubmissionPayload interface not found in apiClient.ts"
    return re.findall(r"^\s*(\w+)\??:", match.group("body"), re.MULTILINE)


def test_frontend_question_ids_match_backend_answer_keys() -> None:
    assert _parse_form_question_ids() == _EXPECTED_ANSWER_ORDER
    assert QUESTION_KEYS == _EXPECTED_ANSWER_ORDER


def test_preference_profile_raw_columns_match_backend_answer_keys() -> None:
    raw_columns = [
        column.name
        for column in PreferenceProfile.__table__.columns
        if column.name.endswith("_raw")
    ]
    assert raw_columns == QUESTION_KEYS


def test_form_submission_payload_matches_public_submit_transport() -> None:
    frontend_fields = _parse_form_submission_payload_fields()

    assert frontend_fields[: len(_IDENTITY_FIELDS)] == _IDENTITY_FIELDS
    assert frontend_fields[len(_IDENTITY_FIELDS) :] == QUESTION_KEYS

    model_fields = list(PublicFormSubmitPayload.model_fields)
    assert model_fields == [
        "submitted_admission_number",
        "submitted_phone_last4",
        "answers",
    ]

    # The endpoint accepts exactly the keys apiClient builds: identity is renamed
    # to submitted_*, the twelve answer keys travel inside `answers`.
    payload_answers = {key: "x" for key in frontend_fields[len(_IDENTITY_FIELDS) :]}
    body = {
        "submitted_admission_number": "ADM001",
        "submitted_phone_last4": "7890",
        "answers": payload_answers,
    }
    parsed = PublicFormSubmitPayload.model_validate(body)
    assert parsed.submitted_admission_number == "ADM001"
    assert parsed.submitted_phone_last4 == "7890"
    assert sorted(parsed.answers) == sorted(QUESTION_KEYS)


def test_public_submit_openapi_requires_the_same_body_fields() -> None:
    from app.main import app

    spec = app.openapi()
    submit_schema = spec["components"]["schemas"]["PublicFormSubmitPayload"]
    assert sorted(submit_schema["required"]) == sorted(PublicFormSubmitPayload.model_fields)
    assert set(submit_schema["properties"]) == set(PublicFormSubmitPayload.model_fields)


# ---------------------------------------------------------------------------
# Assignment CSV header contract
# ---------------------------------------------------------------------------

_EXPECTED_CSV_HEADER = (
    "room_id,segment_key,student_1,student_2,student_3,student_4,group_score"
)


def _fake_assignment(students: list[str]) -> SimpleNamespace:
    import json

    return SimpleNamespace(
        room_id="R-101",
        segment_key="M_1st_year_AC_2",
        assigned_students_json=json.dumps(students),
        group_score=0.87654,
    )


def test_assignment_csv_header_is_stable() -> None:
    rows = list(_iter_assignment_rows("run_contract", [_fake_assignment(["S1", "S2"])]))
    assert rows[0].strip() == _EXPECTED_CSV_HEADER

    parsed = list(csv.reader(io.StringIO(rows[1])))
    assert len(parsed[0]) == 7


def test_assignment_csv_never_emits_more_than_four_student_slots() -> None:
    over_full = ["S1", "S2", "S3", "S4", "S5", "S6"]
    rows = list(_iter_assignment_rows("run_contract", [_fake_assignment(over_full)]))
    header = next(csv.reader(io.StringIO(rows[0])))
    student_columns = [name for name in header if name.startswith("student_")]
    assert student_columns == ["student_1", "student_2", "student_3", "student_4"]

    row = next(csv.reader(io.StringIO(rows[1])))
    assert len(row) == len(header)
    room_row = dict(zip(header, row))
    assert [room_row[f"student_{idx}"] for idx in range(1, 5)] == ["S1", "S2", "S3", "S4"]
    assert "S5" not in row and "S6" not in row


def test_assignment_csv_pads_short_rooms_to_four_slots() -> None:
    rows = list(_iter_assignment_rows("run_contract", [_fake_assignment(["S1"])]))
    header = next(csv.reader(io.StringIO(rows[0])))
    row = dict(zip(header, next(csv.reader(io.StringIO(rows[1])))))

    assert row["student_1"] == "S1"
    assert [row[f"student_{idx}"] for idx in range(2, 5)] == ["", "", ""]
    assert row["group_score"] == "0.8765"
