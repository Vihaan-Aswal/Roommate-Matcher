import sys
import re

# Update config.py
with open('backend/app/config.py', 'r', encoding='windows-1252', errors='replace') as f:
    content = f.read()

replacement = '''    # --- Supabase Auth ---
    supabase_project_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_issuer: str = ""
    supabase_jwt_audience: str = "authenticated"
    supabase_jwt_secret: str = ""'''

content = re.sub(
    r'    # --- Supabase Auth ---.*?supabase_jwt_audience: str = "authenticated"',
    replacement,
    content,
    flags=re.DOTALL
)

with open('backend/app/config.py', 'w', encoding='windows-1252') as f:
    f.write(content)

# Update .env.example
with open('backend/.env.example', 'a', encoding='windows-1252') as f:
    f.write('\nSUPABASE_JWT_SECRET="your-supabase-jwt-secret-here"\n')

print('Config and .env.example updated.')
