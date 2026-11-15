# PROGRESS — quality pass

Live status for `docs/quality/GOAL.md`. Updated after every phase.

## Phase status

| Phase | Status | Evidence |
|---|---|---|
| 0 — Instrument baseline | in progress | `BASELINE.md` being written |
| 1 — Coverage map | pending | — |
| 2 — Perfect existing suite | pending | — |
| 3 — Fill gaps | pending | — |
| 4 — Fix everything | pending | — |
| 5 — Optimise | pending | — |
| 6 — CI | pending | — |

## Baseline (captured 2026-11-15)

- Backend: 3 consecutive runs, 44.5 s / 43.5 s / (run 3 pending), 269 passed.
- Frontend: pending.
- E2E: pending.
- Build: pending.

## Resume point

Phase 0. Next command: `cd backend; uv run --extra dev pytest --cov=app --cov-report=term-missing`.

## Blockers

None.
