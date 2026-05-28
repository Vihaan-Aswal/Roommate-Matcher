from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes.auth import router as auth_router
from app.api.routes.checker import router as checker_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.exports import router as exports_router
from app.api.routes.fairness import router as fairness_router
from app.api.routes.form import router as form_router
from app.api.routes.matching import router as matching_router
from app.api.routes.segments import router as segments_router
from app.api.routes.workspaces import router as workspaces_router
from app.api.routes.public_form import router as public_form_router
from app.config import get_settings

settings = get_settings()
_SHOWCASE_EXCLUDED_PREFIXES = ("/api", "/docs", "/redoc", "/static")
_SHOWCASE_EXCLUDED_EXACT_PATHS = {"/health", "/openapi.json"}


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


def create_app(*, frontend_dist_dir: Path | None = None) -> FastAPI:
    application = FastAPI(title=settings.app_name)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(auth_router)  # auth router handles its own /api/auth prefix
    application.include_router(workspaces_router)
    application.include_router(public_form_router, prefix="/api/public/forms", tags=["public_form"])
    application.include_router(form_router, prefix="/api")
    application.include_router(segments_router, prefix="/api")
    application.include_router(matching_router)
    application.include_router(fairness_router)
    application.include_router(checker_router)
    application.include_router(exports_router)
    application.include_router(dashboard_router, prefix="/api")

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "environment": settings.app_env}

    _configure_showcase_routes(
        application,
        frontend_dist_dir if frontend_dist_dir is not None else _default_frontend_dist_dir(),
    )
    return application


app = create_app()
