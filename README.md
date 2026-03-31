# Roommate Matcher

## Demo Data Seed

Use the migration-backed seed runner for deterministic local data setup.

```powershell
# Reset DB, rebuild schema via Alembic, ingest demo CSVs, and run matching
python demo-data/seed.py --reset --run-matching
```

```powershell
# Reset DB and rebuild schema only (no CSV ingestion)
python demo-data/seed.py --reset --schema-only
```

## Browser E2E

Playwright startup is deterministic: backend startup runs `seed.py --reset --schema-only` before serving.
E2E scripts auto-detect Python from `.venv` or system PATH. You can override interpreter selection with `PYTHON_EXECUTABLE`.

```powershell
Set-Location frontend
npm install
npm run e2e:install
npm run e2e
```

## Backend Validation

```powershell
Set-Location backend
python -m pytest
```
