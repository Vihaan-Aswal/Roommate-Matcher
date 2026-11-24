from __future__ import annotations

import pytest

from app.services.ingestion.csv_utils import RowError, parse_csv_bytes, safe_text


def test_parse_csv_bytes_decodes_valid_utf8() -> None:
    reader = parse_csv_bytes(b"a,b\n1,2\n", {"a"})

    assert reader.fieldnames == ["a", "b"]
    assert list(reader) == [{"a": "1", "b": "2"}]


def test_parse_csv_bytes_rejects_unsupported_encoding() -> None:
    with pytest.raises(ValueError, match="encoding not supported"):
        parse_csv_bytes(b"\xff\xfe\x00\x00", {"a"})


def test_parse_csv_bytes_rejects_whitespace_only_payload() -> None:
    with pytest.raises(ValueError, match="CSV file is empty"):
        parse_csv_bytes(b"  \n\t\n", {"a"})


def test_parse_csv_bytes_rejects_missing_required_columns() -> None:
    with pytest.raises(ValueError, match="Missing required columns: admission_number"):
        parse_csv_bytes(b"full_name\nAlice\n", {"admission_number"})


def test_parse_csv_bytes_accepts_a_utf8_bom_header() -> None:
    reader = parse_csv_bytes(
        "\ufeffadmission_number\nA1\n".encode("utf-8"), {"admission_number"}
    )

    assert reader.fieldnames == ["admission_number"]
    assert list(reader) == [{"admission_number": "A1"}]


def test_parse_csv_bytes_strips_spaces_after_header_commas() -> None:
    reader = parse_csv_bytes(
        b"admission_number, full_name\nA1,Ann\n", {"admission_number", "full_name"}
    )

    assert reader.fieldnames == ["admission_number", "full_name"]
    assert [row.get("full_name") for row in reader] == ["Ann"]


def test_safe_text_normalises_none_and_whitespace() -> None:
    assert safe_text(None) == ""
    assert safe_text("  ADM001  ") == "ADM001"


def test_row_error_as_dict_keeps_all_fields() -> None:
    row_error = RowError(row_number=7, field="dob", reason="invalid_dob_iso_format", raw_value="nope")

    assert row_error.as_dict() == {
        "row_number": 7,
        "field": "dob",
        "reason": "invalid_dob_iso_format",
        "raw_value": "nope",
    }
