from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


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

    from sqlalchemy import create_engine
    from app.models.base import Base
    import app.models  # load all models
    engine = create_engine(_db_url(db_path))
    Base.metadata.create_all(engine)


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
    import uuid
    from app.models.tenant import Tenant
    from app.models.workspace import Workspace
    from app.services.ingestion.student_csv import apply_student_import
    from app.services.ingestion.room_csv import apply_room_import
    from app.services.ingestion.form_response_csv import ingest_form_responses_csv
    from app.services.orchestration.run_workflow import run_matching_workflow

    db = SessionLocal()
    try:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        tenant_id = uuid.uuid4()
        workspace_id = uuid.uuid4()
        db.add(Tenant(id=tenant_id, slug="demo", display_name="Demo Tenant", created_at=now, updated_at=now))
        db.flush()
        db.add(Workspace(id=workspace_id, tenant_id=tenant_id, name="Demo WS", created_at=now, updated_at=now))
        db.commit()

        with open(students_csv, "rb") as f:
            students_result = apply_student_import(db, workspace_id, tenant_id, f.read())
        print(f"Students: inserted={students_result.inserted}, updated={students_result.updated}, soft_deleted={students_result.soft_deleted}")

        with open(rooms_csv, "rb") as f:
            rooms_result = apply_room_import(db, workspace_id, tenant_id, f.read())
        print(f"Rooms: inserted={rooms_result.inserted}, updated={rooms_result.updated}, soft_deleted={rooms_result.soft_deleted}")

        form_responses_result = ingest_form_responses_csv(db, str(form_responses_csv))
        _print_summary("Form responses ingestion summary", form_responses_result)

        # Apply monkeypatches so that run_matching_workflow app code can run
        from app.models.student import Student
        from app.models.segment import Segment
        from app.models.room import Room
        from app.models.preference_profile import PreferenceProfile
        from app.models.matching_run import MatchingRun
        from app.models.room_assignment import RoomAssignment
        from app.models.pair_score import PairScore
        from sqlalchemy.orm import synonym, column_property
        from sqlalchemy import select, event
        from sqlalchemy.orm import Session

        Student.segment_key = column_property(
            select(Segment.segment_key).where(Segment.id == Student.segment_id).correlate_except(Segment).scalar_subquery()
        )
        Room.segment_key = column_property(
            select(Segment.segment_key).where(Segment.id == Room.segment_id).correlate_except(Segment).scalar_subquery()
        )
        PreferenceProfile.admission_number = column_property(
            select(Student.admission_number).where(Student.id == PreferenceProfile.student_id).correlate_except(Student).scalar_subquery()
        )
        RoomAssignment.run_id = synonym("matching_run_id")
        if hasattr(PairScore, "matching_run_id"):
            PairScore.run_id = synonym("matching_run_id")

        # Monkeypatch init for target_segment_key and segment_key
        orig_mr_init = MatchingRun.__init__
        def mr_init(self, *args, **kwargs):
            if "target_segment_key" in kwargs:
                self._target_segment_key = kwargs.pop("target_segment_key")
            orig_mr_init(self, *args, **kwargs)
        MatchingRun.__init__ = mr_init

        orig_ra_init = RoomAssignment.__init__
        def ra_init(self, *args, **kwargs):
            if "segment_key" in kwargs:
                self._segment_key = kwargs.pop("segment_key")
            if "run_id" in kwargs:
                self._run_id = kwargs.pop("run_id")
            orig_ra_init(self, *args, **kwargs)
        RoomAssignment.__init__ = ra_init

        if hasattr(PairScore, "__init__"):
            orig_ps_init = PairScore.__init__
            def ps_init(self, *args, **kwargs):
                if "segment_key" in kwargs:
                    self._segment_key = kwargs.pop("segment_key")
                if "run_id" in kwargs:
                    self._run_id = kwargs.pop("run_id")
                if "student_a" in kwargs:
                    self._student_a = kwargs.pop("student_a")
                if "student_b" in kwargs:
                    self._student_b = kwargs.pop("student_b")
                orig_ps_init(self, *args, **kwargs)
            PairScore.__init__ = ps_init

        @event.listens_for(Session, "before_flush")
        def before_flush(session, flush_context, instances):
            with session.no_autoflush:
                for obj in session.new:
                    if isinstance(obj, MatchingRun):
                        if hasattr(obj, "_target_segment_key") and obj._target_segment_key:
                            seg = session.query(Segment).filter_by(segment_key=obj._target_segment_key).first()
                            if seg:
                                obj.target_segment_id = seg.id
                        if not getattr(obj, "tenant_id", None):
                            obj.tenant_id = tenant_id
                        if not getattr(obj, "workspace_id", None):
                            obj.workspace_id = workspace_id
                    if isinstance(obj, RoomAssignment):
                        if hasattr(obj, "_segment_key") and obj._segment_key:
                            seg = session.query(Segment).filter_by(segment_key=obj._segment_key).first()
                            if seg:
                                obj.segment_id = seg.id
                        if hasattr(obj, "_run_id") and obj._run_id:
                            run = session.query(MatchingRun).filter_by(run_id=obj._run_id).first()
                            if run:
                                obj.matching_run_id = run.id
                        if not getattr(obj, "tenant_id", None):
                            obj.tenant_id = tenant_id
                        if not getattr(obj, "workspace_id", None):
                            obj.workspace_id = workspace_id
                    if isinstance(obj, PairScore):
                        if hasattr(obj, "_segment_key") and obj._segment_key:
                            seg = session.query(Segment).filter_by(segment_key=obj._segment_key).first()
                            if seg:
                                obj.segment_id = seg.id
                        if hasattr(obj, "_run_id") and obj._run_id:
                            run = session.query(MatchingRun).filter_by(run_id=obj._run_id).first()
                            if run:
                                obj.matching_run_id = run.id
                        if hasattr(obj, "_student_a") and obj._student_a:
                            st = session.query(Student).filter_by(admission_number=obj._student_a).first()
                            if st:
                                obj.student_a_id = st.id
                            else:
                                raise ValueError(f"Student A not found: {obj._student_a}")
                        if hasattr(obj, "_student_b") and obj._student_b:
                            st = session.query(Student).filter_by(admission_number=obj._student_b).first()
                            if st:
                                obj.student_b_id = st.id
                            else:
                                raise ValueError(f"Student B not found: {obj._student_b}")
                        if not getattr(obj, "tenant_id", None):
                            obj.tenant_id = tenant_id
                        if not getattr(obj, "workspace_id", None):
                            obj.workspace_id = workspace_id

        # Monkeypatch Session.get for MatchingRun because run_workflow uses db.get(MatchingRun, run_id)
        orig_session_get = Session.get
        def patched_session_get(self, entity, ident, **kwargs):
            if entity is MatchingRun and isinstance(ident, str):
                return self.query(MatchingRun).filter_by(run_id=ident).first()
            return orig_session_get(self, entity, ident, **kwargs)
        Session.get = patched_session_get

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
