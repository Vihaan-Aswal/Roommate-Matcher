# Copilot instructions

## Core rules

- Do not assume requirements beyond the repo docs and current task.
- Work in small tickets, not whole phases.
- Prefer minimal diffs over broad refactors.
- Do not change unrelated files.
- If something is unclear, surface the ambiguity instead of guessing.

## Planning discipline

- Before proposing a plan, inspect the current relevant files and summarize the existing structure briefly.
- Read only the docs and sections relevant to the current ticket, not the entire repo docs by default.
- If two docs conflict, stop and list the conflict clearly. Do not choose one silently.
- If the task changes a contract (database schema, API response, shared types, persistence format, or matching output shape), call that out explicitly.
- If the task is too large, split it into smaller tickets before coding.

## Before coding

For every non-trivial task, first provide:

1. current relevant files and what already exists
2. assumptions
3. doc conflicts or ambiguity
4. files to create or update
5. implementation plan
6. test plan
7. exact commands I should run after implementation

Do not start coding until the plan is clear.

## Execution discipline

- Implement only the approved ticket.
- Touch only the files needed for that ticket.
- Keep the diff small and scoped.
- Do not refactor unrelated code unless explicitly asked.
- Do not edit old committed migrations; create a new migration instead.
- Do not claim tests pass unless you list the exact commands run.
- Do not silently swallow errors.
- If something becomes unclear during implementation, stop and surface it instead of guessing.

## Scope control

- Prefer one layer per ticket whenever possible.
- If the plan touches more than 7 files, propose splitting the task.
- If the task spans multiple boundaries (for example schema + backend service + API + frontend), propose splitting it unless explicitly required.
- For scoring, matching, explainability, and fairness logic, include at least one worked example before coding.
- For API or frontend tickets, include example request/response shapes or UI state expectations before coding.

## Architecture

- Keep business logic out of API routes.
- Keep scoring, matching, explainability, and fairness logic in pure service modules.
- FastAPI handlers must stay thin: validate input, call services, return response.
- Keep UI components focused on presentation and local state; avoid embedding core business rules in the frontend.
- Reuse existing utilities and patterns before adding new abstractions.

## Project-specific rules

- `segment_key` is immutable once defined.
- Matching results must be versioned; do not overwrite historical runs.
- Store both raw answers and encoded preference values when saving form responses.
- Use exact CSV column names for v1; do not invent a mapping UI unless explicitly asked.
- Explanations must be privacy-safe; do not expose raw sensitive lifestyle values directly.
- Matching must be deterministic when tie-breaking.
- The Manual Checker must reuse the same explanation logic as the main matching flow.
- The project should be built in local two-server dev mode first; packaging into a single-server demo setup comes later.

## Code quality

- Write clear, simple, typed code.
- Prefer explicitness over cleverness.
- Reuse existing utilities and patterns before adding new abstractions.
- Do not add placeholder code unless marked with a clear `TODO`.
- Keep functions small and readable.
- Avoid speculative features and future-proofing that are not required by the current ticket.

## Tests

- Add or update tests for every logic change.
- Test happy path, edge cases, and failure cases.
- For scoring and matching logic, prefer table-driven or fixture-based tests.
- For matching logic, cover determinism, leftover handling, and tie-breaking.
- Do not consider a task complete if logic changed and tests were not updated.

## Output discipline

- Implement only what the current task asks for.
- Do not add speculative features.
- At the end, always summarize:
  - what changed
  - which files changed
  - what tests were added or updated
  - exact commands run
  - anything I need to manually verify
  - any risks, limitations, or follow-ups
