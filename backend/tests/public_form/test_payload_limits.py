"""Payload limits on the public form submission."""
from fastapi.testclient import TestClient

VALID_ANSWERS = {
    "q1_raw": "Before 11 PM (early)",
    "q2_raw": "Very tidy - I like things clean and organized",
    "q3_raw": "Before 10 PM",
    "q4a_raw": "Mainly for sleeping/studying, not for hanging out",
    "q4b_raw": "Very uncomfortable",
    "q5a_raw": "Almost never",
    "q5b_raw": "Very uncomfortable",
    "q6_raw": "I need a 100% smoke-free room",
    "q7_raw": "I require an alcohol-free room",
    "q8_raw": "I am strict vegetarian and require a meat-free room",
    "q9_raw": "Budget-conscious - prefer to keep costs low",
    "q10_raw": "I prefer someone very similar to me",
}


def _submit(client: TestClient, **overrides):
    body = {
        "submitted_admission_number": "ADM001",
        "submitted_phone_last4": "7890",
        "answers": dict(VALID_ANSWERS),
    }
    body.update(overrides)
    return client.post("/api/public/forms/VALID_TOKEN/submit", json=body)


def test_five_digit_phone_last4_is_rejected(client: TestClient, test_setup) -> None:
    response = _submit(client, submitted_phone_last4="78901")
    assert response.status_code == 422


def test_three_digit_phone_last4_is_rejected(client: TestClient, test_setup) -> None:
    response = _submit(client, submitted_phone_last4="789")
    assert response.status_code == 422


def test_overlong_answer_is_rejected(client: TestClient, test_setup) -> None:
    response = _submit(client, answers={"q1_raw": "x" * 201})
    assert response.status_code == 422


def test_unknown_answer_key_is_rejected(client: TestClient, test_setup) -> None:
    response = _submit(client, answers={"unknown_key": "x"})
    assert response.status_code == 422


def test_empty_answers_still_record_an_invalid_attempt(client: TestClient, test_setup) -> None:
    response = _submit(client, submitted_phone_last4="0000", answers={})

    assert response.status_code == 200
    assert response.json() == {
        "status": "recorded",
        "valid": False,
        "error": "Verification failed",
    }
