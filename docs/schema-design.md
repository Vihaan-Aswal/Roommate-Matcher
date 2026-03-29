# Roommate Matcher - Phase 0 Schema Design

## Purpose

This document locks the database schema contracts before writing SQLAlchemy model code.

Scope:

- Core Phase 0 tables only
- SQLite first, SQLAlchemy/Alembic managed
- Contracts are forward-compatible with Phase 1-5 services

## Global Conventions

- Naming: snake_case for tables and columns.
- IDs: text IDs where external identity exists (`admission_number`, `segment_key`, `run_id`), integer surrogate IDs where internal identity is enough.
- Time fields: UTC timestamps (`created_at`, `updated_at`) in ISO-compatible datetime columns.
- JSON payloads in SQLite: stored as TEXT containing JSON.
- `segment_key` is immutable once set.

## Locked Decisions Reflected in Schema

1. Missing preferences policy: a student can be matchable with neutral midpoint substitution; profile row must carry `has_preferences`.
2. Matching run versioning: results are append-only per `run_id`; prior runs are never overwritten.
3. Matching logic in services: schema stores artifacts; API does orchestration only.
4. Route split does not affect schema.
5. CSV policy for v1 (hybrid decision): backend requires exact system columns now; UI mapping can be added later without schema changes.

## Entity Relationship Summary

- `students` belongs to one `segments` row via `segment_key`.
- `rooms` belongs to one `segments` row.
- `form_responses` belongs to one `students` row.
- `preference_profiles` belongs to one `students` row and optionally one source `form_responses` row.
- `pair_scores` belongs to one `matching_runs` row and one `segments` row.
- `room_assignments` belongs to one `matching_runs` row and one `segments` row.

## Table Contracts

### 1) segments

Purpose: canonical matching partition definition.

Columns:

- `segment_key` TEXT PRIMARY KEY
- `gender` TEXT NOT NULL
- `year_group` TEXT NOT NULL
- `ac_type` TEXT NOT NULL
- `room_size` INTEGER NOT NULL CHECK (`room_size` IN (2, 3, 4))
- `created_at` DATETIME NOT NULL
- `updated_at` DATETIME NOT NULL

Constraints:

- `segment_key` format lock: `{gender}_{year_group}_{ac_type}_{room_size}`
- unique tuple guard: UNIQUE (`gender`, `year_group`, `ac_type`, `room_size`)

Indexes:

- unique tuple index on (`gender`, `year_group`, `ac_type`, `room_size`)

### 2) students

Purpose: master student identity and static assignment inputs.

Columns:

- `admission_number` TEXT PRIMARY KEY
- `full_name` TEXT NOT NULL
- `gender` TEXT NOT NULL
- `year_group` TEXT NOT NULL
- `ac_type` TEXT NOT NULL
- `room_size` INTEGER NOT NULL CHECK (`room_size` IN (2, 3, 4))
- `dob` DATE NOT NULL
- `segment_key` TEXT NOT NULL REFERENCES `segments`(`segment_key`)
- `created_at` DATETIME NOT NULL
- `updated_at` DATETIME NOT NULL

Constraints:

- `segment_key` in `students` is immutable after insert.

Indexes:

- index on `segment_key`
- index on (`year_group`, `gender`, `ac_type`)

### 3) rooms

Purpose: explicit room inventory by segment.

Columns:

- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `room_id` TEXT NOT NULL
- `segment_key` TEXT NOT NULL REFERENCES `segments`(`segment_key`)
- `capacity` INTEGER NOT NULL CHECK (`capacity` IN (2, 3, 4))
- `source` TEXT NOT NULL DEFAULT 'uploaded' CHECK (`source` IN ('uploaded', 'generated'))
- `created_at` DATETIME NOT NULL
- `updated_at` DATETIME NOT NULL

Constraints:

- UNIQUE (`segment_key`, `room_id`)
- for uploaded rows, capacity must match segment room_size at service layer

Indexes:

- index on `segment_key`

### 4) form_responses

Purpose: raw submissions with validation state; latest valid response is consumed.

Columns:

- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `admission_number` TEXT NOT NULL REFERENCES `students`(`admission_number`)
- `dob` DATE NOT NULL
- `submitted_at` DATETIME NOT NULL
- `validation_status` TEXT NOT NULL CHECK (`validation_status` IN ('valid', 'invalid'))
- `invalid_reason` TEXT NULL
- `q1_raw` TEXT NULL
- `q2_raw` TEXT NULL
- `q3_raw` TEXT NULL
- `q4a_raw` TEXT NULL
- `q4b_raw` TEXT NULL
- `q5a_raw` TEXT NULL
- `q5b_raw` TEXT NULL
- `q6_raw` TEXT NULL
- `q7_raw` TEXT NULL
- `q8_raw` TEXT NULL
- `q9_raw` TEXT NULL
- `q10_raw` TEXT NULL
- `created_at` DATETIME NOT NULL

Indexes:

- index on (`admission_number`, `submitted_at` DESC)
- index on `validation_status`

### 5) preference_profiles

Purpose: normalized preference profile used by scoring; stores both raw and encoded values.

Columns:

- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `admission_number` TEXT NOT NULL REFERENCES `students`(`admission_number`)
- `source_form_response_id` INTEGER NULL REFERENCES `form_responses`(`id`)
- `has_preferences` INTEGER NOT NULL CHECK (`has_preferences` IN (0, 1))
- `is_active` INTEGER NOT NULL CHECK (`is_active` IN (0, 1))
- Raw values:
  - `q1_raw` TEXT NULL
  - `q2_raw` TEXT NULL
  - `q3_raw` TEXT NULL
  - `q4a_raw` TEXT NULL
  - `q4b_raw` TEXT NULL
  - `q5a_raw` TEXT NULL
  - `q5b_raw` TEXT NULL
  - `q6_raw` TEXT NULL
  - `q7_raw` TEXT NULL
  - `q8_raw` TEXT NULL
  - `q9_raw` TEXT NULL
  - `q10_raw` TEXT NULL
- Encoded values:
  - `q1_enc` REAL NULL
  - `q2_enc` REAL NULL
  - `q3_enc` REAL NULL
  - `q4a_enc` REAL NULL
  - `q4b_enc` REAL NULL
  - `q5a_enc` REAL NULL
  - `q5b_enc` REAL NULL
  - `q6_enc` REAL NULL
  - `q7_enc` REAL NULL
  - `q8_enc` REAL NULL
  - `q9_enc` REAL NULL
  - `q10_enc` REAL NULL
- `created_at` DATETIME NOT NULL
- `updated_at` DATETIME NOT NULL

Constraints:

- one active profile per student enforced in service/migration logic

Indexes:

- index on `admission_number`
- index on (`admission_number`, `is_active`)

### 6) matching_runs

Purpose: append-only run metadata for versioned outputs.

Columns:

- `run_id` TEXT PRIMARY KEY
- `scope` TEXT NOT NULL CHECK (`scope` IN ('segment', 'all_ready_segments'))
- `target_segment_key` TEXT NULL REFERENCES `segments`(`segment_key`)
- `status` TEXT NOT NULL CHECK (`status` IN ('pending', 'running', 'completed', 'failed'))
- `error_message` TEXT NULL
- `started_at` DATETIME NULL
- `finished_at` DATETIME NULL
- `created_at` DATETIME NOT NULL

Indexes:

- index on `created_at`
- index on `status`
- index on `target_segment_key`

### 7) pair_scores

Purpose: persisted pair compatibility outputs for a run.

Columns:

- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `run_id` TEXT NOT NULL REFERENCES `matching_runs`(`run_id`)
- `segment_key` TEXT NOT NULL REFERENCES `segments`(`segment_key`)
- `student_a` TEXT NOT NULL REFERENCES `students`(`admission_number`)
- `student_b` TEXT NOT NULL REFERENCES `students`(`admission_number`)
- `pair_score` REAL NOT NULL CHECK (`pair_score` >= 0.0 AND `pair_score` <= 1.0)
- `factor_breakdown_json` TEXT NOT NULL
- `created_at` DATETIME NOT NULL

Constraints:

- `student_a` and `student_b` must be different
- canonical ordering (`student_a` < `student_b`) enforced at service layer
- UNIQUE (`run_id`, `segment_key`, `student_a`, `student_b`)

Indexes:

- index on (`run_id`, `segment_key`)
- index on `student_a`
- index on `student_b`

### 8) room_assignments

Purpose: final assignment artifacts per run and room.

Columns:

- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `run_id` TEXT NOT NULL REFERENCES `matching_runs`(`run_id`)
- `segment_key` TEXT NOT NULL REFERENCES `segments`(`segment_key`)
- `room_id` TEXT NOT NULL
- `room_label` TEXT NULL
- `assigned_students_json` TEXT NOT NULL
- `group_score` REAL NOT NULL CHECK (`group_score` >= 0.0 AND `group_score` <= 1.0)
- `satisfaction_summary_json` TEXT NULL
- `needs_review` INTEGER NOT NULL CHECK (`needs_review` IN (0, 1))
- `created_at` DATETIME NOT NULL

Constraints:

- UNIQUE (`run_id`, `segment_key`, `room_id`)

Indexes:

- index on (`run_id`, `segment_key`)
- index on `needs_review`

## Integrity Rules to Enforce in Services

- Segment compatibility: `students.room_size` must equal `segments.room_size`.
- Room compatibility: `rooms.capacity` must equal segment room size.
- Matching artifacts must only reference students in the same segment.
- Re-runs always create new `run_id`; no update-in-place for prior run artifacts.

## Migration Strategy for Phase 0

1. Create base tables in dependency order:
   - segments
   - students
   - rooms
   - form_responses
   - preference_profiles
   - matching_runs
   - pair_scores
   - room_assignments
2. Add indexes and unique constraints.
3. Keep enum-like values as CHECK constraints (SQLite-friendly).

## Notes for Future Phases

- If querying occupants as rows becomes necessary, add `room_assignment_members` in a later migration.
- If strict one-active-profile enforcement is needed at DB level in SQLite, add trigger-based enforcement.
- Mapping UI can be introduced later without altering this core schema.
