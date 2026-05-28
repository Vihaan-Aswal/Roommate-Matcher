from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class WorkspaceCreateRequest(BaseModel):
    name: str


class FormLinkResponse(BaseModel):
    token: str


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    status: str
    source: str
    is_demo_seeded: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkspaceListResponse(BaseModel):
    workspaces: list[WorkspaceResponse]


class WorkspaceDashboardResponse(BaseModel):
    workspace: WorkspaceResponse
    setup_status: dict[str, bool]
    form_collection_stats: dict[str, float | int]
    segments_status: dict[str, int]
    latest_matching_run: dict[str, Any]
