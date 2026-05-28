from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
import uuid
from app.models.matching_run import MatchingRun

def resolve_run_or_403(db: Session, workspace_id: uuid.UUID, run_id_str: str) -> MatchingRun:
    run = db.scalars(select(MatchingRun).where(
        MatchingRun.run_id == run_id_str,
        MatchingRun.workspace_id == workspace_id
    )).first()
    if not run:
        raise HTTPException(status_code=403, detail="run_not_found_or_not_owned")
    return run
