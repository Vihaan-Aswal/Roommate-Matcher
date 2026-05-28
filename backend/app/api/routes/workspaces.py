from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
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
from app.schemas.ingestion import (
    StudentImportDiffResponse, StudentImportApplyResponse, StudentDiffEntry,
    RoomImportDiffResponse, RoomImportApplyResponse, RoomDiffEntry,
)
from app.services.ingestion.student_csv import plan_student_import, apply_student_import
from app.services.ingestion.room_csv import plan_room_import, apply_room_import
from app.services.public_form.token_service import get_active_token, regenerate_token
from app.services.ingestion.form_collection import compute_form_collection_status, list_non_submitters
from app.schemas.workspace import FormLinkResponse
from app.schemas.form import FormStatusResponse, NonSubmittersResponse, NonSubmitterResponseRow
from app.schemas.segment import SegmentListResponse, SegmentStatusResponse, SegmentStudentsResponse
from app.services.segments.status import compute_segment_status, get_segment_students_preference_status, list_segment_overviews


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
        created_by_supabase_user_id=uuid.UUID(user.supabase_user_id) if not user.is_demo else None,
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


@router.get("/{workspace_id}/form-link", response_model=FormLinkResponse)
def get_form_link(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> FormLinkResponse:
    user, tenant, workspace = workspace_ctx
    token = get_active_token(db, workspace.id)
    if not token:
        token = regenerate_token(db, workspace.id)
    return FormLinkResponse(token=token)


@router.post("/{workspace_id}/form-link/regenerate", response_model=FormLinkResponse)
def regenerate_form_link(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> FormLinkResponse:
    user, tenant, workspace = workspace_ctx
    token = regenerate_token(db, workspace.id)
    return FormLinkResponse(token=token)


@router.get("/{workspace_id}/collection/status", response_model=FormStatusResponse)
def get_form_status(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> FormStatusResponse:
    user, tenant, workspace = workspace_ctx
    result = compute_form_collection_status(db, workspace.id)
    return FormStatusResponse(
        total_students=result.total_students,
        valid_responses=result.valid_responses,
        invalid_responses=result.invalid_responses,
        percentage_valid=result.percentage_valid,
        by_segment=[
            {
                "segment_key": row.segment_key,
                "total": row.total,
                "valid": row.valid,
                "percentage": row.percentage,
            }
            for row in result.by_segment
        ],
    )


@router.get("/{workspace_id}/collection/non-submitters", response_model=NonSubmittersResponse)
def get_non_submitters(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> NonSubmittersResponse:
    user, tenant, workspace = workspace_ctx
    rows = list_non_submitters(db, workspace.id)
    records = [
        NonSubmitterResponseRow(
            admission_number=row.admission_number,
            full_name=row.full_name,
            segment_key=row.segment_key,
        )
        for row in rows
    ]
    return NonSubmittersResponse(non_submitters=records, total_count=len(records))


@router.post("/{workspace_id}/students/upload/preview", response_model=StudentImportDiffResponse)
async def preview_student_upload(
    workspace_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> StudentImportDiffResponse:
    """
    Parse the uploaded CSV in-memory and return a diff preview.
    No database changes are made.
    """
    user, tenant, workspace = workspace_ctx
    csv_bytes = await file.read()

    try:
        diff = plan_student_import(db, workspace.id, tenant.id, csv_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return StudentImportDiffResponse(
        workspace_id=str(workspace.id),
        total_csv_rows=diff.total_csv_rows,
        valid_csv_rows=diff.valid_csv_rows,
        to_insert=len(diff.to_insert),
        to_update=len(diff.to_update),
        to_soft_delete=len(diff.to_soft_delete),
        unchanged=len(diff.unchanged),
        validation_errors=diff.validation_errors,
        diff_entries=[
            StudentDiffEntry(**e) for e in diff.to_insert + diff.to_update + diff.to_soft_delete
        ],
        warnings=diff.workspace_warnings,
    )


@router.post("/{workspace_id}/students/upload/apply", response_model=StudentImportApplyResponse)
async def apply_student_upload(
    workspace_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> StudentImportApplyResponse:
    """
    Parse the uploaded CSV in-memory and apply the upsert.
    This is the confirmation step after the user reviews the diff preview.
    """
    user, tenant, workspace = workspace_ctx
    csv_bytes = await file.read()

    try:
        apply_result = apply_student_import(db, workspace.id, tenant.id, csv_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return StudentImportApplyResponse(
        workspace_id=str(workspace.id),
        inserted=apply_result.inserted,
        updated=apply_result.updated,
        soft_deleted=apply_result.soft_deleted,
        unchanged=apply_result.unchanged,
        segments_created=apply_result.segments_created,
        errors=apply_result.errors,
    )


@router.post("/{workspace_id}/rooms/upload/preview", response_model=RoomImportDiffResponse)
async def preview_room_upload(
    workspace_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> RoomImportDiffResponse:
    user, tenant, workspace = workspace_ctx
    csv_bytes = await file.read()

    try:
        diff = plan_room_import(db, workspace.id, tenant.id, csv_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return RoomImportDiffResponse(
        workspace_id=str(workspace.id),
        total_csv_rows=diff.total_csv_rows,
        valid_csv_rows=diff.valid_csv_rows,
        to_insert=len(diff.to_insert),
        to_update=len(diff.to_update),
        to_soft_delete=len(diff.to_soft_delete),
        unchanged=len(diff.unchanged),
        validation_errors=diff.validation_errors,
        diff_entries=[
            RoomDiffEntry(**e) for e in diff.to_insert + diff.to_update + diff.to_soft_delete
        ],
        warnings=diff.workspace_warnings,
    )


@router.post("/{workspace_id}/rooms/upload/apply", response_model=RoomImportApplyResponse)
async def apply_room_upload(
    workspace_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> RoomImportApplyResponse:
    user, tenant, workspace = workspace_ctx
    csv_bytes = await file.read()

    try:
        apply_result = apply_room_import(db, workspace.id, tenant.id, csv_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return RoomImportApplyResponse(
        workspace_id=str(workspace.id),
        inserted=apply_result.inserted,
        updated=apply_result.updated,
        soft_deleted=apply_result.soft_deleted,
        unchanged=apply_result.unchanged,
        errors=apply_result.errors,
    )


@router.get("/{workspace_id}/segments", response_model=SegmentListResponse)
def list_workspace_segments(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> SegmentListResponse:
    user, tenant, workspace = workspace_ctx
    rows = list_segment_overviews(db, workspace_id)
    return SegmentListResponse(
        segments=[
            {
                "segment_key": row.segment_key,
                "gender": row.gender,
                "year_group": row.year_group,
                "ac_type": row.ac_type,
                "room_size": row.room_size,
                "status": row.status,
                "student_count": row.student_count,
                "total_capacity": row.total_capacity,
                "missing_preferences_count": row.missing_preferences_count,
                "missing_preferences_ratio": row.missing_preferences_ratio,
            }
            for row in rows
        ]
    )


@router.get("/{workspace_id}/segments/{segment_key}", response_model=SegmentStatusResponse)
def get_workspace_segment_status(
    workspace_id: uuid.UUID,
    segment_key: str,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> SegmentStatusResponse:
    user, tenant, workspace = workspace_ctx
    try:
        status = compute_segment_status(db, segment_key, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return SegmentStatusResponse(**status.as_dict())


@router.get("/{workspace_id}/segments/{segment_key}/students", response_model=SegmentStudentsResponse)
def get_workspace_segment_students(
    workspace_id: uuid.UUID,
    segment_key: str,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> SegmentStudentsResponse:
    user, tenant, workspace = workspace_ctx
    try:
        result = get_segment_students_preference_status(db, segment_key, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return SegmentStudentsResponse(
        segment_key=result.segment_key,
        room_size=result.room_size,
        students=[
            {
                "admission_number": row.admission_number,
                "full_name": row.full_name,
                "has_valid_preferences": row.has_valid_preferences,
                "preference_status": row.preference_status,
            }
            for row in result.students
        ],
    )
