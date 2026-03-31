from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.form import router as form_router
from app.api.routes.segments import router as segments_router
from app.api.routes.upload import router as upload_router
from app.config import get_settings

settings = get_settings()
app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(upload_router, prefix="/api")
app.include_router(form_router, prefix="/api")
app.include_router(segments_router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.app_env}
