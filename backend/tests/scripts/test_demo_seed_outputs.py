from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.api.routes.exports import _iter_assignment_rows
from app.models.matching_run import MatchingRun
from app.models.room_assignment import RoomAssignment


CSV_HEADER = "room_id,segment_key,student_1,student_2,student_3,student_4,group_score"


def _run_demo_seed(database_path: Path) -> subprocess.CompletedProcess[str]:
    repo_root = Path(__file__).resolve().parents[3]
    script_path = repo_root / "demo-data" / "seed.py"

    command = [
        sys.executable,
        str(script_path),
        "--database-path",
        str(database_path),
        "--reset",
        "--run-matching",
    ]

    return subprocess.run(
        command,
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )


def test_demo_seed_outputs_cover_label_spread_and_export_contract(tmp_path: Path) -> None:
    db_path = tmp_path / "demo_seed.db"
    result = _run_demo_seed(db_path)

    assert result.returncode == 0, result.stderr

    engine = create_engine(
        f"sqlite:///{db_path.as_posix()}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    session_local = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = session_local()

    try:
        latest_run = session.scalars(
            select(MatchingRun).order_by(MatchingRun.created_at.desc())
        ).first()

        assert latest_run is not None
        assert latest_run is not None

        assignments = session.scalars(
            select(RoomAssignment)
            .where(RoomAssignment.matching_run_id == latest_run.id)
            .order_by(RoomAssignment.segment_id, RoomAssignment.room_id)
        ).all()

        assert assignments

        labels: list[str] = []
        at_risk_count = 0
        explanation_count = 0

        for assignment in assignments:
            summary = json.loads(assignment.satisfaction_summary_json or "{}")
            students = summary.get("students", [])
            assert isinstance(students, list)
            assert students

            for student in students:
                assert isinstance(student, dict)
                labels.append(str(student.get("satisfaction_label", "")))

                if bool(student.get("is_at_risk", False)):
                    at_risk_count += 1

                reasons = student.get("reasons", [])
                assert isinstance(reasons, list)
                assert reasons
                explanation_count += len(reasons)

        assert "Excellent" in labels
        assert "Poor" in labels
        assert at_risk_count > 0
        assert explanation_count > 0

        csv_text = "".join(_iter_assignment_rows(latest_run.id, assignments)).strip()
        csv_rows = [row for row in csv_text.splitlines() if row]

        assert csv_rows[0] == CSV_HEADER
        assert len(csv_rows) == len(assignments) + 1
    finally:
        session.close()
        engine.dispose()
