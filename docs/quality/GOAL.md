# GOAL — Make Roommate Matcher provably correct, fully tested, and fast

This brief is self-contained. Treat the repository as the source of truth and verify every claim below before relying on it.

---

## Mission

Take the entire repository — FastAPI backend, React frontend, E2E suite, scripts, migrations, deploy config — to a state where **every behaviour is guarded by a test at the cheapest layer that can catch it**, every existing test is worth trusting, **every defect found is fixed at the root**, and the app is measurably faster and leaner. Do not stop at "the suite is green". Stop when the Definition of Done below is true and evidenced.

Do not ask which part to do first; the phase order is the answer. Work through it, keep `docs/quality/PROGRESS.md` current, and finish the whole thing.

---

## Baseline — reproduce this before trusting it (verified 2026-11-15)

| Suite | Command | Baseline |
|---|---|---|
| Backend | `cd backend; uv run --extra dev pytest -q` | 269 passed |
| Frontend unit | `cd frontend; npm run test` | 57 passed, 23 files, ~62 s |
| Frontend typecheck/build | `npm run typecheck`, `npm run build` | assumed green — verify |
| E2E | `npm run e2e` | **unverified** — establish it |
| Coverage | none installed | — |

Known environment facts, do not rediscover them the hard way:

- Windows + PowerShell. Repo root: `C:\Users\vihaa\OneDrive\Desktop\Roommate-Matcher`.
- The root `.venv` lacks dev deps. Backend tests run through `uv run --extra dev`.
- Playwright boots its own servers: backend `127.0.0.1:8000`, frontend `5173`; `npm run e2e:reset-db` resets demo data. `reuseExistingServer: true` means a stale server can silently serve old code — check ports before blaming a test.
- Live Supabase/Postgres is production. **Never point a test at it.** Local `data/app.db` is a 186 MB dev artifact, gitignored; tests use in-memory SQLite.
- Docker Desktop is installed but its daemon was not running. Start it for the Postgres parity suite if you can; otherwise mark that suite BLOCKED with the exact command, never fake it.

Read first: `README.md`, `PRODUCT.md`, `DESIGN.md`, `backend/README.md`, `docs/redesign/03-progress.md`. They define intended behaviour; tests must encode it, not invent a new product.

---

## Phase 0 — Instrument the baseline

No product changes yet.

1. Add `pytest-cov` to backend dev extras and a coverage config; add `@vitest/coverage-v8` and a `test:coverage` script to the frontend.
2. Record, with commands: pass/fail counts, wall time (3 consecutive runs), coverage line/branch per package, E2E results and per-spec time, production bundle size, and latency of one seeded matching run.
3. Write `docs/quality/BASELINE.md`.

**Exit:** a second person can reproduce every number with the documented commands.

## Phase 1 — Map coverage

Enumerate every behaviour-bearing file and classify it (tested / partially / untested, layer, risk H-M-L):

- Backend: all 12 `app/api/routes/*`, `api/deps`, `services/{matching,scoring,fairness,explainability,ingestion,magic_fill,orchestration,public_form,platform,segments}`, `auth`, `schemas`, `models`, `config`, `database`, `main`.
- Frontend: 17 pages, 41 components, 17 hooks, 12 `lib` modules, providers, layouts, `App.tsx` routing.
- Also: `frontend/scripts/*` (boot, reset, seed, capture, audit, measure), backend `scripts/*`, 9 Alembic migrations, `start.sh`/`start.bat`, `render.yaml`, `vercel.json`, `pyproject.toml`/`package.json`.

Write `docs/quality/COVERAGE-MAP.md`. **No file may be left "unknown".**

**Exit:** every file has an owner test file or a one-line reason it is excluded (config glue, generated code, vendored primitives).

## Phase 2 — Perfect the existing suite

Audit all 326 existing unit/integration tests and 5 E2E specs for:

- assertions on mocks instead of behaviour; tests that cannot fail; snapshot-only coverage
- duplicated fixtures, order dependence, shared mutable state, `sleep`, wall-clock coupling
- wrong layer (DB setup in a pure-function test), tests asserting implementation details
- stale expectations after the recent dashboard/form/segment-label changes
- dead scratch files in `backend/tests` (`fixer.py`, `refactor*.py`) — delete only if unreferenced
- warnings that hide failures: Pydantic class-based `config`, React Router future flags

Then prove the suite can fail: for each critical module (`matching`, `scoring`, `fairness`, `ingestion`, `auth/dependencies`, `privacySafeRender`), mutate one behaviour and confirm a test goes red. Log the evidence. Restore the code.

Speed targets: frontend unit suite 62 s → ≤30 s; backend suite must not regress. Run each suite 3× and confirm zero flake.

**Exit:** every surviving test has a reason to exist and has been seen to fail when its behaviour breaks.

## Phase 3 — Fill the gaps, layer by layer

