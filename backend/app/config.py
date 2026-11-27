from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PLACEHOLDER_APP_JWT_SECRETS = frozenset(
    {"change-me", "changeme", "replace-me", "your-secret-key", "secret"}
)

MAX_CSV_UPLOAD_BYTES: int = 5 * 1024 * 1024
MAX_CSV_ROWS: int = 10_000
MAX_CSV_CELL_CHARS: int = 1_000


class Settings(BaseSettings):
    app_name: str = "Roommate Matcher API"
    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000

    # --- Database (Postgres only) ---
    database_url: str  # REQUIRED - no default, forces explicit config
    alembic_database_url: str = ""  # optional override for Alembic direct connection

    # --- CORS ---
    cors_allowed_origins: list[str] = ["http://localhost:5173"]

    # --- Supabase Auth ---
    supabase_project_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_issuer: str = ""
    supabase_jwt_audience: str = "authenticated"
    supabase_jwt_secret: str = ""

    # --- App-level auth ---
    app_jwt_secret: str = ""
    admin_emails: str = ""  # comma-separated

    # --- Frontend ---
    frontend_url: str = "http://localhost:5173"

    # --- DFY / Demo ---
    whatsapp_dfy_number: str = ""
    demo_ttl_hours: int = 24
    demo_global_cap_per_hour: int = 60
    form_link_ttl_days: int = 30
    demo_rate_limit: str = "10/minute"

    # --- Rate limiting ---
    rate_limit_storage_uri: str = "memory://"

    # --- Cleanup Job ---
    cleanup_job_secret: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def _require_production_config(self) -> "Settings":
        if self.app_env != "production" and not self.database_url.startswith(
            ("postgresql", "postgres")
        ):
            return self

        problems: list[str] = []
        app_secret = self.app_jwt_secret.strip()
        if len(app_secret) < 32:
            problems.append("APP_JWT_SECRET must be at least 32 characters.")
        if app_secret.lower() in PLACEHOLDER_APP_JWT_SECRETS:
            problems.append("APP_JWT_SECRET must not be a placeholder value.")
        if not self.supabase_jwt_secret.strip():
            problems.append("SUPABASE_JWT_SECRET is required in production.")
        if not (self.cleanup_job_secret or "").strip():
            problems.append("CLEANUP_JOB_SECRET is required in production.")
        # Production CORS is enforced at the deploy config (S-CSP pending).

        if problems:
            raise ValueError(" ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
