import sys

with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.startswith('from app.api.routes.checker import router as checker_router'):
        new_lines.append('from app.api.routes.auth import router as auth_router\n')
        new_lines.append(line)
    elif line.strip() == 'application.include_router(upload_router, prefix="/api")':
        new_lines.append('    application.include_router(auth_router)  # auth router handles its own /api/auth prefix\n')
        new_lines.append(line)
    else:
        new_lines.append(line)

with open('backend/app/main.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("main.py updated.")
