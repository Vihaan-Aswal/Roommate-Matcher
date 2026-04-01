# Roommate Matcher

**Graph-based hostel roommate allocation with weighted compatibility scoring, blossom-algorithm matching, and per-run fairness reporting.**

Built as a fully local, production-structured full-stack system — FastAPI backend, React + TypeScript frontend, SQLite persistence, deterministic matching artifacts versioned by run ID.

---

## The problem

Traditional hostel allocation is purely logistical — it fills beds, not compatibility gaps. The result is avoidable roommate conflicts that escalate into welfare issues for administrators to manage.

Roommate Matcher keeps all physical and policy constraints intact (gender, year group, AC type, room size) but adds a compatibility layer on top: multi-factor lifestyle scoring, graph-theoretic assignment, and explainability output that tells admins _why_ each pairing was made.

---

## What makes this interesting

- **Graph matching at the core.** 2-bed segments use maximum-weight bipartite matching. 3-bed segments use blossom-seeded pair growth. 4-bed segments merge high-quality pairs by maximising internal mean score. A bounded post-pass swap phase then improves minimum satisfaction without introducing new poor cases.
- **Weighted multi-factor scoring.** Ten lifestyle factors (sleep schedule, cleanliness, smoking, diet, etc.) with individually tuned weights. Distance, directional mismatch, and compatibility-matrix patterns are handled differently per factor type. Missing values are excluded and weights renormalized — not filled or zeroed.
- **Deterministic and versioned.** Identical inputs always produce identical outputs. Every run appends a new `run_id`; no historical run is overwritten. Results are fully auditable and reproducible.
- **Privacy-safe explainability.** Sensitive factor values are used for scoring but rendered in neutral language in explanation output — admins see _why_ a pairing was made without seeing raw lifestyle disclosures.
- **Fairness reporting built in.** Every run persists at-risk flags, label distribution, and segment-level satisfaction snapshots. Admins can act on this before the semester starts.

---

## End-to-end workflow

1. Admin uploads student master CSV and (optionally) room inventory CSV.
2. System derives immutable segment keys from gender, year group, AC type, and room size.
3. Students submit the preference form; responses are validated against `admission_number + dob` and the latest valid profile is activated.
4. Matching run computes pair scores, assigns rooms, and persists run-versioned artifacts.
5. Admin reviews room view, student view, fairness report, and CSV export.
6. Manual Checker reuses the same scoring and explanation logic for mid-semester exception handling.

---

## Scoring model

Ten factors, each weighted and scored by pattern type:

| Factor    | Description                         | Weight |
| --------- | ----------------------------------- | -----: |
| `q1_enc`  | Sleep schedule                      |   0.20 |
| `q2_enc`  | Cleanliness                         |   0.15 |
| `q6_enc`  | Smoking preference                  |   0.15 |
| `q3_enc`  | Late return time                    |   0.10 |
| `q4a_enc` | Room use (habit/comfort axis)       |   0.10 |
| `q5a_enc` | Night activity (habit/comfort axis) |   0.10 |
| `q7_enc`  | Alcohol preference                  |   0.05 |
| `q8_enc`  | Diet preference                     |   0.05 |
| `q9_enc`  | Budget/lifestyle expectation        |   0.05 |
| `q10_enc` | Lifestyle tolerance                 |   0.05 |

Weights sum to `1.0`.

Scoring patterns used per factor:

- **Distance lookup** — `q1`, `q2`, `q3`, `q9`
- **Directional habit/comfort mismatch** — `q4`, `q5`
- **Matrix compatibility** — `q6` (smoking), `q7` (alcohol), `q8` (diet)
- **Symmetric tolerance distance** — `q10`

Pair score equation:

```text
pair_score = sum(raw_factor_score * effective_weight)
```

`pair_score` is clamped to `[0, 1]`.

