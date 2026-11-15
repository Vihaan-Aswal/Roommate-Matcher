from app.config import get_settings


def test_verify_env():
    settings = get_settings()
    assert settings.supabase_jwt_secret != ""
