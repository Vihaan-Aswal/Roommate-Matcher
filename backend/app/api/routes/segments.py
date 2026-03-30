from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.segment import SegmentStatusResponse
from app.services.segments.status import compute_segment_status


router = APIRouter(prefix="/segments", tags=["segments"])


@router.get("/{segment_key}", response_model=SegmentStatusResponse)
def get_segment_status(
    segment_key: str,
    db: Session = Depends(get_db),
) -> SegmentStatusResponse:
    try:
        status = compute_segment_status(db, segment_key)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return SegmentStatusResponse(**status.as_dict())
