from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.contracts import AuthenticatedUser
from app.auth.dependencies import get_tenant_context, require_workspace_access
from app.database import get_db
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.schemas.workspace import (
    WorkspaceCreateRequest,
    WorkspaceDashboardResponse,
    WorkspaceListResponse,
    WorkspaceResponse,
)
from app.services.dashboard.summary import get_workspace_dashboard_summary


router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


@router.get("", response_model=WorkspaceListResponse)
def list_workspaces(
    db: Session = Depends(get_db),
    tenant_ctx: tuple[AuthenticatedUser, Tenant] = Depends(get_tenant_context),
) -> WorkspaceListResponse:
    user, tenant = tenant_ctx
    workspaces = db.scalars(
        select(Workspace)
        .where(Workspace.tenant_id == tenant.id)
        .order_by(Workspace.created_at.desc())
    ).all()
    return WorkspaceListResponse(workspaces=list(workspaces))


@router.post("", response_model=WorkspaceResponse, status_code=201)
def create_workspace(
    body: WorkspaceCreateRequest,
    db: Session = Depends(get_db),
    tenant_ctx: tuple[AuthenticatedUser, Tenant] = Depends(get_tenant_context),
) -> WorkspaceResponse:
    user, tenant = tenant_ctx

    workspace = Workspace(
        tenant_id=tenant.id,
        name=body.name,
        status="draft",
        source="manual",
        created_by_supabase_user_id=uuid.UUID(user.supabase_user_id) if user.supabase_user_id else None,
    )
    db.add(workspace)
    db.commit()
    db.refresh(workspace)

    return workspace


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> WorkspaceResponse:
    user, tenant, workspace = workspace_ctx
    return workspace


@router.get("/{workspace_id}/dashboard", response_model=WorkspaceDashboardResponse)
def get_workspace_dashboard(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> WorkspaceDashboardResponse:
    user, tenant, workspace = workspace_ctx
    summary = get_workspace_dashboard_summary(db, workspace)

    return WorkspaceDashboardResponse(
        workspace=workspace,
        setup_status=summary.setup_status,
        form_collection_stats=summary.form_collection_stats,
        segments_status=summary.segments_status,
        latest_matching_run=summary.latest_matching_run,
    )
