import logging

from fastapi.testclient import TestClient

from app.api.routes import fairness
from app.models.matching_run import MatchingRun

SECURITY_HEADERS = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
    "strict-transport-security": "max-age=31536000",
    "content-security-policy": "object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
}


def _assert_security_headers(response) -> None:
    for name, value in SECURITY_HEADERS.items():
        assert response.headers.get(name) == value
    assert response.headers.get("x-request-id")


def test_security_headers_on_health(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    _assert_security_headers(response)


def test_security_headers_on_not_found(client: TestClient) -> None:
    response = client.get("/api/does-not-exist")

    assert response.status_code == 404
    _assert_security_headers(response)


def test_generic_500_logs_request_id_without_leaking_internals(
    client: TestClient,
    db_session,
    seed_tenant_and_user,
    monkeypatch,
    caplog,
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]
    db_session.add(
        MatchingRun(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            run_id="run-err",
            scope="all_ready_segments",
            status="completed",
        )
    )
    db_session.commit()

    def boom(*args, **kwargs):
        raise ValueError("secret internals")

    monkeypatch.setattr(fairness, "get_run_fairness_snapshot", boom)

    with caplog.at_level(logging.ERROR):
        response = client.get(
            f"/api/workspaces/{workspace_id}/fairness/run-err", headers=headers
        )

    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error."}
    assert "secret internals" not in response.text
    request_id = response.headers["x-request-id"]
    assert request_id
    assert request_id in caplog.text
    assert "GET" in caplog.text
    assert f"/api/workspaces/{workspace_id}/fairness/run-err" in caplog.text


def test_cors_still_allows_the_frontend_origin(client: TestClient) -> None:
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})

    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
