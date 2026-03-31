from __future__ import annotations

import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.room_assignment import RoomAssignment


router = APIRouter(prefix="/exports", tags=["exports"])


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
                assignment.segment_key,
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
    run_id: str,
    segment_key: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    query = select(RoomAssignment).where(RoomAssignment.run_id == run_id)
    if segment_key:
        query = query.where(RoomAssignment.segment_key == segment_key)

    assignments = db.scalars(
        query.order_by(RoomAssignment.segment_key, RoomAssignment.room_id)
    ).all()
    if not assignments:
        raise HTTPException(status_code=404, detail="No assignment artifacts found for the given run")

    filename = f"assignments_{run_id}.csv" if not segment_key else f"assignments_{run_id}_{segment_key}.csv"
    return StreamingResponse(
        _iter_assignment_rows(run_id, assignments),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
