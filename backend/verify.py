import os
import sys
from sqlalchemy import create_engine, inspect, text
from app.database import engine

def main():
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    print("TABLES FOUND:", tables)
    
    # 13 business tables + 1 alembic
    expected = {
        "alembic_version", "tenants", "tenant_memberships", "workspaces", 
        "workspace_form_links", "platform_audit_events", "segments", 
        "students", "rooms", "form_responses", "preference_profiles", 
        "matching_runs", "pair_scores", "room_assignments"
    }
    
    missing = expected - tables
    if missing:
        print(f"FAIL: Missing tables: {missing}")
        sys.exit(1)
        
    extra = tables - expected
    if extra:
        print(f"WARNING: Additional tables found: {extra}")

    # Check for ux_preference_profiles_one_active and WHERE clause
    with engine.connect() as conn:
        result = conn.execute(text("SELECT indexdef FROM pg_indexes WHERE indexname = 'ux_preference_profiles_one_active';")).fetchone()
        if not result:
            print("FAIL: Index 'ux_preference_profiles_one_active' not found.")
            sys.exit(1)
            
        indexdef = result[0]
        print(f"INDEX DEF: {indexdef}")
        if "WHERE" not in indexdef.upper():
            print("FAIL: Index 'ux_preference_profiles_one_active' does not have a WHERE clause.")
            sys.exit(1)
            
    print("SUCCESS: All DB schema checks passed.")

if __name__ == "__main__":
    main()