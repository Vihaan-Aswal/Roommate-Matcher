from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
DEFAULT_DB_PATH = ROOT_DIR / "data" / "app.db"
DEFAULT_STUDENTS_CSV = ROOT_DIR / "demo-data" / "master_students.csv"
DEFAULT_ROOMS_CSV = ROOT_DIR / "demo-data" / "rooms.csv"
DEFAULT_FORM_RESPONSES_CSV = ROOT_DIR / "demo-data" / "form_responses.csv"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def _resolve_path(value: str) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    return (ROOT_DIR / path).resolve()


def _db_url(path: Path) -> str:
    return f"sqlite:///{path.as_posix()}"


def _rebuild_schema_via_migrations(db_path: Path, reset: bool) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if reset and db_path.exists():
        db_path.unlink()

    alembic_cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", _db_url(db_path))
    command.upgrade(alembic_cfg, "head")


def _print_summary(name: str, result: dict[str, object]) -> None:
    print(f"\n{name}")
    print("-" * len(name))
    print(f"Total rows: {result['total_rows']}")
    print(f"Accepted rows: {result['accepted_rows']}")
    print(f"Rejected rows: {result['rejected_rows']}")
    print(f"Duplicate rows: {result['duplicate_rows']}")
    invalid_rows = result.get("invalid_rows", [])
    if invalid_rows:
        print("Invalid row details:")
        print(json.dumps(invalid_rows, indent=2))


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed demo data with Alembic-managed schema setup.")
    parser.add_argument(
        "--database-path",
        default=str(DEFAULT_DB_PATH),
        help="SQLite database path (absolute or relative to repository root).",
    )
    parser.add_argument(
        "--students-csv",
        default=str(DEFAULT_STUDENTS_CSV),
        help="Path to master students CSV.",
    )
    parser.add_argument(
        "--rooms-csv",
        default=str(DEFAULT_ROOMS_CSV),
        help="Path to rooms CSV.",
    )
    parser.add_argument(
        "--form-responses-csv",
        default=str(DEFAULT_FORM_RESPONSES_CSV),
        help="Path to form responses CSV.",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete the existing SQLite DB file before running Alembic migrations.",
    )
    parser.add_argument(
        "--schema-only",
        action="store_true",
        help="Run Alembic migrations only and skip CSV ingestion.",
    )
    parser.add_argument(
        "--run-matching",
        action="store_true",
        help="Run matching for all ready segments after seeding CSV data.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    db_path = _resolve_path(args.database_path)
    students_csv = _resolve_path(args.students_csv)
    rooms_csv = _resolve_path(args.rooms_csv)
    form_responses_csv = _resolve_path(args.form_responses_csv)

    os.environ["DATABASE_URL"] = _db_url(db_path)

    _rebuild_schema_via_migrations(db_path, reset=args.reset)

    if args.schema_only:
        print(f"Schema rebuilt via Alembic migrations at: {db_path}")
        return

    for path in [students_csv, rooms_csv, form_responses_csv]:
        if not path.exists():
            raise FileNotFoundError(f"Required seed file not found: {path}")

    from app.database import SessionLocal
    from app.services.ingestion.form_response_csv import ingest_form_responses_csv
    from app.services.ingestion.room_csv import ingest_rooms_csv
    from app.services.ingestion.student_csv import ingest_students_csv
    from app.services.orchestration.run_workflow import run_matching_workflow

    db = SessionLocal()
    try:
        students_result = ingest_students_csv(db, str(students_csv))
        _print_summary("Student ingestion summary", students_result)

        rooms_result = ingest_rooms_csv(db, str(rooms_csv))
        _print_summary("Room ingestion summary", rooms_result)

        form_responses_result = ingest_form_responses_csv(db, str(form_responses_csv))
        _print_summary("Form responses ingestion summary", form_responses_result)

        if args.run_matching:
            run_result = run_matching_workflow(db, "all_ready_segments", None)
            print("\nMatching run summary")
            print("--------------------")
            print(f"Run ID: {run_result.run_id}")
            print(f"Status: {run_result.status}")
            print(f"Segments matched: {run_result.segments_matched}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
