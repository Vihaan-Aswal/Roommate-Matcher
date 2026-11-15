"""Security matrix.

Covers: JWT rejection (expiry, issuer, audience, signature, alg=none/confusion),
tenant IDOR on run/workspace/segment ids, mass assignment, PII in results,
exports and captured logs, CORS allow/deny, and demo-token TTL.

Every check goes through the real app via TestClient against the in-memory
SQLite DB. Tokens are minted with the same secrets the app verifies with
(`app.auth.tokens` / PyJWT); nothing is stubbed and no uvicorn is started.
"""
from __future__ import annotations

import base64
import csv
import hashlib
import hmac
import io
import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
import pytest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.auth.tokens import issue_demo_token
from app.config import get_settings
from app.main import app
from app.models.matching_run import MatchingRun
from app.models.pair_score import PairScore
from app.models.preference_profile import PreferenceProfile
from app.models.room import Room
from app.models.room_assignment import RoomAssignment
from app.models.segment import Segment
from app.models.student import Student
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.services.ingestion.form_response import QUESTION_OPTION_VALUES

SEGMENT_KEY = "M_1st_year_AC_2"

SECRET_ADMISSIONS = ("B-SECRET-001", "B-SECRET-002")
SECRET_STUDENT_NAMES = ("B Secret One", "B Secret Two")
SECRET_RUN_ID = "run_b_secret_0001"
SECRET_SEGMENT_KEY = "B_SECRET_SEGMENT"


# ---------------------------------------------------------------------------
# Token helpers — minted with the live settings, never with hard-coded secrets
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(UTC)


def _app_payload(*, expires_in_hours: float = 1, **overrides: Any) -> dict[str, Any]:
    now = _now()
    payload: dict[str, Any] = {
        "sub": f"demo:{uuid.uuid4()}",
        "email": "security@test.local",
        "tenant_id": str(uuid.uuid4()),
        "workspace_id": str(uuid.uuid4()),
        "role": "owner",
        "is_demo": True,
        "iat": now,
        "exp": now + timedelta(hours=expires_in_hours),
    }
    payload.update(overrides)
    return payload


