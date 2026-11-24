from __future__ import annotations

import logging
import uuid
from concurrent.futures import ThreadPoolExecutor

from app.database import SessionLocal
from app.services.orchestration.run_workflow import execute_matching_run

# shortcut: in-process single-worker queue; it dies with the process and breaks with more than one uvicorn worker; move to a durable worker before either changes.
_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="matching")
_PROGRESS: dict[str, tuple[int, int]] = {}
logger = logging.getLogger(__name__)


def _run_matching_job(
    run_row_id: uuid.UUID,
    run_id: str,
    segment_ids: list[uuid.UUID],
    workspace_id: uuid.UUID,
    scope: str,
) -> None:
    db = SessionLocal()
    try:
        execute_matching_run(
            db,
            run_row_id,
            segment_ids,
            scope,
            on_segment_done=lambda done, total: _PROGRESS.__setitem__(run_id, (done, total)),
        )
    except Exception:  # noqa: BLE001
        logger.exception("Matching run %s failed for workspace %s", run_id, workspace_id)
    finally:
        _PROGRESS.pop(run_id, None)
        db.close()


def enqueue_matching_run(
    run_row_id: uuid.UUID,
    run_id: str,
    segment_ids: list[uuid.UUID],
    workspace_id: uuid.UUID,
    scope: str,
) -> None:
    _PROGRESS[run_id] = (0, len(segment_ids))
    _EXECUTOR.submit(_run_matching_job, run_row_id, run_id, segment_ids, workspace_id, scope)


def progress_snapshot() -> dict[str, tuple[int, int]]:
    return dict(_PROGRESS)
