from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.database import SessionLocal, get_db
from app.rate_limit import limiter
from app.services.demo_cleanup import purge_expired_demo_tenants
from app.services.orchestration.run_workflow import sweep_stale_runs

settings = get_settings()
logger = logging.getLogger(__name__)

from app.api.routes.auth import router as auth_router
from app.api.routes.checker import router as checker_router
from app.api.routes.exports import router as exports_router
from app.api.routes.fairness import router as fairness_router
from app.api.routes.matching import router as matching_router
from app.api.routes.workspaces import router as workspaces_router
from app.api.routes.public_form import router as public_form_router
from app.api.routes.platform import router as platform_router
from app.api.routes.internal import router as internal_router

_SHOWCASE_EXCLUDED_PREFIXES = ("/api", "/docs", "/redoc", "/static")
_SHOWCASE_EXCLUDED_EXACT_PATHS = {"/health", "/openapi.json"}

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Strict-Transport-Security": "max-age=31536000",
    "Content-Security-Policy": "object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        return response


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request.state.request_id = uuid.uuid4().hex
        response = await call_next(request)
        response.headers.setdefault("X-Request-ID", request.state.request_id)
        return response


def _is_showcase_excluded_path(path: str) -> bool:
    normalized = path if path.startswith("/") else f"/{path}"
    if normalized in _SHOWCASE_EXCLUDED_EXACT_PATHS:
        return True
    for prefix in _SHOWCASE_EXCLUDED_PREFIXES:
        if normalized == prefix or normalized.startswith(f"{prefix}/"):
            return True
    return False


def _is_within_directory(candidate: Path, directory: Path) -> bool:
    try:
        candidate.relative_to(directory)
    except ValueError:
        return False
    return True


def _default_frontend_dist_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "frontend" / "dist"


def _configure_showcase_routes(application: FastAPI, frontend_dist_dir: Path) -> None:
    dist_dir = frontend_dist_dir.resolve()
    index_file = dist_dir / "index.html"
    if not index_file.exists():
        return

    assets_dir = dist_dir / "assets"
    if assets_dir.exists():
        application.mount("/assets", StaticFiles(directory=assets_dir), name="showcase-assets")

    @application.get("/", include_in_schema=False)
    def serve_showcase_root() -> FileResponse:
        return FileResponse(index_file)

    @application.get("/{full_path:path}", include_in_schema=False)
    def serve_showcase_spa(full_path: str) -> FileResponse:
        normalized_path = f"/{full_path.lstrip('/')}"
        if _is_showcase_excluded_path(normalized_path):
            raise HTTPException(status_code=404, detail="Not Found")

        if full_path:
            candidate = (dist_dir / full_path).resolve()
            if candidate.is_file() and _is_within_directory(candidate, dist_dir):
                return FileResponse(candidate)

        return FileResponse(index_file)


@asynccontextmanager
async def _lifespan(_application: FastAPI):
    # An in-memory database cannot outlive a process, so only a real database
    # can still hold a run that the previous process left behind.
    if ":memory:" not in settings.database_url:
        db = SessionLocal()
        try:
            sweep_stale_runs(db, boot_time=datetime.now(UTC))
        except Exception:  # noqa: BLE001
            logger.exception("Failed to sweep stale matching runs on boot")
        try:
            purged = purge_expired_demo_tenants(db, limit=200)
            logger.info("Purged %d expired demo tenants on boot", len(purged))
        except Exception:  # noqa: BLE001
            logger.exception("Failed to purge expired demo tenants on boot")
        finally:
            db.close()
    yield


def create_app(*, frontend_dist_dir: Path | None = None) -> FastAPI:
    application = FastAPI(title=settings.app_name, lifespan=_lifespan)
    
    application.state.limiter = limiter
    application.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    application.add_middleware(SlowAPIMiddleware)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.add_middleware(SecurityHeadersMiddleware)
    application.add_middleware(RequestIDMiddleware)
    application.include_router(auth_router)  # auth router handles its own /api/auth prefix
    application.include_router(workspaces_router)
    application.include_router(public_form_router, prefix="/api/public/forms", tags=["public_form"])
    application.include_router(platform_router)
    application.include_router(matching_router)
    application.include_router(fairness_router)
    application.include_router(checker_router)
    application.include_router(exports_router)
    application.include_router(internal_router)

    @application.exception_handler(Exception)
    async def unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "Unhandled %s %s request_id=%s",
            request.method,
            request.url.path,
            getattr(request.state, "request_id", "-"),
        )
        return JSONResponse(status_code=500, content={"detail": "Internal server error."})

    @application.get("/health/live", include_in_schema=False)
    def health_live() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/health")
    def health(db: Session = Depends(get_db)) -> dict[str, str]:
        try:
            db.execute(text("SELECT 1"))
        except SQLAlchemyError as exc:
            raise HTTPException(
                status_code=503,
                detail="Database unavailable.",
            ) from exc
        return {"status": "ok", "environment": settings.app_env}

    _configure_showcase_routes(
        application,
        frontend_dist_dir if frontend_dist_dir is not None else _default_frontend_dist_dir(),
    )
    return application


app = create_app()
