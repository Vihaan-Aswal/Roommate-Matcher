from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.main import app


def test_health_endpoint_returns_ok() -> None:
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "environment" in payload


def test_health_returns_503_when_database_is_unavailable(
    client: TestClient, db_session, monkeypatch
) -> None:
    def _fail(*args, **kwargs):
        raise SQLAlchemyError("database down")

    monkeypatch.setattr(db_session, "execute", _fail)

    response = client.get("/health")

    assert response.status_code == 503
    assert "database" in response.json()["detail"].lower()
