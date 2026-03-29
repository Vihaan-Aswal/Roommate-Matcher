# Roommate Matcher - Architecture (Phase 0 Locked)

## Purpose

This document locks service boundaries, repository responsibilities, and non-negotiable Phase 0 decisions before implementation of business logic.

## Core Architecture

- Monorepo with separate backend and frontend applications.
- Local-first runtime.
- Backend owns ingestion, scoring, matching, explainability, fairness, and persistence.
- Frontend owns presentation, user flows, and API orchestration for admin and student pages.

## Repository Layout and Responsibilities

- `backend/`
  - `app/api/`: thin FastAPI route handlers only (validate input, call services, return response).
  - `app/services/`: all business logic as pure modules whenever possible.
  - `app/models/`: SQLAlchemy models.
  - `app/schemas/`: Pydantic request/response contracts.
  - `alembic/`: schema migrations.
- `frontend/`
  - `src/pages/`: route-level pages.
  - `src/components/`: reusable UI components.
  - `src/lib/`: API client and shared utilities.
  - `src/hooks/`: query and state hooks.
- `data/`: local SQLite database and generated local artifacts.
- `demo-data/`: non-sensitive demo CSV data and seed assets.
- `docs/`: architecture, schema, and algorithm documentation.

## Service Boundary Rules

- Scoring, matching, explainability, and fairness logic must not live in API route handlers.
- API layer is orchestration only.
- Matching algorithm interfaces must be reusable by both main matching flow and manual checker.
- Explanation generation must be shared between matching outputs and manual checker outputs.

## Locked Phase 0 Decisions

1. Missing preferences policy

- Use neutral midpoint substitution when preferences are missing.
- Persist `has_preferences` flag in profile state.
- Segment risk threshold: treat segments with more than 20% missing preferences as risk.

2. Immutable segment key format

- Format: `{gender}_{year_group}_{ac_type}_{room_size}`.
- Example: `M_1st_year_AC_2`.
- Once set, `segment_key` is immutable.

3. Matching run versioning

- Every run has unique `run_id`, timestamps, and status.
- Results are append-only by run.
- Re-runs never overwrite previous artifacts.

4. Logic placement

- Business logic belongs in `backend/app/services` modules.
- FastAPI handlers remain thin and testable.

5. Frontend topology

- One React application.
- Student route at `/form`.
- Admin routes under `/admin/*`.

6. CSV mapping policy (resolved conflict)

- Conflict source:
  - `docs/project-spec.md` describes a column-mapping UI step.
  - `docs/plan.md` requires exact system column names in v1.
- Resolved v1 policy:
  - Backend ingestion enforces exact system column names in v1.
  - Column-mapping UI is deferred post-v1.
  - Frontend may present guidance/help text now, but no mapping transform is applied in v1.

## Data and Persistence Contracts

- SQLite path defaults to `data/app.db`.
- Schema is defined first in `docs/schema-design.md`, then mirrored in SQLAlchemy models and Alembic migration.
- Core tables: students, segments, rooms, form_responses, preference_profiles, matching_runs, pair_scores, room_assignments.

## Determinism and Reproducibility Contracts

- Matching outputs must be deterministic given identical input.
- Tie-breaking rules are explicit in service logic.
- Auto-generated identifiers must be deterministic for identical inputs.

## Security and Privacy Contracts

- Sensitive lifestyle factors are stored for computation but not exposed as raw values in explanation output.
- Explanations use privacy-safe wording for sensitive factors.
- Raw DOB is used for validation workflow and is not surfaced in admin analytics views.

## Phase 0 Exit Criteria

- Backend health endpoint runs locally.
- Frontend route shell runs locally.
- Alembic initialized with initial schema migration.
- pytest and Vitest smoke tests pass.
- `docs/schema-design.md` and this architecture document are treated as implementation contracts.
