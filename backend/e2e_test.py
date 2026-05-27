import os
import sys
from dotenv import load_dotenv

# Load backend env
load_dotenv('.env')

# Load frontend env
load_dotenv('../frontend/.env.local')
supabase_url = os.getenv('VITE_SUPABASE_URL')
supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')

print(f"Loaded Supabase URL: {supabase_url}")

from supabase import create_client, Client
supabase: Client = create_client(supabase_url, supabase_key)

print("Logging in to Supabase...")
try:
    res = supabase.auth.sign_in_with_password({
        "email": "test@example.com",
        "password": "Test@123"
    })
    access_token = res.session.access_token
    print(f"Obtained access token (first 20 chars): {access_token[:20]}...")
except Exception as e:
    print(f"Failed to login to Supabase: {e}")
    sys.exit(1)

from fastapi.testclient import TestClient
from app.main import app
from app.auth.supabase import verify_supabase_jwt

print("Attempting direct local verification...")
try:
    verify_supabase_jwt(access_token)
    print("Direct verification SUCCESS")
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"Direct verification FAILED: {e}")

client = TestClient(app)

print("Sending token to local backend /api/auth/session...")
response = client.post("/api/auth/session", json={"access_token": access_token})

print(f"Backend Response Status: {response.status_code}")
print(f"Backend Response Body: {response.json()}")

assert response.status_code == 200
print("End-to-end Auth test passed successfully!")