**Excellent safety condition** — a score only qualifies as Excellent if it clears 0.90 _and_ all heavy factors (sleep, cleanliness, room-use axis, night-activity axis, smoking) are strictly non-zero. This prevents a high average from masking a critical incompatibility on one key dimension.

---

## Satisfaction labels and at-risk rule

| Label     | Condition                                   |
| --------- | ------------------------------------------- |
| Excellent | score ≥ 0.90 and all heavy factors non-zero |
| Good      | score ≥ 0.70                                |
| Okay      | score ≥ 0.55                                |
| Poor      | otherwise                                   |

```text
is_at_risk = satisfaction_score < 0.55
```

Students flagged at-risk are surfaced in the fairness report for admin review before room keys are issued.

---

## Room assignment strategy by room size

- **2-bed segments** — maximum-weight matching on pair graph.
- **3-bed segments** — blossom-based seed pairs, then best-third growth with deterministic tie-breaks.
- **4-bed segments** — build high-quality pairs, then merge pair+pair maximising internal mean score.
- **Post-pass optimization** — bounded swap pass improves minimum satisfaction without introducing new poor cases.

---

## Explainability and fairness outputs

**Explainability:**

- 2-bed rooms: direct pair factors
- 3/4-bed rooms: aggregate student-roommate edges
- Output: 2 to 3 reason statements with factor trace metadata
- Sensitive factors rendered with privacy-safe language

**Fairness metrics persisted per run:**

- Run-level label distribution
- Run-level at-risk count and IDs
- Segment-level minimum satisfaction and distribution snapshots

---

## Tech stack

| Layer    | Tools                                                                          |
| -------- | ------------------------------------------------------------------------------ |
| Frontend | React, TypeScript, Vite, React Router, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend  | FastAPI, Python, Pydantic, SQLAlchemy, Alembic                                 |
| Database | SQLite (`data/app.db`)                                                         |
| Matching | pandas, NumPy, NetworkX                                                        |
| Testing  | pytest, Vitest, Playwright                                                     |

Design constraints: fully local-first, no cloud dependencies, minimal required environment variables, single-command startup.

---

## Architecture

```
backend/app/api         — thin FastAPI handlers (validate → call service → return)
backend/app/services    — all business logic (ingestion, scoring, matching, explainability, fairness)
backend/app/models      — SQLAlchemy models
backend/app/schemas     — Pydantic contracts
backend/alembic         — migration history
frontend/src/pages      — route-level screens
frontend/src/components — reusable UI components
frontend/src/lib        — API client and shared utilities
data/                   — SQLite database and generated matching artifacts
demo-data/              — deterministic demo CSVs and seed tooling
```

**Key architectural decisions:**

- `segment_key` format is `{gender}_{year_group}_{ac_type}_{room_size}` — immutable once stored, used as the hard matching boundary. No cross-segment assignment is possible.
- Matching results are versioned and append-only by `run_id`. No overwrite of historical runs.
- Matching is deterministic for identical inputs, including tie-break behavior.
- Sensitive lifestyle values are used for scoring but exposed only in privacy-safe phrasing.

**Key integrity rules enforced by services:**

- Room capacity must match segment room size.
- All matching artifacts must stay inside the same segment.
- Each rerun creates a new `run_id`.
- Pair scores are canonicalized for student ordering (`student_a < student_b`).

---

## Data model

Core tables:

| Table                 | Purpose                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `segments`            | Canonical matching partitions                                    |
| `students`            | Master student identity and static assignment attributes         |
| `rooms`               | Room inventory by segment                                        |
| `form_responses`      | Raw submissions and validation status                            |
| `preference_profiles` | Raw and encoded preference features (active profile per student) |
| `matching_runs`       | Run metadata and status (append-only)                            |
| `pair_scores`         | Pair compatibility artifacts per run                             |
| `room_assignments`    | Final room outputs per run                                       |

---

## API surface

All routes mounted under `/api`. Full interactive docs at `http://127.0.0.1:8000/docs`.

