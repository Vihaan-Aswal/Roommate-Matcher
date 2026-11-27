from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from tests.public_form.test_payload_limits import VALID_ANSWERS


def _submit(
    client: TestClient, *, phone_last4: str = "7890", admission_number: str = "ADM001"
):
    return client.post(
        "/api/public/forms/VALID_TOKEN/submit",
        json={
            "submitted_admission_number": admission_number,
            "submitted_phone_last4": phone_last4,
            "answers": VALID_ANSWERS,
        },
    )


def test_sixth_submission_in_a_minute_is_throttled(
    client: TestClient, test_setup, db_session: Session
) -> None:
    for _ in range(5):
        response = _submit(client)
        assert response.status_code == 200, response.text
        assert response.json()["valid"] is True

    sixth = _submit(client)

    assert sixth.status_code == 429, sixth.text
    assert "Too many submissions" in sixth.json()["detail"]
    assert sixth.headers["retry-after"] == "60"
    assert db_session.query(FormResponse).count() == 5


def test_failed_verification_attempts_count_towards_the_throttle(
    client: TestClient, test_setup
) -> None:
    for _ in range(5):
        response = _submit(client, phone_last4="0000")
        assert response.status_code == 200, response.text
        assert response.json()["valid"] is False

    blocked = _submit(client, phone_last4="0000")

    assert blocked.status_code == 429, blocked.text


def test_unknown_admission_numbers_are_throttled(
    client: TestClient, test_setup, db_session: Session
) -> None:
    for _ in range(5):
        response = _submit(client, admission_number="UNKNOWN001")
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "recorded"
        assert response.json()["valid"] is False

    blocked = _submit(client, admission_number="UNKNOWN001")

    assert blocked.status_code == 429, blocked.text
    assert "Too many submissions" in blocked.json()["detail"]
    assert blocked.headers["retry-after"] == "60"
    assert db_session.query(FormResponse).count() == 5
