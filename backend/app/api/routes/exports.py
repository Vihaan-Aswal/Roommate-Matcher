from __future__ import annotations

import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import require_workspace_access
from app.models.tenant import Tenant
from app.auth.contracts import AuthenticatedUser
from app.models.workspace import Workspace
import uuid

from app.models.room_assignment import RoomAssignment
from app.models.matching_run import MatchingRun
from app.models.segment import Segment


from app.api.deps.run_access import resolve_run_or_403

router = APIRouter(prefix="/api/workspaces/{workspace_id}/exports", tags=["exports"])


def _iter_assignment_rows(run_id: str, assignments: list[RoomAssignment]):
    header = ["room_id", "segment_key", "student_1", "student_2", "student_3", "student_4", "group_score"]
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    yield buffer.getvalue()
    buffer.seek(0)
    buffer.truncate(0)

    for assignment in assignments:
        assigned_students = json.loads(assignment.assigned_students_json)
        if not isinstance(assigned_students, list):
            continue
        normalized = [str(item) for item in assigned_students][:4]
        while len(normalized) < 4:
            normalized.append("")

        writer.writerow(
            [
                assignment.room_id,
                getattr(assignment, "segment_key", "UNKNOWN"),
                normalized[0],
                normalized[1],
                normalized[2],
                normalized[3],
                f"{assignment.group_score:.4f}",
            ]
        )
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)


@router.get("/assignments/{run_id}")
def export_assignments_csv(
    workspace_id: uuid.UUID,
    run_id: str,
    segment_key: str | None = Query(default=None),
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> StreamingResponse:
    resolve_run_or_403(db, workspace_id, run_id)
    query = (
        select(RoomAssignment, Segment.segment_key)
        .join(MatchingRun, RoomAssignment.matching_run_id == MatchingRun.id)
        .join(Segment, RoomAssignment.segment_id == Segment.id)
        .where(MatchingRun.run_id == run_id, MatchingRun.workspace_id == workspace_id)
    )
    if segment_key:
        query = query.where(Segment.segment_key == segment_key)

    rows = db.execute(
        query.order_by(Segment.segment_key, RoomAssignment.room_id)
    ).all()
    
    assignments = []
    for row in rows:
        assignment = row[0]
        assignment.segment_key = row[1]
        assignments.append(assignment)
    if not assignments:
        raise HTTPException(status_code=404, detail="No assignment artifacts found for the given run")

    filename = f"assignments_{run_id}.csv" if not segment_key else f"assignments_{run_id}_{segment_key}.csv"
    return StreamingResponse(
        _iter_assignment_rows(run_id, assignments),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