def _supabase_payload(*, issuer: str | None = None, audience: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    now = _now()
    return {
        "sub": str(uuid.uuid4()),
        "email": "security@test.local",
        "role": "authenticated",
        "iss": issuer if issuer is not None else settings.supabase_jwt_issuer,
        "aud": audience if audience is not None else settings.supabase_jwt_audience,
        "iat": now,
        "exp": now + timedelta(hours=1),
    }


def _supabase_secret() -> str:
    return get_settings().supabase_jwt_secret or "unset-supabase-secret"


def _unsigned_none_token(payload: dict[str, Any]) -> str:
    def encode(segment: dict[str, Any]) -> str:
        raw = json.dumps(segment, separators=(",", ":"), default=str).encode("utf-8")
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")

    return f"{encode({'alg': 'none', 'typ': 'JWT'})}.{encode(payload)}."


def _hs256_token_with_forged_header(header: dict[str, Any], payload: dict[str, Any], key: str) -> str:
    """Build a token whose header claims an algorithm the signature was not made with."""

    def encode(raw: bytes) -> str:
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")

    signing_input = (
        f"{encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))}."
        f"{encode(json.dumps(payload, separators=(',', ':'), default=str).encode('utf-8'))}"
    )
    signature = hmac.new(key.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
    return f"{signing_input}.{encode(signature)}"


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _assert_rejected(client: TestClient, token: str, *, label: str) -> None:
    """A bad token must be refused with 401 by every protected surface."""
    headers = _bearer(token)
    for path in ("/api/auth/me", "/api/workspaces"):
        response = client.get(path, headers=headers)
        assert response.status_code == 401, f"{label}: {path} -> {response.status_code} {response.text}"
        assert token not in response.text, f"{label}: {path} echoed the token back"


# ---------------------------------------------------------------------------
# Seeding helpers (fixtures may seed; assertions stay route-level)
# ---------------------------------------------------------------------------

def _seed_ready_segment(
    db_session: Session,
    tenant_id: uuid.UUID,
    *,
    admissions: tuple[str, ...] = ("SEC-001", "SEC-002", "SEC-003", "SEC-004"),
    phone_number: str = "9876500011",
) -> tuple[Workspace, Segment]:
    ws = Workspace(tenant_id=tenant_id, name="Security WS", status="draft", source="manual")
    db_session.add(ws)
    db_session.flush()

    segment = Segment(
        tenant_id=tenant_id,
        workspace_id=ws.id,
        segment_key=SEGMENT_KEY,
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()

    for index, admission in enumerate(admissions):
        student = Student(
            tenant_id=tenant_id,
            workspace_id=ws.id,
            segment_id=segment.id,
            admission_number=admission,
            full_name=f"Security Student {index}",
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
            dob=datetime(2005, 1, 1).date(),
            phone_number=phone_number,
            phone_last4=phone_number[-4:],
            is_active=True,
        )
        db_session.add(student)
        db_session.flush()
        db_session.add(
            PreferenceProfile(
                tenant_id=tenant_id,
                workspace_id=ws.id,
                student_id=student.id,
                has_preferences=True,
                is_active=True,
                is_generated=False,
                q1_enc=1.0,
                q2_enc=1.0,
                q3_enc=1.0,
                q4a_enc=0.0,
                q4b_enc=3.0,
                q5a_enc=0.0,
                q5b_enc=3.0,
                q6_enc=1.0,
                q7_enc=1.0,
                q8_enc=1.0,
                q9_enc=1.0,
                q10_enc=0.0,
            )
        )

    for room_index in range(len(admissions) // 2):
        db_session.add(
            Room(
                tenant_id=tenant_id,
                workspace_id=ws.id,
                segment_id=segment.id,
                room_id=f"SEC-R{room_index + 1}",
                capacity=2,
                source="uploaded",
                is_active=True,
            )
        )

    db_session.commit()
    return ws, segment


def _seed_other_tenant(db_session: Session) -> dict[str, Any]:
    """Tenant B holds run/segment/student artefacts that tenant A must never read."""
    tenant = Tenant(slug=f"tenant-b-{uuid.uuid4().hex[:8]}", display_name="Tenant B Secret")
    db_session.add(tenant)
    db_session.flush()

    workspace = Workspace(tenant_id=tenant.id, name="Tenant B Secret Workspace", status="active", source="manual")
    db_session.add(workspace)
    db_session.flush()

    segment = Segment(
        tenant_id=tenant.id,
        workspace_id=workspace.id,
        segment_key=SECRET_SEGMENT_KEY,
        gender="F",
        year_group="2nd_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()

    students = []
    for index, (admission, name) in enumerate(zip(SECRET_ADMISSIONS, SECRET_STUDENT_NAMES, strict=True)):
        student = Student(
            tenant_id=tenant.id,
            workspace_id=workspace.id,
            segment_id=segment.id,
            admission_number=admission,
            full_name=name,
            gender="F",
            year_group="2nd_year",
            ac_type="AC",
            room_size=2,
            dob=datetime(2005, 2, 1 + index).date(),
            phone_number="9123400011",
            phone_last4="0011",
            is_active=True,
        )
        db_session.add(student)
        students.append(student)
    db_session.flush()

    run = MatchingRun(
        tenant_id=tenant.id,
        workspace_id=workspace.id,
        run_id=SECRET_RUN_ID,
        scope="segment",
        target_segment_id=segment.id,
        status="completed",
        fairness_summary_json=json.dumps(
            {
                "total_students": 2,
                "run_label_counts": {"Excellent": 0, "Good": 2, "Okay": 0, "Poor": 0},
                "run_label_percentages": {"Excellent": 0.0, "Good": 1.0, "Okay": 0.0, "Poor": 0.0},
                "run_at_risk_count": 0,
                "run_at_risk_student_ids": [],
                "by_segment": [],
            }
        ),
    )
    db_session.add(run)
    db_session.flush()

    db_session.add(
        RoomAssignment(
            tenant_id=tenant.id,
            workspace_id=workspace.id,
            matching_run_id=run.id,
            segment_id=segment.id,
            room_id="B-SECRET-ROOM",
            room_label="B-SECRET-ROOM",
            assigned_students_json=json.dumps(list(SECRET_ADMISSIONS)),
            group_score=0.91,
            satisfaction_summary_json=json.dumps(
                {
                    "students": [
                        {
                            "student_id": admission,
                            "room_id": "B-SECRET-ROOM",
                            "roommate_ids": [other],
                            "satisfaction_score": 0.91,
                            "satisfaction_label": "Excellent",
                            "excellent_safety_passed": True,
                            "is_at_risk": False,
                            "reasons": ["B secret reason"],
                            "factor_trace": [],
                        }
                        for admission, other in zip(
                            SECRET_ADMISSIONS, reversed(SECRET_ADMISSIONS), strict=True
                        )
                    ]
                }
            ),
            needs_review=0,
        )
    )
    db_session.add(
        PairScore(
            tenant_id=tenant.id,
            workspace_id=workspace.id,
            matching_run_id=run.id,
            segment_id=segment.id,
            student_a_id=students[0].id,
            student_b_id=students[1].id,
            pair_score=0.91,
            factor_breakdown_json=json.dumps({}),
        )
    )
    db_session.commit()

    return {
        "tenant_id": tenant.id,
        "workspace_id": workspace.id,
        "segment_key": SECRET_SEGMENT_KEY,
        "run_id": SECRET_RUN_ID,
    }


def _cors_allow_origins() -> list[str]:
    middleware = next(m for m in app.user_middleware if m.cls is CORSMiddleware)
    options = getattr(middleware, "kwargs", None) or middleware.options
    return list(options["allow_origins"])


# ---------------------------------------------------------------------------
# JWT matrix
# ---------------------------------------------------------------------------

def test_expired_token_is_rejected(client: TestClient, seed_tenant_and_user: dict[str, Any]) -> None:
    token = issue_demo_token(
        tenant_id=seed_tenant_and_user["tenant_id"],
        workspace_id=seed_tenant_and_user["workspace_id"],
        email="expired@test.local",
        ttl_hours=-1,
    )
    _assert_rejected(client, token, label="expired token")


def test_token_signed_with_wrong_secret_is_rejected(
    client: TestClient, seed_tenant_and_user: dict[str, Any]
) -> None:
    token = jwt.encode(_app_payload(), "definitely-not-the-app-secret-32b", algorithm="HS256")
    _assert_rejected(client, token, label="wrong signature")


def test_supabase_token_with_wrong_issuer_is_rejected(client: TestClient) -> None:
    token = jwt.encode(
        _supabase_payload(issuer="https://wrong-issuer.example/auth/v1"),
        _supabase_secret(),
        algorithm="HS256",
    )
    _assert_rejected(client, token, label="wrong issuer")


def test_supabase_token_with_wrong_audience_is_rejected(client: TestClient) -> None:
    token = jwt.encode(
        _supabase_payload(audience="some-other-audience"),
        _supabase_secret(),
        algorithm="HS256",
    )
    _assert_rejected(client, token, label="wrong audience")


def test_alg_none_token_is_rejected(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Local/dev environments have no SUPABASE_PROJECT_URL, so the asymmetric
    # branch refuses before it can fetch a JWKS over the network. Pin that
    # configuration so this test stays hermetic (no outbound call).
    monkeypatch.setattr(get_settings(), "supabase_project_url", "")

    token = _unsigned_none_token(_app_payload())
    _assert_rejected(client, token, label="alg=none")


def test_alg_confusion_token_is_rejected(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Header claims RS256 while the bytes are HMAC-signed: neither verifier may
    # accept it, and the asymmetric branch must not reach the network here.
    monkeypatch.setattr(get_settings(), "supabase_project_url", "")

    token = _hs256_token_with_forged_header(
        {"alg": "RS256", "typ": "JWT"},
        _supabase_payload(),
        _supabase_secret(),
    )
    _assert_rejected(client, token, label="alg confusion")


# ---------------------------------------------------------------------------
# IDOR
# ---------------------------------------------------------------------------

def test_other_tenants_workspace_and_run_are_unreachable(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]
    own_workspace_id = seed_tenant_and_user["workspace_id"]
    other = _seed_other_tenant(db_session)

    # Tenant B's workspace id used with tenant A's token.
    other_workspace = client.get(f"/api/workspaces/{other['workspace_id']}", headers=headers)
    assert other_workspace.status_code in (403, 404), other_workspace.text
    assert "Tenant B Secret" not in other_workspace.text

    # Tenant B's run id requested inside tenant A's workspace.
    for path, params in (
        ("rooms", {"segment_key": SECRET_SEGMENT_KEY}),
        ("students", {"segment_key": SECRET_SEGMENT_KEY}),
        ("students/all-segments", None),
    ):
        response = client.get(
            f"/api/workspaces/{own_workspace_id}/matching/runs/{other['run_id']}/{path}",
            params=params,
            headers=headers,
        )
        assert response.status_code in (403, 404), f"{path}: {response.text}"
        for secret in (*SECRET_ADMISSIONS, "B Secret", "B-SECRET-ROOM"):
            assert secret not in response.text

    fairness = client.get(f"/api/workspaces/{own_workspace_id}/fairness/{other['run_id']}", headers=headers)
    assert fairness.status_code in (403, 404), fairness.text
    assert "B-SECRET" not in fairness.text

    export = client.get(
        f"/api/workspaces/{own_workspace_id}/exports/assignments/{other['run_id']}", headers=headers
    )
    assert export.status_code in (403, 404), export.text
    assert "B-SECRET" not in export.text

    # A token minted for tenant B cannot reach tenant A either.
    foreign_token = issue_demo_token(
        tenant_id=other["tenant_id"],
        workspace_id=other["workspace_id"],
        email="intruder@test.local",
    )
    reverse = client.get(f"/api/workspaces/{own_workspace_id}", headers=_bearer(foreign_token))
    assert reverse.status_code in (403, 404), reverse.text
    assert "Test Workspace" not in reverse.text


def test_other_tenants_segment_is_unreachable(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]
    own_workspace_id = seed_tenant_and_user["workspace_id"]
    _seed_other_tenant(db_session)

    segment_students = client.get(
        f"/api/workspaces/{own_workspace_id}/segments/{SECRET_SEGMENT_KEY}/students",
        headers=headers,
    )
    assert segment_students.status_code in (403, 404), segment_students.text
    for secret in SECRET_ADMISSIONS:
        assert secret not in segment_students.text

    segments = client.get(f"/api/workspaces/{own_workspace_id}/segments", headers=headers)
    assert segments.status_code == 200, segments.text
    assert SECRET_SEGMENT_KEY not in [row["segment_key"] for row in segments.json()["segments"]]

    magic_fill = client.post(
        f"/api/workspaces/{own_workspace_id}/magic-fill",
        json={"segment_key": SECRET_SEGMENT_KEY},
        headers=headers,
    )
    assert magic_fill.status_code in (403, 404), magic_fill.text
    for secret in SECRET_ADMISSIONS:
        assert secret not in magic_fill.text

    run = client.post(
        f"/api/workspaces/{own_workspace_id}/matching/runs",
        json={"scope": "segment", "segment_key": SECRET_SEGMENT_KEY},
        headers=headers,
    )
    assert run.status_code == 400, run.text
    assert run.json()["detail"] == "Segment not found"


# ---------------------------------------------------------------------------
# Mass assignment
# ---------------------------------------------------------------------------

def test_workspace_create_ignores_unknown_and_server_owned_fields(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]
    forged_workspace_id = uuid.uuid4()
    other_tenant_id = uuid.uuid4()

    response = client.post(
        "/api/workspaces",
        json={
            "name": "Mass Assignment Workspace",
            "wrong_field": "must be ignored",
            "id": str(forged_workspace_id),
            "tenant_id": str(other_tenant_id),
            "status": "active",
            "source": "demo_seed",
            "is_demo_seeded": True,
            "created_by_supabase_user_id": str(uuid.uuid4()),
        },
        headers=headers,
    )
    assert response.status_code in (201, 422), response.text

    if response.status_code == 201:
        body = response.json()
        assert body["id"] != str(forged_workspace_id)
        assert body["tenant_id"] == str(seed_tenant_and_user["tenant_id"])
        assert body["status"] == "draft"
        assert body["source"] == "manual"

        stored = db_session.get(Workspace, uuid.UUID(body["id"]))
        assert stored is not None
        assert stored.tenant_id == seed_tenant_and_user["tenant_id"]
        assert stored.status == "draft"
        assert stored.source == "manual"
        assert stored.created_by_supabase_user_id is None
        assert db_session.get(Workspace, forged_workspace_id) is None

        # Read the defaulted flag straight from the row: SQLite renders
        # server_default="false" as the text 'false', so it must be normalised.
        raw_flag = db_session.execute(
            text("SELECT is_demo_seeded FROM workspaces WHERE name = :name"),
            {"name": "Mass Assignment Workspace"},
        ).scalar_one()
        assert str(raw_flag).lower() in {"false", "0"}, raw_flag


def test_matching_run_ignores_unknown_and_server_owned_fields(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace, _segment = _seed_ready_segment(db_session, tenant_id)

    response = client.post(
        f"/api/workspaces/{workspace.id}/matching/runs",
        json={
            "scope": "segment",
            "segment_key": SEGMENT_KEY,
            "run_id": "run_forged_by_client",
            "status": "failed",
            "workspace_id": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "segments_matched": 999,
        },
        headers=headers,
    )
    assert response.status_code in (200, 422), response.text

    if response.status_code == 200:
        body = response.json()
        assert body["run_id"] != "run_forged_by_client"
        assert body["status"] == "completed"
        assert body["segments_matched"] == 1

        assert db_session.scalars(
            select(MatchingRun).where(MatchingRun.run_id == "run_forged_by_client")
        ).all() == []

        stored = db_session.scalars(
            select(MatchingRun).where(MatchingRun.run_id == body["run_id"])
        ).one()
        assert stored.workspace_id == workspace.id
        assert stored.tenant_id == tenant_id
        assert stored.status == "completed"


# ---------------------------------------------------------------------------
# PII in responses, exports and logs
# ---------------------------------------------------------------------------

def _walk_strings(value: Any, *, path: str = "") -> list[tuple[str, str]]:
    if isinstance(value, dict):
        found: list[tuple[str, str]] = []
        for key, child in value.items():
            found.append((f"{path}.{key}", str(key)))
            found.extend(_walk_strings(child, path=f"{path}.{key}"))
        return found
    if isinstance(value, list):
        found = []
        for index, child in enumerate(value):
            found.extend(_walk_strings(child, path=f"{path}[{index}]"))
        return found
    if isinstance(value, str):
        return [(path, value)]
    return []


def test_results_exports_and_fairness_carry_no_raw_answers_or_phone_numbers(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]
    phone_number = "9876500011"
    workspace, _segment = _seed_ready_segment(
        db_session, seed_tenant_and_user["tenant_id"], phone_number=phone_number
    )

    run = client.post(
        f"/api/workspaces/{workspace.id}/matching/runs",
        json={"scope": "segment", "segment_key": SEGMENT_KEY},
        headers=headers,
    )
    assert run.status_code == 200, run.text
    run_id = run.json()["run_id"]

    payloads: dict[str, Any] = {
        "rooms": client.get(
            f"/api/workspaces/{workspace.id}/matching/runs/{run_id}/rooms",
            params={"segment_key": SEGMENT_KEY},
            headers=headers,
        ).json(),
        "students": client.get(
            f"/api/workspaces/{workspace.id}/matching/runs/{run_id}/students",
            params={"segment_key": SEGMENT_KEY},
            headers=headers,
        ).json(),
        "fairness": client.get(
            f"/api/workspaces/{workspace.id}/fairness/{run_id}", headers=headers
        ).json(),
        "checker": client.post(
            f"/api/workspaces/{workspace.id}/checker/compatibility",
            json={"segment_key": SEGMENT_KEY, "room_size": 2, "student_ids": ["SEC-001", "SEC-002"]},
            headers=headers,
        ).json(),
    }

    raw_answer_values = [option for options in QUESTION_OPTION_VALUES.values() for option in options]
    forbidden_key_fragments = ("phone", "raw", "submitted_")

    inspected = _walk_strings(payloads)
    # Guard against a vacuous pass: the walker must actually see the payload.
    assert len(inspected) > 20
    for path, text in inspected:
        assert phone_number not in text, f"{path} leaked the phone number"
        assert phone_number[-4:] not in text, f"{path} leaked the last four digits"
        for raw_answer in raw_answer_values:
            assert raw_answer not in text, f"{path} leaked a raw form answer"
        for fragment in forbidden_key_fragments:
            assert fragment not in path.lower(), f"{path} exposes a {fragment} field"

    export = client.get(
        f"/api/workspaces/{workspace.id}/exports/assignments/{run_id}", headers=headers
    )
    assert export.status_code == 200, export.text
    export_text = export.text
    assert phone_number not in export_text
    assert phone_number[-4:] not in export_text
    for raw_answer in raw_answer_values:
        assert raw_answer not in export_text
    export_rows = list(csv.reader(io.StringIO(export_text)))
    assert export_rows[0] == [
        "room_id",
        "segment_key",
        "student_1",
        "student_2",
        "student_3",
        "student_4",
        "group_score",
    ]


def test_captured_logs_never_contain_tokens_or_secrets(
    client: TestClient, caplog: pytest.LogCaptureFixture, seed_tenant_and_user: dict[str, Any]
) -> None:
    settings = get_settings()
    token = seed_tenant_and_user["token"]
    workspace_id = seed_tenant_and_user["workspace_id"]

    with caplog.at_level(logging.DEBUG):
        client.get("/api/auth/me", headers=_bearer(token))
        client.get("/api/workspaces", headers=_bearer(token))
        client.get(f"/api/workspaces/{workspace_id}/segments", headers=_bearer(token))
        client.get("/api/auth/me", headers=_bearer("not-a-valid-token"))

    secrets_to_protect = [
        value
        for value in (token, settings.app_jwt_secret, settings.supabase_jwt_secret)
        if value
    ]
    assert secrets_to_protect

    # Prove the capture is real: without records the leak check would be vacuous.
    assert caplog.records, "no log records captured; the leak check would be vacuous"
    for record in caplog.records:
        message = record.getMessage()
        for secret in secrets_to_protect:
            assert secret not in message, f"log record leaked a secret: {message}"
        assert "Authorization: Bearer" not in message
        assert record.exc_text is None or all(secret not in record.exc_text for secret in secrets_to_protect)


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

def test_allowed_origin_is_echoed(client: TestClient) -> None:
    allowed_origin = _cors_allow_origins()[0]

    simple = client.get("/health", headers={"Origin": allowed_origin})
    assert simple.status_code == 200
    assert simple.headers["access-control-allow-origin"] == allowed_origin

    preflight = client.options(
        "/api/workspaces",
        headers={
            "Origin": allowed_origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert preflight.status_code in (200, 204), preflight.text
    assert preflight.headers["access-control-allow-origin"] == allowed_origin


def test_disallowed_origin_is_not_allowed(client: TestClient) -> None:
    disallowed_origin = "https://evil.example"
    assert disallowed_origin not in _cors_allow_origins()

    simple = client.get("/health", headers={"Origin": disallowed_origin})
    assert simple.status_code == 200
    assert "access-control-allow-origin" not in simple.headers

    preflight = client.options(
        "/api/workspaces",
        headers={
            "Origin": disallowed_origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert preflight.status_code == 400, preflight.text
    assert "access-control-allow-origin" not in preflight.headers


# ---------------------------------------------------------------------------
# Demo token TTL
# ---------------------------------------------------------------------------

def test_demo_token_expiry_honours_requested_ttl(
    client: TestClient, seed_tenant_and_user: dict[str, Any]
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]

    live = issue_demo_token(
        tenant_id=tenant_id, workspace_id=workspace_id, email="ttl@test.local", ttl_hours=2
    )
    claims = jwt.decode(live, options={"verify_signature": False})
    assert claims["exp"] - claims["iat"] == 2 * 3600
    assert client.get("/api/auth/me", headers=_bearer(live)).status_code == 200

    expired = issue_demo_token(
        tenant_id=tenant_id, workspace_id=workspace_id, email="ttl@test.local", ttl_hours=-1
    )
    expired_claims = jwt.decode(expired, options={"verify_signature": False})
    assert expired_claims["exp"] < expired_claims["iat"]
    assert client.get("/api/auth/me", headers=_bearer(expired)).status_code == 401


def test_demo_token_default_ttl_comes_from_settings(seed_tenant_and_user: dict[str, Any]) -> None:
    token = issue_demo_token(
        tenant_id=seed_tenant_and_user["tenant_id"],
        workspace_id=seed_tenant_and_user["workspace_id"],
        email="ttl-default@test.local",
    )
    claims = jwt.decode(token, options={"verify_signature": False})
    assert claims["exp"] - claims["iat"] == get_settings().demo_ttl_hours * 3600


def test_demo_endpoint_issues_a_token_with_the_configured_ttl(client: TestClient) -> None:
    ttl_hours = get_settings().demo_ttl_hours
    before = datetime.now(UTC)
    response = client.post("/api/auth/demo", json={"email": "ttl-endpoint@test.local"})
    assert response.status_code == 200, response.text
    body = response.json()

    claims = jwt.decode(body["token"], options={"verify_signature": False})
    assert claims["exp"] - claims["iat"] == ttl_hours * 3600

    expires_at = datetime.fromisoformat(body["expires_at"])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    assert abs((expires_at - (before + timedelta(hours=ttl_hours))).total_seconds()) <= 10

    assert client.get("/api/auth/me", headers=_bearer(body["token"])).status_code == 200
