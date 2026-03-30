from pathlib import Path

from sqlalchemy.orm import Session

from app.models.room import Room
from app.models.segment import Segment
from app.services.ingestion.room_csv import ingest_rooms_csv


def _write_csv(tmp_path: Path, name: str, content: str) -> str:
    file_path = tmp_path / name
    file_path.write_text(content, encoding="utf-8")
    return str(file_path)


def _seed_segment(db_session: Session, segment_key: str, room_size: int) -> None:
    db_session.add(
        Segment(
            segment_key=segment_key,
            gender=segment_key.split("_")[0],
            year_group="1st_year",
            ac_type="AC",
            room_size=room_size,
        )
    )
    db_session.commit()


def test_ingest_rooms_csv_accepts_valid_rows(db_session: Session, tmp_path: Path) -> None:
    _seed_segment(db_session, "M_1st_year_AC_2", 2)

    csv_path = _write_csv(
        tmp_path,
        "rooms_valid.csv",
        "room_id,segment_key,capacity\n"
        "A-101,M_1st_year_AC_2,2\n"
        "A-102,M_1st_year_AC_2,2\n",
    )

    result = ingest_rooms_csv(db_session, csv_path)

    assert result["accepted_rows"] == 2
    assert result["rejected_rows"] == 0
    rooms = db_session.query(Room).all()
    assert len(rooms) == 2


def test_ingest_rooms_csv_rejects_unknown_segment(db_session: Session, tmp_path: Path) -> None:
    csv_path = _write_csv(
        tmp_path,
        "rooms_unknown_segment.csv",
        "room_id,segment_key,capacity\n"
        "A-201,M_1st_year_AC_2,2\n",
    )

    result = ingest_rooms_csv(db_session, csv_path)

    assert result["accepted_rows"] == 0
    assert result["rejected_rows"] == 1
    assert result["invalid_rows"][0]["reason"] == "unknown_segment"


def test_ingest_rooms_csv_rejects_capacity_mismatch(db_session: Session, tmp_path: Path) -> None:
    _seed_segment(db_session, "F_1st_year_NonAC_3", 3)

    csv_path = _write_csv(
        tmp_path,
        "rooms_capacity_mismatch.csv",
        "room_id,segment_key,capacity\n"
        "B-301,F_1st_year_NonAC_3,2\n",
    )

    result = ingest_rooms_csv(db_session, csv_path)

    assert result["accepted_rows"] == 0
    assert result["rejected_rows"] == 1
    assert result["invalid_rows"][0]["reason"] == "capacity_must_match_segment_room_size"


def test_ingest_rooms_csv_rejects_duplicates(db_session: Session, tmp_path: Path) -> None:
    _seed_segment(db_session, "M_1st_year_AC_2", 2)

    db_session.add(Room(room_id="A-401", segment_key="M_1st_year_AC_2", capacity=2, source="uploaded"))
    db_session.commit()

    csv_path = _write_csv(
        tmp_path,
        "rooms_duplicates.csv",
        "room_id,segment_key,capacity\n"
        "A-401,M_1st_year_AC_2,2\n"
        "A-402,M_1st_year_AC_2,2\n"
        "A-402,M_1st_year_AC_2,2\n",
    )

    result = ingest_rooms_csv(db_session, csv_path)

    assert result["accepted_rows"] == 1
    assert result["rejected_rows"] == 2
    assert result["duplicate_rows"] == 2
    reasons = [error["reason"] for error in result["invalid_rows"]]
    assert "room_id_already_exists_for_segment" in reasons
    assert "duplicate_room_id_in_file_for_segment" in reasons


def test_ingest_rooms_csv_rejects_missing_columns(db_session: Session, tmp_path: Path) -> None:
    _seed_segment(db_session, "M_1st_year_AC_2", 2)

    csv_path = _write_csv(
        tmp_path,
        "rooms_missing_columns.csv",
        "room_id,segment_key\n"
        "A-501,M_1st_year_AC_2\n",
    )

    try:
        ingest_rooms_csv(db_session, csv_path)
        raise AssertionError("Expected ValueError for missing required columns")
    except ValueError as exc:
        assert "Missing required columns" in str(exc)
