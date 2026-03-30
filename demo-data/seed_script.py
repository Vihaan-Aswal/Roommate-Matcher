from __future__ import annotations

import json
import os
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

database_path = ROOT_DIR / "data" / "app.db"
database_path.parent.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")

import app.models  # noqa: E402, F401
from app.database import SessionLocal, engine  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.services.ingestion.room_csv import ingest_rooms_csv  # noqa: E402
from app.services.ingestion.student_csv import ingest_students_csv  # noqa: E402


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


def main() -> None:
    students_csv = ROOT_DIR / "demo-data" / "master_students.csv"
    rooms_csv = ROOT_DIR / "demo-data" / "rooms.csv"

    if not students_csv.exists() or not rooms_csv.exists():
        raise FileNotFoundError("Demo CSV files not found. Ensure demo-data files exist.")

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        students_result = ingest_students_csv(db, str(students_csv))
        _print_summary("Student ingestion summary", students_result)

        rooms_result = ingest_rooms_csv(db, str(rooms_csv))
        _print_summary("Room ingestion summary", rooms_result)
    finally:
        db.close()


if __name__ == "__main__":
    main()
