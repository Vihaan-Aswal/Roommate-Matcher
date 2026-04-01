from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app


def _build_showcase_dist(base_dir: Path) -> Path:
    dist_dir = base_dir / "dist"
    assets_dir = dist_dir / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    (dist_dir / "index.html").write_text(
        "<html><body>showcase-index</body></html>",
        encoding="utf-8",
    )
    (assets_dir / "app.js").write_text("console.log('showcase');", encoding="utf-8")
    return dist_dir


def test_showcase_fallback_serves_index_for_frontend_routes(tmp_path: Path) -> None:
    app = create_app(frontend_dist_dir=_build_showcase_dist(tmp_path))
    client = TestClient(app)

    response = client.get("/admin/dashboard")

    assert response.status_code == 200
    assert "showcase-index" in response.text


def test_showcase_static_assets_are_served_from_dist(tmp_path: Path) -> None:
    app = create_app(frontend_dist_dir=_build_showcase_dist(tmp_path))
    client = TestClient(app)

    response = client.get("/assets/app.js")

    assert response.status_code == 200
    assert "showcase" in response.text


def test_showcase_exclusions_preserve_backend_routes(tmp_path: Path) -> None:
    app = create_app(frontend_dist_dir=_build_showcase_dist(tmp_path))
    client = TestClient(app)

    health_response = client.get("/health")
    openapi_response = client.get("/openapi.json")
    docs_response = client.get("/docs")
    redoc_response = client.get("/redoc")
    api_not_found_response = client.get("/api/not-a-real-route")

    assert health_response.status_code == 200
    assert health_response.json()["status"] == "ok"

    assert openapi_response.status_code == 200
    assert openapi_response.json()["openapi"].startswith("3.")

    assert docs_response.status_code == 200
    assert "Swagger UI" in docs_response.text
    assert "showcase-index" not in docs_response.text

    assert redoc_response.status_code == 200
    assert "ReDoc" in redoc_response.text
    assert "showcase-index" not in redoc_response.text

    assert api_not_found_response.status_code == 404
    assert "application/json" in api_not_found_response.headers["content-type"]
    assert "showcase-index" not in api_not_found_response.text


def test_showcase_fallback_is_disabled_without_frontend_dist(tmp_path: Path) -> None:
    app = create_app(frontend_dist_dir=tmp_path / "missing-dist")
    client = TestClient(app)

    response = client.get("/admin/dashboard")

    assert response.status_code == 404
    assert "application/json" in response.headers["content-type"]
