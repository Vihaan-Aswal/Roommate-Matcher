"""Contract test: the public OpenAPI surface must never drift silently.

The snapshot in ``openapi_snapshot.json`` records, for every path + method:
  * ``request_required`` - required body fields of the JSON request schema
    (resolved through ``$ref`` into ``components.schemas``)
  * ``response_schema``  - name of the 2xx response schema when it is a named
    model (``None`` for free-form dict responses)

Regenerate the snapshot after an *intentional* API change:

    cd backend
    $env:DATABASE_URL='sqlite+pysqlite:///:memory:'
    uv run python tests/contract/test_openapi_contract.py --write

(bash: ``DATABASE_URL='sqlite+pysqlite:///:memory:' uv run python \
tests/contract/test_openapi_contract.py --write``)

The internal router is intentionally excluded from the schema
(``include_in_schema=False``), so it must not appear here.
"""
from __future__ import annotations

import json
from pathlib import Path

SNAPSHOT_PATH = Path(__file__).with_name("openapi_snapshot.json")
_HTTP_METHODS = ("get", "post", "put", "patch", "delete")


def _resolve_ref_name(schema: dict | None) -> str | None:
    if not schema:
        return None
    ref = schema.get("$ref")
    if not isinstance(ref, str):
        return None
    return ref.rsplit("/", 1)[-1]


def _request_required(spec: dict, operation: dict) -> list[str]:
    body = operation.get("requestBody") or {}
    schema = ((body.get("content") or {}).get("application/json") or {}).get("schema") or {}
    ref_name = _resolve_ref_name(schema)
    if ref_name is not None:
        schema = spec["components"]["schemas"][ref_name]
    required = schema.get("required") or []
    return sorted(str(field) for field in required)


def _response_schema(operation: dict) -> str | None:
    responses = operation.get("responses") or {}
    for status_code in sorted(responses):
        if not str(status_code).startswith("2"):
            continue
        content = (responses[status_code] or {}).get("content") or {}
        schema = (content.get("application/json") or {}).get("schema") or {}
        return _resolve_ref_name(schema)
    return None


def build_snapshot() -> dict:
    from app.main import app

    spec = app.openapi()
    paths: dict[str, dict[str, dict]] = {}
    for path, operations in sorted(spec["paths"].items()):
        path_entry: dict[str, dict] = {}
        for method, operation in sorted(operations.items()):
            if method not in _HTTP_METHODS:
                continue
            path_entry[method] = {
                "request_required": _request_required(spec, operation),
                "response_schema": _response_schema(operation),
            }
        paths[path] = path_entry
    return {"paths": paths}


def test_openapi_paths_methods_and_schemas_match_snapshot() -> None:
    expected = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    actual = build_snapshot()

    missing = sorted(set(expected["paths"]) - set(actual["paths"]))
    added = sorted(set(actual["paths"]) - set(expected["paths"]))
    assert missing == [], f"Snapshot lists routes that no longer exist: {missing}"
    assert added == [], (
        "New routes are not in the OpenAPI snapshot. If intentional, regenerate "
        f"it with the command in this module's docstring: {added}"
    )

    for path in sorted(expected["paths"]):
        expected_methods = expected["paths"][path]
        actual_methods = actual["paths"][path]
        assert sorted(expected_methods) == sorted(actual_methods), (
            f"HTTP methods changed for {path}: expected {sorted(expected_methods)}, "
            f"got {sorted(actual_methods)}"
        )
        for method in sorted(expected_methods):
            assert actual_methods[method] == expected_methods[method], (
                f"OpenAPI contract drift for {method.upper()} {path}: "
                f"expected {expected_methods[method]}, got {actual_methods[method]}"
            )


def test_snapshot_pins_the_auth_and_public_form_contracts() -> None:
    expected = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    paths = expected["paths"]

    assert paths["/api/auth/session"]["post"] == {
        "request_required": ["access_token"],
        "response_schema": "SessionResponse",
    }
    assert paths["/api/auth/me"]["get"]["response_schema"] == "MeResponse"
    assert paths["/api/public/forms/{public_form_token}/submit"]["post"] == {
        "request_required": ["answers", "submitted_admission_number", "submitted_phone_last4"],
        "response_schema": None,
    }
    assert "/api/internal/cleanup/demo-tenants" not in paths


if __name__ == "__main__":  # snapshot regeneration helper
    import sys

    if "--write" not in sys.argv:
        raise SystemExit(
            "Usage: DATABASE_URL='sqlite+pysqlite:///:memory:' "
            "uv run python tests/contract/test_openapi_contract.py --write"
        )
    payload = build_snapshot()
    SNAPSHOT_PATH.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(f"Wrote {SNAPSHOT_PATH} ({len(payload['paths'])} paths)")