| Area      | Endpoints                                                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload    | `/students/upload`, `/rooms/upload`, `/upload/error-reports/{report_name}`                                                                           |
| Form      | `/form/submit`, `/form/status`, `/form/non-submitters`                                                                                               |
| Segments  | `/segments`, `/segments/{segment_key}`, `/segments/{segment_key}/students`                                                                           |
| Matching  | `/matching/run`, `/matching/runs`, `/matching/runs/{run_id}/segments/{segment_key}/rooms`, `/matching/runs/{run_id}/segments/{segment_key}/students` |
| Fairness  | `/fairness/{run_id}`                                                                                                                                 |
| Checker   | `/checker/compatibility`                                                                                                                             |
| Exports   | `/exports/assignments/{run_id}`                                                                                                                      |
| Dashboard | `/dashboard`                                                                                                                                         |

---

## Run locally

**Prerequisites:** Python 3.11+, Node.js 18+, npm

```bash
# macOS / Linux
sh ./start.sh

# Windows
start.bat
```

Then open:

- App: `http://127.0.0.1:8000`
- API docs: `http://127.0.0.1:8000/docs`

The startup script handles everything on first run: creates the virtual environment, installs backend and frontend dependencies, builds the frontend, and seeds demo data with a matching run already executed.

**Bootstrap steps (automatic):**

1. Create `.venv` if missing.
2. Install backend package if dependencies are missing.
3. Install frontend dependencies if `frontend/node_modules` is missing.
4. Build frontend if `frontend/dist/index.html` is missing.
5. Seed SQLite demo data if `data/app.db` is missing.

**Force refresh flags:**

```bash
# Rebuild frontend bundle
sh ./start.sh --rebuild-frontend
start.bat --rebuild-frontend

# Wipe and reseed the database
sh ./start.sh --reseed-data
start.bat --reseed-data
```

Use both flags together for a full local refresh.

---

## Development mode

**Backend:**

```bash
python -m venv .venv
source .venv/bin/activate            # Windows: .\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -e "./backend[dev]"
python demo-data/seed.py --reset --run-matching
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev
# → http://localhost:5173
```

**Seed commands:**

```bash
# Reset DB, run migrations, ingest demo CSVs, and run matching
python demo-data/seed.py --reset --run-matching

# Reset DB and schema only
python demo-data/seed.py --reset --schema-only
```

---

## Testing

```bash
# Backend
cd backend && python -m pytest

# Frontend unit
cd frontend && npm run test

# Frontend E2E (Playwright)
cd frontend && npm run e2e:install && npm run e2e
```

---

## Screenshots

### Dashboard

![Dashboard](images/dashboard.png)

### Matching results (room view)

![Matching Results](images/matching-results.png)

### Student results

![Student Results](images/student-results.png)

### Fairness report

![Fairness](images/fairness-report.png)

### Manual checker

![Manual Checker](images/manual-checker.png)

---

## Product scope (v1)

**In scope:**

- Segment-wise matching for 2, 3, and 4-bed rooms
- Student preference form ingestion and validation
- Admin upload, matching run, results, fairness, and export workflows
- Manual compatibility checker for mid-semester decisions

**Out of scope:**

- Deciding who gets AC/non-AC, hostel, or block
- Cloud deployment and managed infrastructure
- Continuous automatic global rematching during semester
- Complex legal discrimination auditing beyond operational fairness reporting

---

## Known limitations

- Local-only runtime (no cloud deployment target in v1)
- CSV export supported; PDF reporting is out of scope for v1
- Matching runs execute synchronously in the API flow

---

## Roadmap

- PDF report export
- Run-to-run comparison dashboards
- Advanced fairness metrics (envy-freeness, Gini-based inequality measures)
- Async matching execution for larger cohorts

---

## Repository layout

```
Roommate Matcher/
├── backend/
├── frontend/
├── data/
├── demo-data/
├── images/
├── start.bat
├── start.sh
└── README.md
```
