"""
platform.py — God-Mode / Super Admin API routes.

All routes here are guarded by require_platform_admin().
No route in this file should be callable by a non-admin user — the
dependency enforces this at the FastAPI dependency injection layer.

Route prefix: /api/platform
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.contracts import AuthenticatedUser
from app.auth.dependencies import require_platform_admin
from app.database import get_db
from app.models import Tenant, Workspace
from app.services.platform.impersonation import issue_impersonation_token

router = APIRouter(prefix="/api/platform", tags=["platform"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class TenantRow(BaseModel):
    id: str
    slug: str
    display_name: str
    contact_email: str | None
    is_demo: bool
    demo_expires_at: str | None
    created_at: str
    workspace_count: int

    class Config:
        from_attributes = True


class TenantListResponse(BaseModel):
    tenants: list[TenantRow]
    total: int


class WorkspaceRow(BaseModel):
    id: str
    name: str
    status: str
    source: str
    is_demo_seeded: bool
    created_at: str

    class Config:
        from_attributes = True


class WorkspaceListResponse(BaseModel):
    tenant_id: str
    workspaces: list[WorkspaceRow]


class ImpersonateRequest(BaseModel):
    workspace_id: str    # required: admin must choose a workspace first


class ImpersonateResponse(BaseModel):
    token: str
    tenant_id: str
    workspace_id: str
    expires_in_hours: int


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/tenants", response_model=TenantListResponse)
def list_tenants(
    admin: Annotated[AuthenticatedUser, Depends(require_platform_admin)],
    db: Annotated[Session, Depends(get_db)],
    include_demo: bool = False,
):
    """
    List all tenants visible to the platform admin.
    By default excludes demo tenants (include_demo=true to include them).
    """
    query = db.query(Tenant)
    if not include_demo:
        query = query.filter(Tenant.is_demo == False)  # noqa: E712
    tenants = query.order_by(Tenant.created_at.desc()).all()

    rows: list[TenantRow] = []
    for t in tenants:
        wc = db.query(Workspace).filter(Workspace.tenant_id == t.id).count()
        rows.append(
            TenantRow(
                id=str(t.id),
                slug=t.slug,
                display_name=t.display_name,
                contact_email=t.contact_email,
                is_demo=t.is_demo,
                demo_expires_at=t.demo_expires_at.isoformat() if t.demo_expires_at else None,
                created_at=t.created_at.isoformat(),
                workspace_count=wc,
            )
        )

    return TenantListResponse(tenants=rows, total=len(rows))


@router.get("/tenants/{tenant_id}", response_model=TenantRow)
def get_tenant(
    tenant_id: uuid.UUID,
    admin: Annotated[AuthenticatedUser, Depends(require_platform_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """Get one tenant by ID."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found.")
    wc = db.query(Workspace).filter(Workspace.tenant_id == tenant.id).count()
    return TenantRow(
        id=str(tenant.id),
        slug=tenant.slug,
        display_name=tenant.display_name,
        contact_email=tenant.contact_email,
        is_demo=tenant.is_demo,
        demo_expires_at=tenant.demo_expires_at.isoformat() if tenant.demo_expires_at else None,
        created_at=tenant.created_at.isoformat(),
        workspace_count=wc,
    )


@router.get("/tenants/{tenant_id}/workspaces", response_model=WorkspaceListResponse)
def list_tenant_workspaces(
    tenant_id: uuid.UUID,
    admin: Annotated[AuthenticatedUser, Depends(require_platform_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """List all workspaces belonging to a tenant."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found.")

    workspaces = (
        db.query(Workspace)
        .filter(Workspace.tenant_id == tenant_id)
        .order_by(Workspace.created_at.desc())
        .all()
    )

    rows = [
        WorkspaceRow(
            id=str(w.id),
            name=w.name,
            status=w.status,
            source=w.source,
            is_demo_seeded=w.is_demo_seeded,
            created_at=w.created_at.isoformat(),
        )
        for w in workspaces
    ]
    return WorkspaceListResponse(tenant_id=str(tenant_id), workspaces=rows)


@router.post("/tenants/{tenant_id}/impersonate", response_model=ImpersonateResponse)
def impersonate_tenant(
    tenant_id: uuid.UUID,
    body: ImpersonateRequest,
    admin: Annotated[AuthenticatedUser, Depends(require_platform_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Issue a short-lived impersonation JWT for a specific tenant + workspace.

    Steps:
    1. Verify tenant exists.
    2. Verify workspace belongs to that tenant.
    3. Issue app JWT with impersonated_tenant claim.
    4. Write audit log row.
    5. Return token to frontend.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found.")

    workspace_uuid = uuid.UUID(body.workspace_id)
    workspace = (
        db.query(Workspace)
        .filter(Workspace.id == workspace_uuid, Workspace.tenant_id == tenant_id)
        .first()
    )
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or does not belong to this tenant.",
        )

    token = issue_impersonation_token(
        admin_email=admin.email,
        admin_supabase_user_id=admin.supabase_user_id,
        tenant=tenant,
        workspace=workspace,
        db=db,
    )

    return ImpersonateResponse(
        token=token,
        tenant_id=str(tenant_id),
        workspace_id=body.workspace_id,
        expires_in_hours=4,
    )
