# BASELINE — measured 2026-11-15

All commands run from the repo root on Windows/PowerShell, Python 3.13.7, Node 22.20.0, uv 0.10.12.
Every number below is from a real command in this session; the tail is quoted.

## Backend unit/integration

Command: `cd backend; uv run --extra dev pytest -q`

| Run | Result | Wall |
|---|---|---|
| 1 | 269 passed | 44.5 s |
| 2 | 269 passed | 43.5 s |
| 3 | 269 passed | 36.6 s |

Coverage command:
`cd backend; uv run --extra dev pytest --cov=app --cov-report=term-missing --cov-report=json:coverage.json`

```
TOTAL   4090   410   1004   184   87%
1 failed, 268 passed, 2 warnings in 54.66s
```

The single failure under coverage is
`tests/matching/test_performance_smoke.py::test_performance_smoke_50_student_2bed_under_2_seconds`:
the test asserts a 2.0 s wall-clock bound, and coverage instrumentation pushes the run over it. The
same test passes without coverage (269 passed). This is the wall-clock coupling called out in Phase 2;
it is fixed there with the reason recorded.

Coverage by required package (line %):

| Package | Line | Branch | Missing lines |
|---|---:|---:|---:|
| `services/scoring` | 100 | 100 | 0 |
| `services/matching` | 80–100 | — | 50 |
| `services/fairness` | 90 | 80 | 4 |
| `services/ingestion` | 79–98 | — | 38 |
| whole app | 87 | 82 | 410 |

## Frontend unit

Command: `cd frontend; npm run test`

| Run | Result | Wall | Vitest duration |
|---|---|---|---|
| 1 | 57 passed / 23 files | 20.6 s | 18.20 s |
| 2 | 57 passed / 23 files | 20.3 s | 18.01 s |
| 3 | 57 passed / 23 files | 20.1 s | 17.84 s |

The 62 s figure in the brief was a cold run; warm baseline is ~20 s, already inside the ≤30 s target.

Coverage command: `cd frontend; npm run test:coverage`

```
All files | 73.89 | 69.81 | 52.86 | 73.89
```

| Scope | Line % | Branch % | Func % |
|---|---:|---:|---:|
| `src/lib` | 54.60 | 85.55 | 43.13 |
| `src/hooks` | 34.33 | 80.00 | 18.36 |
| `src/pages` | 74.17 | 54.64 | 55.17 |
| whole `src` | 73.89 | 69.81 | 52.86 |

## Typecheck / build

| Command | Result | Time |
|---|---|---|
| `npm run typecheck` | exit 0 | 1.6 s |
| `npm run build` | exit 0 | 26 s (tsc + vite 11.34 s) |

Bundle:

```
dist/index.html                 0.40 kB │ gzip:   0.27 kB
dist/assets/index-*.css        91.93 kB │ gzip:  18.40 kB
dist/assets/index-*.js        738.42 kB │ gzip: 214.49 kB
(!) Some chunks are larger than 500 kB after minification.
```

## E2E

Command: `cd frontend; npm run e2e` (Playwright, 1 worker, retries 0).

**Baseline: RED.** 15 tests in 5 specs. The run was stopped after three consecutive failures, all
caused by specs written against the pre-redesign UI:

| Test | Time | Failure |
|---|---|---|
| `phase2-workspace.spec.ts:4` Unauthenticated Routing | 19.3 s | Asserts `/` redirects to `/login`; `/` is now the public homepage and `/app` is the guarded route. |
| `phase2-workspace.spec.ts:12` Demo Flow Verification | 1.7 min | Looks for button "Launch demo"; the redesigned login button is "Open the demo workspace", and it navigates straight to `/app/:id/dashboard`, not `/app`. |
| `phase2-workspace.spec.ts:39` Workspace Creation | 1.7 min | Same stale demo selector. |

Playwright boots its own servers; ports 8000/5173 were free before the run. Stale `vite preview`
on 4173 from an earlier session was observed but is unrelated (E2E uses 5173).

**Per-spec baseline not established for the remaining 12 tests** because the first three failures
block the serial suite; they are re-established after the Phase 2 selector fixes and twice in the
DoD. This is recorded as an open red, not a pass.

## Seeded matching run

Command: `backend\.venv\Scripts\python.exe demo-data\seed.py --reset --run-matching`

```
elapsed=6.39s exit=0
Total rows: 96 / Accepted: 96
Status: completed
Segments matched: 4
```

Resets the SQLite schema, ingests 96 students + 38 rooms + 96 form responses, and completes a
4-segment matching run in 6.39 s total.

## Postgres parity

`docker version` at baseline:

```
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
```

`psql` is not installed. Docker Desktop was started during Phase 0; the parity suite status is
recorded in `PROGRESS.md`/`REPORT.md` with the exact unblock command. No Postgres number is claimed.

## Environment facts confirmed

- Ports 8000/5173 free before runs.
- Root `.venv` present; backend dev deps only via `uv run --extra dev`.
- `data/app.db` is a local, gitignored SQLite artifact; E2E reset rewrites it to schema-only.
- No live Supabase/Postgres connection was used anywhere in this baseline.
