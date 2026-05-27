import asyncio
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.services.ingestion.student_csv import plan_student_import

def test_upload():
    db = SessionLocal()
    tenant = db.query(Tenant).first()
    workspace = db.query(Workspace).filter_by(tenant_id=tenant.id).first()
    
    with open('../frontend/e2e/fixtures/students_v1.csv', 'rb') as f:
        csv_bytes = f.read()
        
    try:
        diff = plan_student_import(db, workspace.id, tenant.id, csv_bytes)
        print("Success!")
        print("To Insert:", len(diff.to_insert))
        print("Validation Errors:", diff.validation_errors)
    except Exception as e:
        print("Exception:", e)

if __name__ == "__main__":
    test_upload()
