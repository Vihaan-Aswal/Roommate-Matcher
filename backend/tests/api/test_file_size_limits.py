import pytest
from fastapi.testclient import TestClient

def test_file_size_limit_student_preview(client: TestClient, seed_tenant_and_user):
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    # 5MB + 1 byte
    large_content = b"a" * ((5 * 1024 * 1024) + 1)
    
    response = client.post(
        f"/api/workspaces/{workspace_id}/students/upload/preview",
        headers={**headers, "Content-Length": str(len(large_content))},
        files={"file": ("large.csv", b"dummy content", "text/csv")}
    )
    
    assert response.status_code == 413
    assert "File too large" in response.json()["detail"]

def test_file_size_limit_enforced_during_read(client: TestClient, seed_tenant_and_user):
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    # 5MB + 1 byte of actual file content to bypass Content-Length if absent or incorrect
    large_content = b"a" * ((5 * 1024 * 1024) + 1)
    
    response = client.post(
        f"/api/workspaces/{workspace_id}/students/upload/preview",
        headers=headers,
        files={"file": ("large.csv", large_content, "text/csv")}
    )
    
    assert response.status_code == 413
    assert "File too large" in response.json()["detail"]
