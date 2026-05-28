import sys
import os
from pathlib import Path

# Add backend to path
ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

# Ensure dummy secrets are loaded for e2e
os.environ["DATABASE_URL"] = f"sqlite:///{(ROOT_DIR / 'data' / 'app.db').as_posix()}"

from app.config import get_settings
from app.database import SessionLocal
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.models.tenant_membership import TenantMembership
import uuid
import jwt
from datetime import datetime, UTC, timedelta

def main():
    settings = get_settings()
    db = SessionLocal()
    
    # 1. Create a platform admin user
    admin_id = uuid.uuid4()
    admin_email = "vihaanaswal48@gmail.com"
    
    # 2. Create a "real" tenant to impersonate
    target_tenant_id = uuid.uuid4()
    target_workspace_id = uuid.uuid4()
    
    # 3. Create the admin's home tenant (needed to pass the TenantMembership check)
    home_tenant_id = uuid.uuid4()
    
    try:
        # Create Home Tenant for Admin
        home_tenant = Tenant(id=home_tenant_id, slug="admin-home", display_name="Admin Home", is_demo=False)
        db.add(home_tenant)
        db.flush()
        
        # Add admin membership
        membership = TenantMembership(
            tenant_id=home_tenant_id,
            supabase_user_id=admin_id,
            email=admin_email,
            role="owner"
        )
        db.add(membership)
        
        # Create Target Tenant for Impersonation
        target_tenant = Tenant(id=target_tenant_id, slug="target-tenant", display_name="Target Tenant", is_demo=False)
        db.add(target_tenant)
        db.flush()
        
        # Create Target Workspace
        target_workspace = Workspace(id=target_workspace_id, tenant_id=target_tenant_id, name="Target Workspace")
        db.add(target_workspace)
        
        # Create Demo Tenant
        demo_tenant_id = uuid.uuid4()
        demo_tenant = Tenant(id=demo_tenant_id, slug="demo-tenant", display_name="Demo Tenant", is_demo=True)
        db.add(demo_tenant)
        
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error seeding data: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()
    
    # Generate the Supabase JWT for the admin
    payload = {
        "sub": str(admin_id),
        "email": admin_email,
        "aud": settings.supabase_jwt_audience,
        "iss": settings.supabase_jwt_issuer,
        "role": "authenticated",
        "exp": datetime.now(UTC) + timedelta(hours=1)
    }
    
    token = jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")
    
    # Output the token and the target tenant/workspace for the test to use
    import json
    print(json.dumps({
        "token": token,
        "target_tenant_id": str(target_tenant_id),
        "target_workspace_id": str(target_workspace_id),
        "home_tenant_id": str(home_tenant_id)
    }))

if __name__ == "__main__":
    main()