| Layer | What must exist |
|---|---|
| **Unit — backend** | Scoring: distance, habit/comfort mismatch, matrix compatibility, segment matrices, weight renormalisation with missing values, label thresholds. Matching: 2-bed bipartite, 3-bed blossom-seeded growth, 4-bed pair merge, swap optimiser passes and tie-breaks, graph builder, invariants, NX mapping, satisfaction, pair lookup. Fairness, explanation templates, privacy-safe rendering, CSV parsing/validation/upsert diff+apply, magic fill, orchestration, public-form tokens, app tokens. |
| **Integration — backend** | Every route × {happy, invalid input, unauthenticated, wrong tenant/workspace, not found}. DB constraints, cascade deletes, file-size limits, rate limits, idempotency, error envelope shape, export scoping. |
| **Contract** | `apiClient` ↔ backend response shapes; form question catalog ↔ submission payload; export CSV headers/rows; OpenAPI route/schema stability. Fail the build when they drift. |
| **System** | One seeded pipeline end to end: upload students + rooms → segments → public form submit → matching run → room results → student results → fairness → export → manual checker. Plus failure paths: capacity shortfall, zero rooms, duplicate admission numbers, bad DOB, expired/used form token. |
| **E2E (Playwright)** | All 17 routes at 1280 and 375. Auth guards and redirects, impersonation, at-risk rail, CSV upload + diff preview, form submission, manual checker, platform console. Empty/loading/error states. Assert zero console errors and no horizontal overflow. |
| **Non-functional** | a11y sweep (axe) on the 8 core pages; keyboard/focus order; performance budgets; security matrix (JWT expiry/issuer/audience/alg, IDOR on `run_id`/`workspace_id`/`segment_id`, mass assignment, PII in responses/exports/logs, CORS, demo-token TTL); determinism and invariants (same input → same plan, capacity/gender/segment respected, no cross-segment pairing); migrations up **and** down; bounded load test. |

**Exit:** every row of `COVERAGE-MAP.md` is green, not "mostly".

## Phase 4 — Fix everything

- Root cause, once, in the shared code — not per caller.
- Each fix lands with a regression test that fails before it and passes after; cite the evidence.
- No suppression escapes (`skip`, `xfail`, `type: ignore`, `eslint-disable`, bare `except`) without a written reason and expiry in the report.
- Preserve public API shapes, route names, CSV columns and deterministic output. Any behaviour change must be listed with before/after and the defect that justified it.
- Postgres-only paths (RLS policies, JSONB, `alembic` migrations, cascade semantics) must be exercised against a real Postgres gated on `TEST_DATABASE_URL`, or explicitly BLOCKED. SQLite-only proof is not proof.

## Phase 5 — Optimise, with numbers

Only changes that show a measured win survive.

- Backend: N+1 queries (count statements), run latency on a 200-student / 100-room seed, upload memory, export streaming, response payload size, indexes matched to real query patterns.
- Frontend: route-level code splitting, re-render churn, React Query caching/`staleTime`, page load and first paint, test-suite runtime.
- Repo: dead files, unused dependencies, duplicated helpers, scratch scripts.
- State a budget before each change and the result after; revert anything that does not beat it.

## Phase 6 — CI

One workflow that, on push and PR: backend tests + coverage, frontend typecheck + unit + coverage + build, Playwright E2E with traces uploaded on failure, dependency caching, coverage floors enforced. It must be green from a clean clone. Document any required env (local suites should need none).

---

## Definition of Done — all must be true

1. `cd backend && uv run --extra dev pytest` → all pass, 0 failed, 0 errors. Postgres-gated skips only, each explained in the report.
2. `cd frontend && npm run test` → all pass, ≤30 s.
3. `npm run typecheck` and `npm run build` → pass.
4. `npm run e2e` → all pass, run **twice consecutively**, zero retries, zero flakes.
5. Coverage: backend ≥90 % line / ≥85 % branch overall, and **100 % line** on `services/matching`, `services/scoring`, `services/fairness`, `services/ingestion`; frontend ≥85 % line/function on `src/lib`, `src/hooks`, `src/pages`. Every other file has tests or a justified exclusion in `COVERAGE-MAP.md`.
6. Every route handler is exercised at least once; every page is rendered by a test; every hook is invoked by a test.
7. CI green on a fresh clone.
8. `docs/quality/REPORT.md` contains: baseline vs final table (tests, coverage, duration, bundle, run latency), defect list (found / fixed / remaining + severity), behaviour changes, exclusions, known risks.
9. The 326 pre-existing tests still exist and still pass. If one had to be rewritten, name it and say which behaviour it now guards.

## Evidence rules

- Never claim green without pasting the command and the real output tail.
- Never weaken, delete, or skip a test to get green. A test may only change if its expectation was wrong; log why.
- Never mock the thing under test. No network calls in unit/integration tests. No `sleep`.
- Deterministic fixtures, unique IDs, no absolute paths, no reliance on test order.
- Blocked means BLOCKED with the unblock command. Never invent a pass.

## Output protocol

- After each phase: update `docs/quality/PROGRESS.md` (done / next / blockers) and make a local commit (`test:`, `fix:`, `perf:`, `chore:`). Do not push, do not rewrite history.
- If your context is running low, write the exact resume point and the next command into `PROGRESS.md` before you stop. Never leave the tree unbuildable.
- Independent modules may be delegated to subagents, but one owner per file, and you review and verify every result yourself.
- Final message: scoreboard table (command → result → duration), coverage table, defects fixed, and the top five remaining risks, each with severity.

## Anti-goals

No redesign, no new product features, no route/column renames, no schema change without a migration and tests, no deleting user work (`demo-data/`, `docs/`, `frontend/demos/`), no touching real Supabase data, and no "temporarily disabled" test left behind.
