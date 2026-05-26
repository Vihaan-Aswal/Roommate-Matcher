from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Roommate Matcher API"
    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000

    # --- Database (Postgres only) ---
    database_url: str  # REQUIRED — no default, forces explicit config
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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
