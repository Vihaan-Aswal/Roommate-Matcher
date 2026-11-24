from app.api.routes.public_form import RATE_LIMIT_SUBMIT


def test_submit_rate_limit_fits_a_shared_hostel_ip() -> None:
    per_minute = int(RATE_LIMIT_SUBMIT.split("/")[0])
    assert per_minute >= 500
