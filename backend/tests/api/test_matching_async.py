from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.matching_run import MatchingRun
from app.services.orchestration import run_queue
from app.services.orchestration.run_workflow import sweep_stale_runs
from tests.api.test_matching_endpoints import _seed_ready_segment_with_profiles

# The autouse test fixture replaces enqueue_matching_run; keep the real one for its own test.
_REAL_ENQUEUE = run_queue.enqueue_matching_run


def test_post_returns_running_and_rejects_a_second_run(
    client: TestClient,
    db_session: Session,
    seed_tenant_and_user,
    monkeypatch,
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    auth_headers = seed_tenant_and_user["headers"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    _seed_ready_segment_with_profiles(db_session, tenant_id, workspace_id)
    monkeypatch.setattr(run_queue, "enqueue_matching_run", lambda *args, **kwargs: None)

    response = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "segment", "segment_key": "M_1st_year_AC_2"},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "running"
    assert payload["message"] == "Matching run started."

    second = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "segment", "segment_key": "M_1st_year_AC_2"},
        headers=auth_headers,
    )
    assert second.status_code == 409
    assert (
        second.json()["detail"]
        == "A matching run is already in progress for this workspace."
    )


def test_sweep_stale_runs_fails_only_interrupted_rows(
    db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    boot_time = datetime.now(timezone.utc)

    db_session.add_all(
        [
            MatchingRun(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                run_id="run_old",
                scope="segment",
                status="running",
                started_at=boot_time - timedelta(hours=1),
            ),
            MatchingRun(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                run_id="run_recent",
                scope="segment",
                status="running",
                started_at=boot_time,
            ),
            MatchingRun(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                run_id="run_pending",
                scope="segment",
                status="pending",
                started_at=None,
            ),
        ]
    )
    db_session.commit()

    swept = sweep_stale_runs(db_session, boot_time=boot_time)

    assert swept == 2
    runs = {run.run_id: run for run in db_session.query(MatchingRun).all()}
    assert runs["run_old"].status == "failed"
    assert runs["run_old"].error_message == "Run interrupted by a server restart."
    assert runs["run_old"].finished_at is not None
    assert runs["run_pending"].status == "failed"
    assert runs["run_recent"].status == "running"
    assert runs["run_recent"].finished_at is None


def test_run_list_reports_queue_progress(
    client: TestClient,
    db_session: Session,
    seed_tenant_and_user,
    monkeypatch,
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    auth_headers = seed_tenant_and_user["headers"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    db_session.add(
        MatchingRun(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            run_id="run_in_progress",
            scope="segment",
            status="running",
            started_at=datetime.now(timezone.utc),
        )
    )
    db_session.commit()
    monkeypatch.setitem(run_queue._PROGRESS, "run_in_progress", (1, 3))

    response = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs", headers=auth_headers
    )
    assert response.status_code == 200, response.text
    row = next(
        item for item in response.json()["runs"] if item["run_id"] == "run_in_progress"
    )
    assert row["status"] == "running"
    assert row["segments_completed"] == 1


class _FakeSession:
    closed = False

    def close(self) -> None:
        self.closed = True


def test_enqueue_records_initial_progress(monkeypatch) -> None:
    submitted: list[tuple] = []
    monkeypatch.setattr(run_queue, "enqueue_matching_run", _REAL_ENQUEUE)
    monkeypatch.setattr(
        run_queue, "_EXECUTOR", SimpleNamespace(submit=lambda *args: submitted.append(args))
    )
    run_row_id, segment_id, workspace_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()

    try:
        run_queue.enqueue_matching_run(
            run_row_id, "run_waiting", [segment_id], workspace_id, "segment"
        )
        assert run_queue._PROGRESS["run_waiting"] == (0, 1)
        assert submitted == [
            (
                run_queue._run_matching_job,
                run_row_id,
                "run_waiting",
                [segment_id],
                workspace_id,
                "segment",
            )
        ]
    finally:
        run_queue._PROGRESS.pop("run_waiting", None)


def test_queue_worker_closes_its_session_and_clears_progress(monkeypatch) -> None:
    db = _FakeSession()
    monkeypatch.setattr(run_queue, "SessionLocal", lambda: db)
    monkeypatch.setattr(
        run_queue,
        "execute_matching_run",
        lambda session, run_row_id, segment_ids, scope, on_segment_done=None: on_segment_done(
            1, 1
        ),
    )
    run_queue._PROGRESS["run_queued"] = (0, 1)

    run_queue._run_matching_job(
        uuid.uuid4(), "run_queued", [uuid.uuid4()], uuid.uuid4(), "segment"
    )

    assert db.closed is True
    assert "run_queued" not in run_queue._PROGRESS


def test_queue_worker_survives_a_failed_run(monkeypatch) -> None:
    db = _FakeSession()
    monkeypatch.setattr(run_queue, "SessionLocal", lambda: db)

    def _fail(*args, **kwargs):
        raise ValueError("boom")

    monkeypatch.setattr(run_queue, "execute_matching_run", _fail)
    run_queue._PROGRESS["run_failed"] = (0, 1)

    run_queue._run_matching_job(
        uuid.uuid4(), "run_failed", [uuid.uuid4()], uuid.uuid4(), "segment"
    )

    assert db.closed is True
    assert "run_failed" not in run_queue._PROGRESS
