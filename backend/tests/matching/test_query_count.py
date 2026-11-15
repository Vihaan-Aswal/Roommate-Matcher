from __future__ import annotations

import uuid

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.models.matching_run import MatchingRun
from app.models.room_assignment import RoomAssignment
from app.models.segment import Segment
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.services.orchestration.run_workflow import list_matching_runs


def _seed(db: Session) -> tuple[uuid.UUID, uuid.UUID]:
    tenant = Tenant(slug=f"t-{uuid.uuid4().hex[:8]}", display_name="T")
    db.add(tenant)
    db.flush()
    workspace = Workspace(tenant_id=tenant.id, name="W", status="active", source="manual")
    db.add(workspace)
    db.flush()
    return tenant.id, workspace.id


def _statement_counter(db: Session):
    statements: list[str] = []

    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(db.bind, "before_cursor_execute", before_cursor_execute)
    return statements, before_cursor_execute


def test_list_matching_runs_uses_one_query_for_all_segment_counts(db_session: Session) -> None:
    tenant_id, workspace_id = _seed(db_session)
    segment = Segment(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_key="M_1st_year_AC_2",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()

    for index in range(5):
        run = MatchingRun(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            run_id=f"run_test_{index}",
            scope="all_ready_segments",
            status="completed",
        )
        db_session.add(run)
        db_session.flush()
        for room in range(2):
            db_session.add(
                RoomAssignment(
                    tenant_id=tenant_id,
                    workspace_id=workspace_id,
                    matching_run_id=run.id,
                    segment_id=segment.id,
                    room_id=f"R{room}",
                    room_label=f"R{room}",
                    assigned_students_json="[]",
                    group_score=0.5,
                    satisfaction_summary_json="{}",
                    needs_review=0,
                )
            )
    db_session.commit()

    statements, listener = _statement_counter(db_session)
    items = list_matching_runs(db_session, workspace_id)
    event.remove(db_session.bind, "before_cursor_execute", listener)

    assert len(items) == 5
    assert all(item.segments_completed == 1 for item in items)
    selects = [statement for statement in statements if statement.lstrip().upper().startswith("SELECT")]
    assert len(selects) <= 2, f"expected 2 queries, got {len(selects)}: {selects}"
