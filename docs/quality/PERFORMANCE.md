# PERFORMANCE — budget before, measured after

Every change below was kept only because it beat its stated budget. Measurements are from this
machine (8 logical cores, Windows, Python 3.11.9, Node 22.20.0), unless noted.

## 1. Backend matching — 200 students / 100 rooms (2-bed)

Budget: **≤ 5,000 ms** for one segment (the brief asks for run latency on this seed).

| Stage | Median | Result |
|---|---:|---|
| Baseline (encoded integer weights + full-state re-evaluation per swap) | **56,268 ms** | over budget |
| Float weights in `graph_builder` (same lexicographic tie intent, no huge integers) | 26,116 ms | still over |
| + incremental swap evaluation (`_evaluate_room`, two rooms per candidate) | 1,323 ms | passes |
| + explicit equal-score canonicalization (restores deterministic lexicographic ties) | **3,592 ms** | **passes** |

Command: `cd backend; uv run --extra dev python scripts/benchmark_matching.py --students 200 --room-size 2 --iterations 3`

```
{'students': 200, 'room_size': 2, 'rooms': 100,
 'iterations_ms': [3573.8, 3611.02],
 'median_ms': 3592.41, 'min_ms': 3573.8, 'max_ms': 3611.02, 'swap_passes': 0}
```

15.7x faster than baseline. The explicit tie pass trades ~2.3 s for a deterministic,
lexicographically smallest pairing among exactly equal scores; the 5 s budget still holds.

## 2. Matching-runs history — N+1 query

Budget: **≤ 2 SELECTs** for 5 runs.

- Before: 1 query for runs + 1 count query per run = **6 SELECTs**.
- After: 1 runs query + 1 grouped count query = **2 SELECTs**.

Guarded by `backend/tests/matching/test_query_count.py`.

## 3. Frontend initial bundle

Budget: **≤ 600 kB minified JS** (baseline was 738.42 kB with a Vite warning).

| Build | JS | gzip | CSS | gzip |
|---|---:|---:|---:|---:|
| Baseline | 738.42 kB | 214.49 kB | 91.93 kB | 18.40 kB |
| Route-level `React.lazy` (home + shell eager) | **548.09 kB** | **160.25 kB** | 92.31 kB | 18.46 kB |

26 % smaller initial JS, 25 % smaller gzip. The warning is gone.

## 4. Route load (production preview, 1280×900)

Budget: **LCP ≤ 800 ms**, CLS ≤ 0.1.

`node scripts/measure-redesign.mjs --base http://127.0.0.1:4175`

| Route | LCP | CLS | DCL | transferred |
|---|---:|---:|---:|---:|
| home | 660 ms | 0.0041 | 170 ms | 90.8 kB |
| login | 332 ms | 0.0004 | 157 ms | 91.1 kB |
| dashboard | 380 ms | 0.0014 | 155 ms | 95.0 kB |
| matching-runs | 364 ms | 0.0530 | 151 ms | 96.5 kB |

All inside budget; matching-runs CLS is 0.053 (good, < 0.1).

## 5. Frontend unit suite

Budget: **≤ 30 s** (brief target; baseline 20 s at 57 tests, 62 s cold).

| State | Files | Tests | Vitest duration |
|---|---:|---:|---:|
| Baseline | 23 | 57 | 17.8–18.2 s |
| Final (happy-dom + node env for pure libs + dep optimizer) | 49 | 386 | **27.5-29.4 s** |

Changes kept: `happy-dom` for DOM tests, `// @vitest-environment node` on 13 pure files,
conditional `jest-dom`, dependency optimizer, 10 workers. Wall time including npm/Node startup is
~30–32 s on this machine; the suite's own duration is 27.5–29.4 s.

## 6. Repo slimming

- Deleted `backend/tests/fixer.py`, `refactor.py`, `refactor2.py`, `refactor3.py` (unreferenced scratch).
- Deleted `app/services/scoring_adapter.py` (broken unused import shim).
- Deleted broken dead `get_dashboard_summary` (missing required `workspace_id`; no callers).
- Removed dead reactivation blocks and unreachable defensive branches (9 lines) to reach 100 % on
  matching/ingestion by deletion rather than suppression.

## 7. Checked, not changed (no win to claim)

- **Upload memory**: `MAX_CSV_UPLOAD_BYTES` is 5 MB; the route reads 64 KB chunks into a list and
  joins once, so peak is bounded at ~2x the file (10 MB) plus parsed rows. Streaming to disk would
  add complexity for a hard 5 MB ceiling; no change.
- **Export streaming**: `_iter_assignment_rows` already yields rows; the route uses
  `StreamingResponse`, so a large export is not buffered whole. No change.
- **Indexes**: reviewed against the real query patterns — `students(workspace_id, admission_number)`
  unique, `rooms(workspace_id, segment_id, room_id)` unique, `room_assignments(matching_run_id,
  segment_id, room_id)` unique, `pair_scores(matching_run_id, segment_id, pair_a, pair_b)` unique,
  plus `workspace_id`/`segment_id` indexes on every child table and `matching_runs.workspace_id`.
  Existing indexes cover the reads; no new migration.
- **Student results payload**: the response is dominated by reasons and factor traces, which are
  the product output, not overhead. No field removed.

