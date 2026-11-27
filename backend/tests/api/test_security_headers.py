from fastapi.testclient import TestClient

SECURITY_HEADERS = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
    "strict-transport-security": "max-age=31536000",
}


def _assert_security_headers(response) -> None:
    for name, value in SECURITY_HEADERS.items():
        assert response.headers.get(name) == value


def test_security_headers_on_health(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    _assert_security_headers(response)


def test_security_headers_on_not_found(client: TestClient) -> None:
    response = client.get("/api/does-not-exist")

    assert response.status_code == 404
    _assert_security_headers(response)


def test_cors_still_allows_the_frontend_origin(client: TestClient) -> None:
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})

    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
