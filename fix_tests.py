import pathlib
for f in pathlib.Path('backend/tests/api').glob('*.py'):
    content = f.read_text()
    new_content = content.replace('workspace_id = __import__("uuid").uuid4()', 'workspace_id = seed_tenant_and_user["workspace_id"]')
    f.write_text(new_content)
