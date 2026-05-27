import os
from dotenv import load_dotenv
from app.config import get_settings

load_dotenv('.env')
print(f"SUPABASE_JWT_SECRET from os.environ: {os.getenv('SUPABASE_JWT_SECRET')}")

settings = get_settings()
print(f"SUPABASE_JWT_SECRET from get_settings(): {settings.supabase_jwt_secret}")
