from pydantic import BaseModel


class MagicFillRequest(BaseModel):
    """
    Optional segment scope for Magic Fill.

    If segment_key is None or omitted, fill ALL missing active
    students in the workspace.
    If segment_key is provided, fill only that segment.
    """
    segment_key: str | None = None


class MagicFillResponse(BaseModel):
    workspace_id: str
    segment_key: str | None
    profiles_created: int
    students_skipped: int
