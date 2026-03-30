from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.segment import Segment
from app.models.student import Student
from app.services.ingestion.student_csv import ingest_students_csv


def _write_csv(tmp_path: Path, name: str, content: str) -> str:
    file_path = tmp_path / name
    file_path.write_text(content, encoding="utf-8")
    return str(file_path)


def test_ingest_students_csv_accepts_valid_rows(db_session: Session, tmp_path: Path) -> None:
    csv_path = _write_csv(
        tmp_path,
        "students.csv",
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob\n"
        "ADM001,Alex M,m,1st_year,ac,2,2005-01-01\n"
        "ADM002,Sam F,F,1st_year,NonAC,3,2004-02-02\n",
    )

    result = ingest_students_csv(db_session, csv_path)

    assert result["accepted_rows"] == 2
    assert result["rejected_rows"] == 0
    assert result["duplicate_rows"] == 0

    students = db_session.scalars(select(Student).order_by(Student.admission_number)).all()
    assert len(students) == 2
    assert students[0].segment_key == "M_1st_year_AC_2"
    assert students[1].segment_key == "F_1st_year_NonAC_3"

    segments = db_session.scalars(select(Segment).order_by(Segment.segment_key)).all()
    assert [segment.segment_key for segment in segments] == ["F_1st_year_NonAC_3", "M_1st_year_AC_2"]


def test_ingest_students_csv_uses_valid_segment_override(db_session: Session, tmp_path: Path) -> None:
    csv_path = _write_csv(
        tmp_path,
        "students_override.csv",
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,segment_override\n"
        "ADM003,Jane D,F,2nd_to_4th,NonAC,4,2003-05-10,F_2nd_to_4th_NonAC_4\n",
    )

    result = ingest_students_csv(db_session, csv_path)

    assert result["accepted_rows"] == 1
    student = db_session.get(Student, "ADM003")
    assert student is not None
    assert student.segment_key == "F_2nd_to_4th_NonAC_4"


def test_ingest_students_csv_rejects_conflicting_segment_override(db_session: Session, tmp_path: Path) -> None:
    csv_path = _write_csv(
        tmp_path,
        "students_override_conflict.csv",
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,segment_override\n"
        "ADM004,Mark T,M,1st_year,AC,2,2005-03-03,F_1st_year_AC_2\n",
    )

    result = ingest_students_csv(db_session, csv_path)

    assert result["accepted_rows"] == 0
    assert result["rejected_rows"] == 1
    assert result["invalid_rows"][0]["field"] == "segment_override"
    assert result["invalid_rows"][0]["reason"] == "segment_override_conflicts_with_row_dimensions"
    assert db_session.get(Student, "ADM004") is None


def test_ingest_students_csv_rejects_duplicates(db_session: Session, tmp_path: Path) -> None:
    existing = Segment(
        segment_key="M_1st_year_AC_2",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(existing)
    db_session.add(
        Student(
            admission_number="ADM005",
            full_name="Already Present",
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
            dob=date(2005, 4, 4),
            segment_key="M_1st_year_AC_2",
        )
    )
    db_session.commit()

    csv_path = _write_csv(
        tmp_path,
        "students_duplicates.csv",
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob\n"
        "ADM005,Dup Existing,M,1st_year,AC,2,2005-04-04\n"
        "ADM006,Unique User,M,1st_year,AC,2,2005-05-05\n"
        "ADM006,Dup File,M,1st_year,AC,2,2005-06-06\n",
    )

    result = ingest_students_csv(db_session, csv_path)

    assert result["accepted_rows"] == 1
    assert result["rejected_rows"] == 2
    assert result["duplicate_rows"] == 2
    reasons = [entry["reason"] for entry in result["invalid_rows"]]
    assert "admission_number_already_exists" in reasons
    assert "duplicate_admission_number_in_file" in reasons


def test_ingest_students_csv_rejects_missing_columns(db_session: Session, tmp_path: Path) -> None:
    csv_path = _write_csv(
        tmp_path,
        "students_missing_columns.csv",
        "admission_number,full_name,gender,year_group,room_size,dob\n"
        "ADM007,No Ac Type,F,1st_year,2,2005-07-07\n",
    )

    try:
        ingest_students_csv(db_session, csv_path)
        raise AssertionError("Expected ValueError for missing required columns")
    except ValueError as exc:
        assert "Missing required columns" in str(exc)
