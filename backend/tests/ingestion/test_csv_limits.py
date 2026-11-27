"""Bounds on CSV row count, cell length and duplicate headers."""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.orm import Session

from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.services.ingestion.csv_utils import parse_csv_bytes
from app.services.ingestion.student_csv import apply_student_import

STUDENT_HEADER = (
    "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
)


def _workspace(db_session: Session) -> tuple[uuid.UUID, uuid.UUID]:
    tenant = Tenant(slug=f"csv-{uuid.uuid4().hex[:8]}", display_name="CSV Tenant")
    db_session.add(tenant)
    db_session.flush()
    workspace = Workspace(tenant_id=tenant.id, name="CSV WS", status="draft")
    db_session.add(workspace)
    db_session.flush()
    return tenant.id, workspace.id


def test_duplicate_headers_after_stripping_are_rejected() -> None:
    with pytest.raises(ValueError, match="CSV header contains duplicate columns."):
        parse_csv_bytes(b"admission_number, admission_number\nA1, A1\n", {"admission_number"})


def test_more_than_the_row_cap_is_rejected() -> None:
    rows = "".join(
        f"ADM{index:05d},Ann,F,1st_year,AC,2,2005-01-01,9876543210\n"
        for index in range(10_001)
    )
    reader = parse_csv_bytes((STUDENT_HEADER + rows).encode("utf-8"), {"admission_number"})

    with pytest.raises(ValueError, match="CSV has more than 10000 rows."):
        list(reader)


def test_overlong_cell_names_the_row_and_column() -> None:
    row = f"ADM001,{'x' * 1001},F,1st_year,AC,2,2005-01-01,9876543210\n"
    reader = parse_csv_bytes((STUDENT_HEADER + row).encode("utf-8"), {"admission_number"})

    with pytest.raises(ValueError, match="Row 1, column 'full_name'"):
        list(reader)


def test_two_hundred_thousand_char_cell_raises_value_error_in_apply(
    db_session: Session,
) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    row = f"ADM001,{'x' * 200_000},F,1st_year,AC,2,2005-01-01,9876543210\n"
    csv_bytes = (STUDENT_HEADER + row).encode("utf-8")

    # csv.Error must not escape: the route layer only catches ValueError.
    with pytest.raises(ValueError, match="value exceeds 1000 characters."):
        apply_student_import(db_session, workspace_id, tenant_id, csv_bytes)


def test_a_normal_two_row_file_still_parses() -> None:
    csv_bytes = (
        STUDENT_HEADER
        + "ADM001,Ann,F,1st_year,AC,2,2005-01-01,9876543210\n"
        + "ADM002,Bob,M,2nd_year,Non_AC,3,2004-02-02,9876543211\n"
    ).encode("utf-8")

    rows = list(parse_csv_bytes(csv_bytes, {"admission_number"}))

    assert [row["admission_number"] for row in rows] == ["ADM001", "ADM002"]
