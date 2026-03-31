# Roommate Matcher — Master Execution Plan

---

## Section 1: Planning Basis

### Understanding the Product

Roommate Matcher is not a standard CRUD web app. It is a **batch decision-support tool** for housing administrators. Its primary value is a one-time, high-quality matching run at term start — not continuous operation or real-time updates. The admin is the only power user; students interact only through a simple preference form.

The system has three distinct technical layers that most web apps do not have:

1. **A scoring engine** — transforms categorical questionnaire answers into numeric factor scores using three different encoding patterns (distance-based, habit+comfort directional mismatch, pairwise matrix), then combines them into a weighted pair compatibility score. Critically, this must emit a **factor breakdown object** alongside every final pair score — not just the scalar — so explanations and fairness logic can consume it without recomputing anything.
2. **A matching engine** — uses graph algorithms (maximum-weight perfect matching via Edmonds' blossom for 2-bed rooms; a pair-first greedy heuristic with local swap improvements for 3- and 4-bed rooms) to assign students to rooms within each segment. The matching algorithm must sit behind a clean service interface so it can be exercised and tested independently of the API and database.
3. **An explanation and fairness engine** — classifies each factor per pair using the breakdown object, generates plain-English reasons, surfaces at-risk students, and computes satisfaction distributions. The Manual Checker must reuse this same engine — not a forked approximation — or results will diverge and admins will lose trust in the tool.

These three engines are the soul of the product. Everything else — CSV ingestion, API endpoints, the admin UI — is scaffolding that serves them.

### Main Architectural Areas

| Area                                    | Description                                                                                                                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data layer                              | SQLite + SQLAlchemy models + Alembic migrations. Stores students, segments, rooms, form responses, preference profiles, pair scores (with factor breakdowns), and matching run artifacts.                  |
| Ingestion pipeline                      | CSV parsing and validation for master students and room files. Form response ingestion, admission number + DOB validation, deduplication (latest-wins).                                                    |
| Scoring engine                          | Pure Python functions: encoding, factor scoring, weighted pair score. Must emit a factor breakdown object alongside every final score. Fully testable in isolation.                                        |
| Matching engine                         | NetworkX-based graph construction + matching algorithms per segment. Depends on pair scores. Lives behind a service interface. Fully testable in isolation with synthetic data.                            |
| Explanation + fairness engine           | Factor classification using breakdown objects → label → template-based text generation. Privacy-aware wording for sensitive factors. Fairness distribution computation. Manual Checker reuses this engine. |
| Backend API                             | FastAPI endpoints + Pydantic schemas. Orchestrates all services, persists run artifacts, serves the admin dashboard and student form.                                                                      |
| Admin frontend — core                   | Upload flows, matching run trigger and status, basic dashboard.                                                                                                                                            |
| Admin frontend — decision-support layer | Fairness view, at-risk review, student and room detail panels, manual checker. These form a coherent operational layer, not just more UI.                                                                  |
| Student form                            | A single simple React page for students to submit preferences.                                                                                                                                             |
| Export layer                            | CSV export of assignments. PDF is post-v1.                                                                                                                                                                 |

### Highest-Risk Technical Areas

**Risk 1 — Scoring engine correctness.**
The habit+comfort directional mismatch formula (`mismatch(A→B) = max(0, hA_norm - cB_norm)`) is easy to implement incorrectly. This formula is asymmetric by design — `mismatch(A→B)` is not the same as `mismatch(B→A)`. The symmetric axis score is the average of both directions. A single encoding error silently produces wrong scores that corrupt matching output and explanations downstream. Additionally, the smoking matrix uses different values than the diet and alcohol matrices — `(2,3)` maps to `0.5` for smoking but `0.7` for diet/alcohol. These must not share a single lookup implementation.

**Risk 2 — Matching algorithm correctness for 3/4-bed rooms.**
Two-bed matching via Edmonds' blossom (available in NetworkX) is well-understood. The 3/4-bed heuristic (build pairs → grow to rooms → local swaps) is custom and has tricky edge cases: segments where student count doesn't align neatly into pairs (producing leftover students), situations where no beneficial swap exists, and tie-breaking that must be deterministic for reproducibility. The NetworkX matching output is a set of frozensets that must be carefully mapped back to student IDs before building room assignments.

**Risk 3 — The Excellent label safety rule.**
The spec defines Excellent as `PairScore ≥ 0.90` **AND** no heavy-factor score is `0.0`. This two-condition rule is easy to forget. A pair with one complete smoking mismatch can still score `0.85` and must not be labeled Excellent. Miss this and admins will see "Excellent" on matches that have a silent serious clash.

**Risk 4 — Segment validation and capacity logic.**
The system must cleanly detect and communicate impossible scenarios (more students than beds), risk scenarios (many missing preferences), and handle rooms with auto-generated IDs when no room file is provided. Getting this wrong breaks the matching run flow.

**Risk 5 — Missing preferences policy must be decided before the scoring engine is written.**
This is a silent dependency. An undecided policy means the scoring pipeline is provisional. This must be locked in Phase 0.

**Risk 6 — Data model stability.**
If the database schema shifts significantly mid-project, Alembic migrations, SQLAlchemy models, Pydantic schemas, and API contracts all need updates simultaneously. Stabilizing the schema and locking the `segment_key` format before any feature work reduces compounding rework.

### Why This Phase Order Is the Most Practical

The chosen order is: **architecture decisions → data pipeline → scoring engine (isolated) → matching engine (isolated) → explanation + fairness engine (isolated) → API integration → admin core UI → decision-support UI → student form → integration testing → showcase prep.**

This order is correct because:

- The scoring engine must be validated before the matching engine consumes its output, or you debug two systems simultaneously.
- The explanation engine consumes the factor breakdown object from scoring and the satisfaction data from matching — it must come after both are validated.
- The API is glue; it should be thin and built after the services it orchestrates are stable.
- The decision-support UI layer (fairness, at-risk review, manual checker) is treated as a coherent operational phase rather than "more UI," because it depends on explanation and fairness outputs being correct.
- The student form is simple and built after the API exists, so shared components from the admin UI can be reused.

---

## Section 2: High-Level Roadmap

| Phase | Name                              | Core Focus                                                                    | Gate to Next Phase                                                      |
| ----- | --------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 0     | Inception & Setup                 | Repo structure, dev environment, schema finalization, locked decisions        | Schema locked; both servers run; all Phase 0 decisions documented       |
| 1     | Data Foundation                   | Models, ingestion pipeline, form intake, segment status, student form         | Sample data ingested, segment statuses correct, form submits            |
| 2     | Scoring Engine                    | All factor encodings, pair score formula, factor breakdown object, unit tests | Scoring validated against manually computed cases                       |
| 3     | Matching Engine                   | 2-bed matching, 3/4-bed heuristic, swap pass, satisfaction labels             | All room sizes matched correctly; invariants hold on synthetic segments |
| 4     | Explanation + Fairness Engine     | Factor classification, NL generation, fairness distribution, backend harness  | Explanations correct; privacy tested; harness validates full output     |
| 5     | Backend API                       | All FastAPI endpoints, Pydantic schemas, orchestration, integration           | Full workflow runnable via HTTP                                         |
| 6     | Admin Frontend — Core             | Navigation shell, upload flows, matching run trigger and status               | Admin can complete the primary workflow in the browser                  |
| 7     | Admin Frontend — Decision Support | Fairness view, detail panels, at-risk review, manual checker                  | All spec-defined UI sections complete and trustworthy                   |
| 8     | Integration, Testing & Demo Data  | Playwright E2E, realistic demo data, end-to-end validation                    | Full run works with demo data; all tests pass                           |
| 9     | Polish & Showcase Prep            | README, docs, showcase mode (Option 2), repo cleanup                          | One-command run; GitHub-ready                                           |

---

## Section 3: Detailed Phase Plan

---

### Phase 0 — Inception & Setup

**Objective:** Make all decisions that are expensive to reverse later, and get both development servers running. No business logic yet.

**Why it belongs here:** Every later phase depends on a clean environment, agreed-upon boundaries, locked schema, and resolved design decisions. Deferring these creates compounding rework.

**Key goals:**

- Lock all decisions that are preconditions for implementation (see Decision Points below)
- Set up the repository with the finalized structure
- Get both servers running with a health check endpoint
- Configure Alembic, pytest, and Vitest
- Document the architecture and service boundary decisions before writing any feature code

**Decisions that must be locked in this phase — no exceptions:**

1. **Missing preferences policy.** Recommended decision: substitute neutral midpoint values for all missing factors and mark the student with `has_preferences = False`. This keeps them in matching rather than creating unassigned residuals. Surface the flag prominently in the segment risk status and UI. Do not silently smooth it over — treat a segment where more than 20% of students lack preferences as ⚠️ Risk.
2. **`segment_key` format.** Pick one format (e.g., `M_1st_year_AC_2`) and treat it as immutable. It is used as a join key across the entire system. Any mid-project change breaks migrations, associations, and stored results.
3. **Matching run versioning.** Results must be tied to a `matching_run` entity with a unique run ID, created timestamp, and status. Re-running matching must not destroy previous results. This must be in the schema from day one.
4. **Matching logic lives outside the API.** All scoring, matching, and explanation logic must be pure Python services testable without FastAPI or SQLAlchemy. API handlers orchestrate; they do not contain business logic.
5. **One React app with route separation.** Student form at `/form`, all admin routes under `/admin/*`. No separate frontend build.
6. **Column mapping in v1.** To keep v1 tractable, require the master students CSV to use exact system column names. Column mapping UI can be added in a later pass.

**Major workstreams:**

- Repo init: monorepo root with `frontend/`, `backend/`, `data/`, `demo-data/`, `docs/` directories
- Backend bootstrap: FastAPI app with `/health`, SQLAlchemy engine → `data/app.db`, Alembic initialized
- Frontend bootstrap: Vite + React + TS, Tailwind and shadcn/ui configured, React Router with placeholder routes for all 6 admin sections and `/form`
- Schema design: draw out all tables (Student, Segment, Room, FormResponse, PreferenceProfile, MatchingRun, RoomAssignment, PairScore) with all columns, types, relationships, and nullable fields — on paper or a diagram — before writing any model code
- `docs/architecture.md`: service boundaries, folder responsibilities, where business logic is and isn't allowed, how matching results are versioned

**Expected deliverables:**

- Running backend at `localhost:8000/health`
- Running frontend at `localhost:5173` with navigation shell
- First Alembic migration creating all tables
- pytest and Vitest configured and passing trivial tests
- `docs/architecture.md` with service boundary decisions
- All Phase 0 decisions documented and not subject to future debate

**What must be validated before moving ahead:**

- Fresh clone boots both servers without manual setup
- Alembic runs migrations forward and backward cleanly
- All Phase 0 decisions are written down and agreed upon

**Done looks like:** Two running servers, complete database schema, locked conventions, no major structural ambiguity remaining.

---

### Phase 1 — Data Foundation

**Objective:** Build the full data ingestion pipeline — master student CSV upload, room file upload, form response submission, validation, deduplication — and verify the system correctly derives segment keys, detects segment states, and stores validated preference profiles ready for scoring.

**Why it belongs here:** Every subsequent phase consumes clean, validated, queryable student and preference data. Getting this layer wrong poisons everything downstream.

**Key goals:**

- Implement all SQLAlchemy models: `Student`, `Segment`, `Room`, `FormResponse`, `PreferenceProfile`, `MatchingRun`, `RoomAssignment`, `PairScore`
- Write the master student CSV ingestion service: parse, validate required columns, detect duplicates, derive `segment_key`, detect invalid field values, persist
- Write the room file ingestion service: parse, validate capacity vs room size, link rooms to segments. Auto-generate room IDs at matching time (not ingestion time) if no room file is provided
- Write the form response ingestion service: validate admission number exists in master, validate DOB match, deduplicate by keeping latest valid timestamp, derive and persist the `PreferenceProfile` with **both raw option values and pre-encoded numeric values** so the scoring engine reads encoded values directly without re-parsing
- Implement segment status computation: ✅ Ready / ❌ Impossible / ⚠️ Risk (applying the 20% missing-preferences threshold decided in Phase 0)
- Build the student-facing form page at `/form`: identity step (admission number + DOB), all 12 questions with exact option text from spec, client-side validation, submission handling, success and error states, mobile-responsive layout
- Write comprehensive tests for all ingestion and validation logic

**Major workstreams:**

- `backend/app/models/` — all SQLAlchemy model classes
- `backend/app/services/ingestion/` — CSV parsing services for students and rooms
- `backend/app/services/segments/` — segment key derivation, status computation
- `backend/app/api/` — minimal endpoints needed for form submission and CSV upload (to be fully fleshed out in Phase 5, but the form submit endpoint and upload endpoints need to exist now to allow testing)
- `frontend/src/pages/form/` — student form page
- `backend/tests/` — unit tests for ingestion, validation, segment logic
- `demo-data/` — small, realistic sample CSVs (30–50 students, 3–4 diverse segments covering different genders, year groups, and room sizes) including intentionally bad rows for validation testing

**Expected deliverables:**

- All models created and migrated
- CSV ingestion services working and tested
- Segment status logic working
- Student form functional and tested
- Error report generation for invalid rows
- Sample data loadable via a seed script

**Important risks and decision points:**

- The `PreferenceProfile` model should store both raw and encoded values. Storing only raw means re-parsing option strings in the scoring engine; storing only encoded loses the audit trail. Store both.
- Auto-generated room IDs must be deterministic: same input always produces the same room IDs. This matters for reproducibility — if re-running matching produces different room IDs, results can't be meaningfully compared.
- DOB validation must be strict but demo-friendly: use ISO format (`YYYY-MM-DD`) and validate strictly, but provide a clear error message so test data failures are easy to diagnose.

**What must be validated before moving ahead:**

- Load sample CSV; verify all students appear with correct segment assignments
- Deliberately introduce bad rows and verify validation catches all of them
- Submit a form response for a known student; verify it appears in the DB as valid
- Submit with wrong DOB; verify rejection
- Submit twice; verify only the latest response is used
- Verify segment statuses compute correctly (Ready, Impossible, Risk)

**Done looks like:** A fully populated local database from sample data, with correct segments, validated form responses, pre-encoded preference profiles, and a student form that works end-to-end.

---

### Phase 2 — Scoring Engine

**Objective:** Implement the complete pair compatibility scoring pipeline — all ten factor encodings, the three encoding patterns, the weighted formula — and have it emit a rich **factor breakdown object** alongside every final pair score. Validate with comprehensive unit tests against manually computed expected values.

**Why it belongs here:** The matching engine is a direct consumer of pair scores and the explanation engine consumes factor breakdowns. Isolating scoring first means any bug is caught here, not after two more layers of complexity are built on top of it.

**Key goals:**

- Implement encoding functions for all 10 factors
- Implement the three scoring patterns:
  - **Distance-based** (Q1, Q2, Q3, Q9): use their specific lookup tables from the spec — do not generalize into linear interpolation
  - **Habit+comfort directional mismatch** (Q4a/Q4b, Q5a/Q5b): implement `mismatch(A→B) = max(0, hA_norm - cB_norm)` correctly. This is directional — test both directions explicitly. The symmetric axis score is `(mismatch(A→B) + mismatch(B→A)) / 2`
  - **Pairwise matrix** (Q6, Q7, Q8): implement separate lookup matrices for smoking vs diet/alcohol. Smoking uses `(2,3)→0.5`; diet and alcohol use `(2,3)→0.7`. Do not share a single matrix
- Implement Q10 lifestyle tolerance: symmetric absolute difference on normalized values
- Implement the weighted pair score formula and normalization to `[0,1]`
- Implement the **factor breakdown object**: for every pair, emit the individual factor score alongside the final score. Structure: `{factor_name: float, ...}` alongside `pair_score: float`. This object is the input to the explanation engine and the fairness label logic — emitting it here is the single most important architectural decision in this phase
- Implement the missing preferences handling from Phase 0 (neutral midpoint substitution + renormalized weights when a factor is missing)
- Write comprehensive unit tests:
  - Test every lookup table entry explicitly — all entries, not just the easy ones
  - Test directional mismatch: `habit > comfort` should penalize; `habit ≤ comfort` should not
  - Test that `mismatch(A→B) ≠ mismatch(B→A)` for an asymmetric case
  - Test smoking matrix asymmetry: `(1,3)→0.0`, `(2,3)→0.5` — separately from diet's `(2,3)→0.7`
  - Test the Excellent label safety rule: a pair that scores `≥0.90` but has one heavy-factor score of `0.0` must be labeled Good, not Excellent
  - Test at least 5 complete hand-computed student pairs from scratch

**Major workstreams:**

- `backend/app/services/scoring/` — factor encoders, scoring functions, pair score + breakdown computation
- `backend/tests/scoring/` — full unit test coverage

**Expected deliverables:**

- `compute_pair_score(profile_a, profile_b) -> PairResult` where `PairResult` contains both `pair_score: float` and `factor_breakdown: dict`
- A utility function to compute all pair scores and breakdowns for a segment and return a score matrix (needed by the matching engine)
- Test file showing expected vs computed outputs for at least 5 hand-crafted pairs
- The Excellent safety rule implemented in the label function here, not deferred to later

**Important risks and decision points:**

- The directional mismatch is the most error-prone part of the entire system. Get it wrong and "quiet person paired with someone very uncomfortable with noise" looks identical to the reverse. Write asymmetric test cases explicitly.
- Do not parameterize weights or thresholds as configurable variables. Hard-code them. They are defined by the spec for a reason; making them configurable adds complexity and risks inconsistency.
- The factor breakdown object's field names must be stable — the explanation engine will reference them by name. Lock the naming here.

**What must be validated before moving ahead:**

- All unit tests pass
- Identical preference profiles produce scores at or near `1.0`
- Deliberately mismatched pairs (strict-smoke-free vs smoker, early sleeper vs very-late sleeper) produce low scores
- The Excellent safety rule test passes
- Smoking and diet/alcohol matrices produce different outputs for the same input tuple

**Done looks like:** A clean, fully tested scoring service. Zero known bugs. All spec-defined lookup values covered. Factor breakdown emitted on every computation.

---

### Phase 3 — Matching Engine

**Objective:** Build the full matching pipeline — 2-bed maximum-weight matching, 3- and 4-bed pair-first greedy heuristic, local swap improvements, group score and per-student satisfaction computation — and validate it on synthetic segments covering all room sizes and edge cases.

**Why it belongs here:** Matching consumes pair scores from Phase 2. Isolating it means if something is wrong, the problem is in matching logic, not in scoring. The matching engine must be provably correct before the API wires it to anything.

**Key goals:**

- Build the graph construction utility: given a score matrix, construct a weighted NetworkX graph
- Implement 2-bed matching using `networkx.max_weight_matching(graph, maxcardinality=True)`. Note: the output is a set of frozensets; map it carefully back to student IDs before building room assignments
- Implement the 3-bed heuristic — **behind a clean service interface so the algorithm can be tested and swapped without touching the API**:
  - Run max-weight matching to get initial pairs (building blocks)
  - Handle the leftover-student case: when student count doesn't divide evenly into pairs, treat remaining students as solo units
  - For each pair (or solo), compute the best available third student by average pair score with all current members
  - Process pairs in order of fewest good third options first (fairness-aware ordering)
  - Assign best available third student; no student assigned twice
- Implement the 4-bed heuristic — behind the same interface:
  - v1 default: merge compatible pairs approach (form pairs via max-weight matching, then select pair merges that maximize average within-room score across all 6 pair combinations)
  - The interface abstraction means this can be upgraded to the grow-triplets approach or OR-Tools later without changing the API layer
- Implement the local swap improvement pass:
  - Compute `Satisfaction(i)` for each student (average pair score with roommates)
  - Identify at-risk students (satisfaction < 0.55)
  - Attempt all pairwise cross-room student swaps
  - Apply swap if minimum satisfaction improves and no new Poor outcomes are created
  - Iterate until no beneficial swaps remain or maximum iteration count is reached (cap at 3 passes to prevent runaway on large segments)
- Compute group score (average of all within-room pair scores) and per-student satisfaction
- Apply satisfaction labels (Excellent/Good/Okay/Poor) using spec thresholds, including the two-condition Excellent rule
- Flag at-risk students
- Ensure deterministic output: same input always produces the same assignment (tie-breaking must be explicit, not reliant on hash ordering)

**Major workstreams:**

- `backend/app/services/matching/` — graph builder, 2-bed matcher, group matcher (behind interface), swap optimizer, satisfaction computer
- `backend/tests/matching/` — synthetic segment test suite

**Expected deliverables:**

- `run_matching_for_segment(segment_data) -> MatchingResult` — pure function, no DB dependency, testable with fixtures
- All room sizes handled
- Local swap pass implemented with iteration cap
- Satisfaction labels and at-risk flags computed
- Test suite covering: all room sizes, odd/leftover student counts, segments with uniformly poor preferences, determinism check (same input → same output)

**Important risks and decision points:**

- **Leftover students in the 3-bed heuristic.** If a segment has 7 students in 3-bed rooms, pair formation leaves one unpaired student. The heuristic must handle this gracefully as a "solo unit" rather than crashing or producing an incorrect assignment.
- **NetworkX output mapping.** `max_weight_matching` returns `{frozenset({a, b}), frozenset({c, d}), ...}`. Write a dedicated utility to map these back to (student_id_1, student_id_2) tuples before any further processing. Do not scatter this conversion across the codebase.
- **Swap pass correctness.** The pass must never make a previously-Good student Poor while trying to fix a Poor student. Test this explicitly with a constructed adversarial case.
- **Reproducibility.** Sort student lists before processing. Use explicit tie-breaking rules. A matching that changes on every run is unusable.

**What must be validated before moving ahead:**

- All room sizes produce valid assignments: every student in exactly one room, no room over or under capacity
- No student is duplicated or dropped across any test case
- Satisfaction labels match spec thresholds including the Excellent safety rule
- Leftover-student edge case handled without errors
- The swap pass demonstrably improves at-risk cases in at least one test
- A synthetic segment of 50 students in 2-bed rooms completes in under 2 seconds

**Done looks like:** A matching service that takes segment data and pair scores, produces complete room assignments with satisfaction labels, handles all edge cases, and is deterministic.

---

### Phase 4 — Explanation + Fairness Engine

**Objective:** Build the explanation pipeline and the fairness computation layer. These are grouped together because both consume the same factor breakdown objects from Phase 2 and the same satisfaction data from Phase 3. Also build the backend evaluation harness here — a standalone script that runs the full core pipeline on sample data and prints inspectable output, independent of the API.

**Why it belongs here:** Explanations and fairness both depend on correct scoring and matching. Building them together here, in isolation from the API, means the complete core output can be validated before any UI is built on top of it. The evaluation harness is the most practical debugging tool during this phase.

**Key goals:**

- Implement factor classification: given a factor score and factor type, classify into Strong Match / Moderate Match / Neutral / Moderate Mismatch / Strong Mismatch. Thresholds may differ by factor weight — heavier factors warrant different cutoffs than lighter ones
- Implement reason selection logic:
  - For Excellent/Good: pick 2–3 strongest positive factors
  - For Okay/Poor: pick 1–2 positive factors plus 1–2 mismatch factors
- Implement the text generation layer (template-based, not AI-generated):
  - Non-sensitive factors: specific phrasing ("Same sleep schedule — both sleep between 11 PM and 1 AM")
  - Sensitive factors (Q6 smoking, Q7 alcohol, Q8 diet): generic, privacy-safe phrasing only ("Similar lifestyle habits" / "Differences in lifestyle preferences — may need adjustment"). The raw preference value must never appear in explanation output
  - Avoid blaming language. "Different cleanliness expectations — may need a conversation" not "one of you is messy"
- For rooms with 3+ students: aggregate factor scores across all pairs involving the student, then classify. Do not explain against a single roommate
- Ensure explanations for two students in the same room are non-contradictory
- Implement fairness computation: satisfaction distribution by label (Excellent/Good/Okay/Poor) for the whole run and per segment
- Implement the **backend evaluation harness**: a standalone Python script (`backend/scripts/evaluate.py` or similar) that loads sample data directly (no HTTP, no DB), runs scoring → matching → explanation → fairness, and prints a readable summary. This is the primary debugging tool for the algorithmic core. Use it throughout this phase and Phase 3 to inspect outputs

**Major workstreams:**

- `backend/app/services/explainability/` — factor classifier, reason selector, text generator
- `backend/app/services/fairness/` — satisfaction distribution, at-risk lists
- `backend/scripts/evaluate.py` — standalone evaluation harness
- `backend/tests/explainability/` and `backend/tests/fairness/` — test suites

**Expected deliverables:**

- `generate_explanation(student_id, room_assignment, factor_breakdowns) -> List[str]` — 2–3 reasons
- `compute_fairness_distribution(satisfaction_scores) -> FairnessReport`
- A complete, inspectable output from the evaluation harness on the sample data from Phase 1
- Tests covering all four satisfaction label paths
- Privacy tests: no explanation output contains the words "smoker," "drinker," "non-veg," or any direct preference label

**Important risks and decision points:**

- The Manual Checker (built in Phase 7 of the UI) **must reuse this exact explanation service** — not a fork, not an approximation. Design the interface with this reuse in mind now: the function should accept any arbitrary group of students, not just an already-assigned room.
- For 3+ person rooms, aggregation must use the student's average relationship with the room, not just with one roommate. Make this aggregation explicit in the function signature.
- Contradictory explanations within a room (e.g., student A says "both prefer quiet rooms," student B gets "differences in night activity") are a real risk. Add a test that loads a whole room's explanations and checks them for internal consistency.

**What must be validated before moving ahead:**

- Evaluation harness runs on sample data and produces readable, inspectable output
- Explanation tests for all four satisfaction label paths pass
- Privacy test: no sensitive preference value appears in any explanation string
- Explanations within a room are non-contradictory
- Fairness distribution counts match manually computed expectations on the sample data

**Done looks like:** The complete algorithmic core is proven. Given any segment's normalized data, the system produces explainable assignments with satisfaction labels, fairness distributions, and privacy-safe per-student explanations — all validated and inspectable without touching the API or UI.

---

### Phase 5 — Backend API

**Objective:** Build all FastAPI endpoints that orchestrate the services from Phases 1–4, expose them over HTTP, and validate all request/response contracts with Pydantic. This is thin glue — almost no logic lives here.

**Why it belongs here:** The API is built after all services are validated so the API layer stays thin and contracts are designed around stable service outputs rather than aspirational ones.

**Key goals:**

Build all endpoints:

| Method | Path                                                          | Purpose                                                                      |
| ------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `POST` | `/api/students/upload`                                        | Ingest master students CSV; return validation summary                        |
| `POST` | `/api/rooms/upload`                                           | Ingest rooms CSV; return validation summary                                  |
| `GET`  | `/api/segments`                                               | List all segments with status (Ready/Impossible/Risk)                        |
| `GET`  | `/api/segments/{segment_key}/students`                        | List students in a segment with preference status                            |
| `POST` | `/api/form/submit`                                            | Student submits preferences; validate and store                              |
| `GET`  | `/api/form/status`                                            | Submission stats (total students, valid responses, %)                        |
| `GET`  | `/api/form/non-submitters`                                    | List of students who haven't submitted                                       |
| `POST` | `/api/matching/run`                                           | Trigger matching for one segment or all ready segments                       |
| `GET`  | `/api/matching/runs`                                          | List matching runs with status and summary                                   |
| `GET`  | `/api/matching/runs/{run_id}/segments/{segment_key}/rooms`    | Room view for a segment's results                                            |
| `GET`  | `/api/matching/runs/{run_id}/segments/{segment_key}/students` | Student view with satisfaction and explanations                              |
| `GET`  | `/api/fairness/{run_id}`                                      | Satisfaction distribution for whole run and per segment                      |
| `POST` | `/api/checker/compatibility`                                  | Manual checker: compute group compatibility for an arbitrary set of students |
| `GET`  | `/api/exports/assignments/{run_id}`                           | Download CSV of room assignments                                             |
| `GET`  | `/api/dashboard`                                              | Aggregate stats: setup checklist, key numbers                                |

Define all Pydantic request/response schemas. Apply a consistent error response format. Ensure run artifacts are persisted so results are reviewable after the fact.

**Major workstreams:**

- `backend/app/api/` — router files organized by domain (students, segments, form, matching, fairness, checker, exports)
- `backend/app/schemas/` — all Pydantic models
- `backend/tests/api/` — integration tests using FastAPI's `TestClient`

**Expected deliverables:**

- All endpoints operational and returning correct responses
- Integration tests for all happy-path flows
- Integration tests for key error flows (invalid CSV, segment not ready, etc.)
- CORS configured for `localhost:5173`

**Important risks and decision points:**

- **Matching run performance.** For v1 local usage with realistic data sizes, synchronous execution in `POST /api/matching/run` is acceptable. Measure actual timing with sample data in Phase 9. Do not implement async background tasks prematurely — add them only if Phase 9 testing reveals a genuine UX problem.
- **Run persistence.** Matching run artifacts (assignments, pair scores, explanations, fairness data) must be persisted to the DB so the frontend can retrieve results without re-running matching. Do not recompute on every page load.
- **Manual Checker endpoint.** The `POST /api/checker/compatibility` handler must call the same explanation service built in Phase 4. It computes compatibility for a hypothetical group — the service interface designed for this purpose in Phase 4 is what makes this clean.
- **File uploads.** Use `multipart/form-data` for CSV uploads, not JSON. Confirm this is correctly wired in FastAPI.
- **Export streaming.** Stream the CSV response rather than loading the full dataset into memory; use FastAPI's `StreamingResponse` with a generator.

**What must be validated before moving ahead:**

- Full matching workflow triggered, completed, and results retrieved via HTTP without touching the database directly
- Invalid uploads return structured error responses with field-level detail
- Manual checker returns results consistent with the matching engine
- All endpoints tested with FastAPI `TestClient`

**Done looks like:** A complete, tested API layer. The full workflow — upload data, submit preferences, run matching, retrieve results, download export — is runnable via HTTP

**Objective:** Build the navigation shell, upload flows, the Form & Collection view, and the Matching Runs trigger-and-status view. By the end of this phase, an admin can complete the primary workflow entirely in the browser.

**Why it belongs here:** Frontend is built after the API is stable to avoid building UI against moving contracts. The primary workflow (upload → match → view) is built first because it validates the full integration path before the more complex decision-support views are added.

**Key goals:**

- Build the left-sidebar navigation shell with routing for all 6 sections
- Build the **Dashboard** page: setup checklist, key stats, primary action buttons
- Build the **Students & Data** section:
  - CSV file upload for master students (drag-and-drop or file selector)
  - Preview table for the first 10 rows
  - Validation result display (missing fields, duplicates, invalid values)
  - Error report download button
  - Room file upload (similar flow, simpler)
  - Form response validation summary (total, valid, invalid counts)
- Build the **Form & Collection** section:
  - Display the student form link
  - Submission statistics (total, valid, %, list of non-submitters with export)
  - Read-only questionnaire preview
- Build the **Matching Runs** section:
  - Segment list table with status badges (Ready / Impossible / Risk)
  - "Run matching" button per segment and "Run all ready segments" button
  - Loading/progress state while matching runs
  - After run: segment table updates with results and average match quality

**Major workstreams:**

- `frontend/src/pages/` — page components for Dashboard, Students & Data, Form & Collection, Matching Runs
- `frontend/src/components/` — shared components: file upload, data table, status badge, stat card
- `frontend/src/lib/api/` — TanStack Query hooks for all API endpoints used in this phase
- `frontend/src/routes/` — React Router route definitions

**Expected deliverables:**

- Navigation shell and routing working
- Upload flows functional end-to-end
- Form collection stats displayed and accurate
- Matching can be triggered and segment statuses update after run

**Important risks and decision points:**

- Use TanStack Query for all server state. Do not maintain server-derived data in local component state.
- Use shadcn/ui components as the base. Do not build primitive UI components from scratch.
- The upload flow must handle the case where a second upload replaces the first. Confirm the API and UI agree on this behavior before building the UI.
- Keep frontend TypeScript types derived from or consistent with Pydantic response schemas. Do not let types drift between layers.

**What must be validated before moving ahead:**

- Load sample data through the upload UI; verify it appears correctly (segment list, student counts)
- Trigger a matching run via the UI; verify segment statuses update
- The full primary workflow is completable without touching the command line

**Done looks like:** An admin can open the browser, upload data, see form stats, and trigger matching — without any developer intervention.

---

### Phase 7 — Admin Frontend: Decision-Support Layer

**Objective:** Complete the operational side of the admin interface: detailed matching results (room view and student view), the fairness/reports section, and the manual compatibility checker. This phase turns the app from a batch runner into a tool admins can actually trust and act on.

**Why it belongs here:** These views are read-heavy and depend on matching results from Phase 6. More importantly, they form a coherent decision-support layer — fairness surfacing, at-risk review, and mid-semester exception handling all belong together conceptually, not scattered across "more UI" construction.

**Key goals:**

- Build **Matching Results — Room View**:
  - Table of rooms with student mini-scores and group score
  - Status badge per room (Healthy / Needs Review)
  - Click-on-student side panel with factor-wise score breakdown
  - "Show only ⚠️ Needs Review rooms" filter
  - Download assignments CSV
- Build **Matching Results — Student View**:
  - Student table with satisfaction score, status badge, and top 2–3 explanation reasons
  - "Filter: At Risk only" shortcut
  - Row click → detail panel with per-factor scores, classification labels, and full explanations
- Build **Reports & Fairness**:
  - Satisfaction distribution (Excellent/Good/Okay/Poor counts) for whole run and per segment
  - Bar or donut chart visualizing distribution
  - Clicking a count (e.g., "30 Poor") navigates to Student View pre-filtered to those students
- Build the **Manual Checker**:
  - Left panel: multi-select existing students + single select candidate student
  - "Run compatibility report" button
  - Right panel: group compatibility score + label + factor reasons with ✅/⚠️ indicators
  - Make clear in the UI that this tool does not update assignments — it informs human decisions
- Handle all view states cleanly: empty (no run yet), loading, error
- Ensure sensitive factors never appear with raw preference values in any detail panel

**Major workstreams:**

- `frontend/src/pages/matching/` — room view and student view sub-pages
- `frontend/src/pages/reports/` — fairness section
- `frontend/src/pages/checker/` — manual checker
- `frontend/src/components/panels/` — detail side panels (shared between student view and room view)

**Expected deliverables:**

- All 6 navigation sections fully built and working
- Filters, click-through navigation, and detail panels functional
- Manual checker operational and producing results consistent with matching engine
- Sensitive factors never display raw preference values anywhere in the UI

**What must be validated before moving ahead:**

- Load a full matching run with realistic data; verify room view and student view render correctly
- At-risk filter shows exactly the correct students
- Click a student in the fairness view → lands in Student View filtered correctly
- Manual checker output matches what the evaluation harness would produce for the same group
- Privacy check: review every panel with a student who has smoking/diet/alcohol mismatches and verify no raw preference values appear

**Done looks like:** A complete, trustworthy admin interface. Every spec-defined UI section is present, functional, and handles edge cases and empty states.

---

### Phase 8 — Integration, Testing & Demo Data

**Objective:** Validate the complete end-to-end system with realistic data, run Playwright E2E tests across the primary admin workflow, and build the demo data set that will ship with the repository.

**Why it belongs here:** Integration testing is only meaningful after all components are complete. This phase finds problems that only emerge when real-sized, varied data flows through the full stack.

**Key goals:**

- Create the demo data set in `demo-data/`:
  - `master_students.csv`: ~80–100 students across 3–4 diverse segments (different genders, year groups, room sizes)
  - `rooms.csv`: corresponding room definitions
  - Preference data with intentional variety: some well-aligned pairs, some clear poor matches, at least a few at-risk students — because a demo where everyone is "Excellent" is not useful
  - A `seed.py` script that loads all demo data in one command and produces a ready-to-explore database state
- Write Playwright E2E tests covering:
  - Upload master students CSV → segment list appears correctly
  - Submit a form response as a student → count updates in admin
  - Trigger matching for a segment → room and student views populate
  - Filter to at-risk students → only at-risk rows visible
  - Open a student detail panel → explanations and factor breakdown visible
  - Manual checker with known inputs → output matches expected
  - Export CSV downloads and contains all assigned students
- Run the full pipeline end-to-end with demo data and verify:
  - All segments complete without errors
  - Results include a realistic spread: some Excellent, some Poor, visible at-risk cases
  - Explanations generate for all students
  - Export CSV is correctly formatted

**Expected deliverables:**

- `demo-data/` directory with CSVs and seed script
- Playwright test suite passing on the full workflow
- All bugs found during integration testing fixed

**What must be validated before moving ahead:**

- Full matching run with demo data completes without errors
- All Playwright tests pass
- At-risk students in the demo data are correctly flagged and visible in the UI
- Export CSV opens correctly in a spreadsheet tool

**Done looks like:** A completely working, tested system with realistic data. Feature-complete and demonstrably correct.

---

### Phase 9 — Polish & Showcase Prep

**Objective:** Transform the development-mode app into the final local showcase form (Option 2: FastAPI serves the built frontend). Write documentation. Clean the repository for GitHub presentation.

**Why it belongs here:** This is the final delivery phase. Everything must be working before showcase prep begins.

**Key goals:**

- Build the React frontend: `npm run build` inside `frontend/` → static files in `frontend/dist/`
- Configure FastAPI to serve the built frontend:
  - Mount `frontend/dist/` as a `StaticFiles` directory
  - Serve `index.html` as the fallback for any non-API route so React Router works
- Verify the app runs correctly in Option 2 mode (one server, one command)
- Write a `start.sh` (and `start.bat` for Windows) to start the app in one command
- Write the README:
  - Project overview and what problem it solves
  - How to run in development mode (two servers)
  - How to run in showcase mode (one command)
  - How demo data works and how to seed it
  - Tech stack summary with rationale
  - Screenshots of key views (Dashboard, Matching Results, Student View, Fairness, Manual Checker)
  - Known limitations and future roadmap
- Write `docs/algorithm.md`: brief explanation of the scoring factors, weights, matching approach, and fairness logic — not a full spec restatement, but enough for a reviewer to understand the system's intelligence
- Final repo cleanup:
  - No stale branches, debug prints, or commented-out code
  - `.gitignore` covers `app.db`, `uploads/`, `exports/`, `__pycache__`, `node_modules/`, `dist/`, `.env`
  - No real student data in the repository — demo data only
  - Path handling for `data/` and `demo-data/` is portable (no hard-coded absolute paths)
  - Static frontend serving paths tested: confirm React Router routes load correctly when accessed directly in showcase mode

**What must be validated before moving ahead:**

- Clone the repo into a completely fresh directory; follow the README exactly; confirm the app works with zero additional steps
- Seed demo data; run matching; download an export — all from the browser only
- The repository reads like a finished product, not a work in progress

**Done looks like:** A GitHub-ready repository where a recruiter can clone it, run one command, open a browser, and see a fully working roommate matching system with realistic demo data and no cloud dependency.

---

## Section 4: Iteration Logic

### Where iteration is expected

**Scoring engine (Phase 2) → revisit after Phase 8.**
After running with realistic demo data, inspect the score distribution. If most pairs cluster between 0.60 and 0.75 with little spread, or if the label buckets are skewed (too many Poor or almost nobody Poor), the lookup table values for distance-based factors may need minor calibration. The spec's values are authoritative starting points but are validated empirically, not arbitrary.

**Matching heuristic for 3/4-bed rooms (Phase 3) → revisit after Phase 8.**
The greedy heuristic will likely need one revision after integration testing. The most common problems: leftover students producing unbalanced final rooms, or the swap pass not improving fairness as expected because no beneficial swaps exist. Budget one revision pass after Phase 8 integration.

**Explanation phrasing (Phase 4) → revisit after Phase 7.**
Explanation wording will feel generic or awkward in some cases when seen in the UI. After the student view is built and explanations are visible in context, plan a single revision pass on the templates. The factor classification logic should remain stable; only the human phrasing changes.

**Admin workflow details → one refinement after Phase 7.**
After building the full UI, expect to refine: which status columns deserve the most visual prominence, whether room view or student view should be the primary entry point after a run, and whether any filter is missing or redundant. This is normal product iteration, not a planning failure.

### What should remain stable early (do not change mid-build)

- `segment_key` format — locked in Phase 0, immutable forever
- Factor weights and scoring lookup tables — treat as spec-defined constants
- Database schema — designed completely before writing model code
- Service boundary decisions — matching logic stays outside the API layer
- Factor breakdown object field names — locked in Phase 2, referenced by name in explanation engine
- Development mode first, showcase mode last

---

## Section 5: Scope Discipline

### Core v1 must-have

- Local-first React + FastAPI + SQLite application, no deployment
- Repo structure, migrations, local defaults, minimal `.env` requirement
- Master student CSV import with validation
- Optional rooms CSV with auto-generation fallback
- Student form with all 12 questions, admission number + DOB validation, latest-wins deduplication
- Segment generation with Ready / Impossible / Risk status logic
- Exact preference encoding and weighted pair scoring per spec, with factor breakdown objects
- 2-person room matching (Edmonds' blossom via NetworkX)
- 3-person room matching (pair-first heuristic)
- 4-person room matching (compatible-pair merge)
- Local swap fairness improvement pass
- Group score and per-student satisfaction with Excellent/Good/Okay/Poor labels including safety rule
- Admin dashboard with all 6 sections fully functional
- Per-student plain-English explanations (2–3 reasons), privacy-safe
- Fairness distribution view with click-through to at-risk students
- Manual compatibility checker (reusing the explanation service)
- CSV export of room assignments
- Backend evaluation harness for algorithm inspection
- Demo data with seed script
- Final local showcase mode (Option 2)
- README and `docs/algorithm.md`

### Important but later (after v1 is complete)

- Column mapping UI for CSV upload (v1 requires exact column names)
- PDF full report export
- Richer import error-report UX
- Run history comparison view
- More advanced chart visualizations in the fairness view
- Async background tasks for matching runs (only add if Phase 8 reveals a genuine performance issue)

### Nice-to-have / future refinement

- OR-Tools-based optimization for large segments
- Envy-freeness and Gini coefficient fairness metrics
- Admin-adjustable weight profiles
- Student-facing match explanation dashboard
- Feedback-driven weight tuning after semester data collection
- Language preference factor
- Authentication / admin roles
- Any cloud-backed or deployed version

---

## Section 6: Final Execution Summary

The project moves through five conceptual stages:

**Stage 1 — Stable ground (Phases 0–1)**
Lock every decision that is expensive to reverse: the missing preferences policy, the `segment_key` format, the database schema, the matching run versioning model, the service boundary rules. Get both servers running. Ingest sample data. Build the student form. Verify the foundation before building anything on top of it.

**Stage 2 — Core logic in isolation (Phases 2–4)**
Build and test the three engines in isolation, in order, with explicit test gates between them. Scoring first, with the factor breakdown object as a first-class output. Matching second, behind a clean interface, with the leftover-student and reproducibility edge cases explicitly handled. Explanation and fairness third, consuming the breakdown object and satisfaction data, validated by a standalone evaluation harness that never touches the API. Do not skip this isolation phase to save time — a bug here silently corrupts every layer above it.

**Stage 3 — Integration via the API (Phase 5)**
Wire all services through the FastAPI layer. The API is thin glue: it orchestrates, persists run artifacts, and exposes contracts. It contains no business logic. The Manual Checker endpoint uses the same explanation service as matching — not a fork.

**Stage 4 — Full product build (Phases 6–7)**
Build the admin UI in two passes. Phase 6 covers the primary operational workflow: data upload, matching trigger, basic results. Phase 7 covers the decision-support layer: detailed results, fairness surfacing, at-risk review, manual checker. This split keeps the most complex UI work isolated and builds on a working foundation.

**Stage 5 — Validation and showcase (Phases 8–9)**
Run the complete system end-to-end with realistic demo data. Fix what breaks — especially the 3/4-bed heuristic edge cases and explanation phrasing. Then prepare for GitHub: build the frontend, configure showcase mode, write documentation, clean the repository. The final artifact should be something a recruiter can clone and run in under five minutes with no configuration required.

---

_This plan is designed to be followed progressively, not rigidly. Each phase represents a goal and a validation gate. If a phase uncovers unexpected complexity — particularly in the matching heuristic or scoring correctness — address it before advancing. Building on an uncertain foundation produces compounding rework. The iteration loops in Section 4 are expected parts of the process._
