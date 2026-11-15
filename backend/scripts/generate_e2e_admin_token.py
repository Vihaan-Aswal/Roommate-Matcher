import json
import os
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

# Add backend to path
ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

# Ensure dummy secrets are loaded for e2e
os.environ["DATABASE_URL"] = f"sqlite:///{(ROOT_DIR / 'data' / 'app.db').as_posix()}"
os.environ.setdefault("APP_JWT_SECRET", "e2e-app-jwt-secret-e2e-app-jwt-secret")
os.environ.setdefault("SUPABASE_JWT_SECRET", "e2e-supabase-secret-e2e-supabase-secret")
os.environ.setdefault("SUPABASE_JWT_ISSUER", "https://e2e.supabase.co/auth/v1")
os.environ.setdefault("SUPABASE_JWT_AUDIENCE", "authenticated")
os.environ.setdefault("ADMIN_EMAILS", "e2e-admin@example.com")

import jwt
from app.config import get_settings
from app.database import SessionLocal
from app.models.tenant import Tenant
from app.models.tenant_membership import TenantMembership
from app.models.workspace import Workspace


def _get_or_create_tenant(db, slug: str, display_name: str, *, is_demo: bool) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
    if tenant is None:
        tenant = Tenant(slug=slug, display_name=display_name, is_demo=is_demo)
        db.add(tenant)
        db.flush()
    return tenant


def main() -> None:
    settings = get_settings()
    db = SessionLocal()

    admin_email = (settings.admin_emails.split(",")[0].strip() or "admin@example.com")

    try:
        home_tenant = _get_or_create_tenant(db, "admin-home", "Admin Home", is_demo=False)

        membership = (
            db.query(TenantMembership)
            .filter(
                TenantMembership.tenant_id == home_tenant.id,
                TenantMembership.email == admin_email,
            )
            .first()
        )
        if membership is None:
            membership = TenantMembership(
                tenant_id=home_tenant.id,
                supabase_user_id=uuid.uuid4(),
                email=admin_email,
                role="owner",
            )
            db.add(membership)
            db.flush()
        admin_id = membership.supabase_user_id

        target_tenant = _get_or_create_tenant(db, "target-tenant", "Target Tenant", is_demo=False)

        target_workspace = (
            db.query(Workspace)
            .filter(Workspace.tenant_id == target_tenant.id, Workspace.name == "Target Workspace")
            .first()
        )
        if target_workspace is None:
            target_workspace = Workspace(tenant_id=target_tenant.id, name="Target Workspace")
            db.add(target_workspace)
            db.flush()

        _get_or_create_tenant(db, "demo-tenant", "Demo Tenant", is_demo=True)

        db.commit()
        target_tenant_id = str(target_tenant.id)
        target_workspace_id = str(target_workspace.id)
        home_tenant_id = str(home_tenant.id)
    except Exception as exc:  # pragma: no cover - CLI failure path
        db.rollback()
        print(f"Error seeding data: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()

    payload = {
        "sub": str(admin_id),
        "email": admin_email,
        "aud": settings.supabase_jwt_audience,
        "iss": settings.supabase_jwt_issuer,
        "role": "authenticated",
        "exp": datetime.now(UTC) + timedelta(hours=1),
    }
    token = jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")

    print(
        json.dumps(
            {
                "token": token,
                "target_tenant_id": target_tenant_id,
                "target_workspace_id": target_workspace_id,
                "home_tenant_id": home_tenant_id,
            }
        )
    )


if __name__ == "__main__":
    main()
