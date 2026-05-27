import os
from app.config import get_settings

def test_verify_env():
    settings = get_settings()
    secret = settings.supabase_jwt_secret
    print(f"\n--- ENV CHECK ---")
    print(f"SUPABASE_JWT_SECRET from get_settings(): {secret[:5]}...{secret[-5:]}" if secret else "NOT SET")
    print(f"-----------------\n")
    assert secret != ""
