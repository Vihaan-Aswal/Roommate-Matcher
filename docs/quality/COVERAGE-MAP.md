# COVERAGE MAP — every behaviour-bearing file, classified

Measured 2026-11-15 (Phase 0/1 baseline). Commands:

```powershell
cd backend; uv run --extra dev pytest --cov=app --cov-report=term-missing --cov-report=json:coverage.json
cd frontend; npm run test:coverage
```

Status: **tested** = 100 % line; **partial** = 80–99 %; **untested/partial** = <80 %.
Risk: **H** = can corrupt allocation, privacy, auth or money-like invariants; **M** = user-visible
workflow; **L** = presentation/config glue with no independent behaviour.

Baseline totals: backend **87 % line / 82 % branch**; frontend **73.89 % line / 69.81 % branch /
52.86 % function**. Targets: backend ≥90/85 overall and 100 % line on matching, scoring, fairness,
ingestion; frontend ≥85 line/function on `src/lib`, `src/hooks`, `src/pages`.

Owner names are the test files that already import or exercise the module directly; route modules
are additionally exercised through the TestClient suites listed for `api/routes/`. Files with no
direct owner are listed with the group that owns them or the exclusion reason.

---

## Backend — application code (`backend/app`)

| File | Line % | Branch % | Risk | Status | Owner / reason |
|---|---:|---:|---|---|---|
| `__init__.py` | 100 | - | L | excluded | package marker, no behaviour |
| `api/__init__.py` | 100 | - | L | excluded | package marker, no behaviour |
| `api/deps/__init__.py` | 100 | - | L | excluded | package marker, no behaviour |
| `api/deps/run_access.py` | 100 | 100% | H | tested | tests/auth/test_dependencies.py, tests/matching/test_*scope*.py |
| `api/routes/__init__.py` | 100 | - | L | excluded | package marker, no behaviour |
| `api/routes/auth.py` | 81 | 0% | H | partial | tests/api/*, tests/auth/test_auth_endpoints.py, tests/matching/test_*route*.py + test_*scop*.py, tests/workspaces/, tests/isolation/, tests/platform/, tests/public_form/, tests/internal/ |
| `api/routes/checker.py` | 100 | 100% | H | tested | tests/api/*, tests/auth/test_auth_endpoints.py, tests/matching/test_*route*.py + test_*scop*.py, tests/workspaces/, tests/isolation/, tests/platform/, tests/public_form/, tests/internal/ |
| `api/routes/exports.py` | 91 | 75% | H | partial | tests/api/*, tests/auth/test_auth_endpoints.py, tests/matching/test_*route*.py + test_*scop*.py, tests/workspaces/, tests/isolation/, tests/platform/, tests/public_form/, tests/internal/ |
| `api/routes/fairness.py` | 85 | - | H | partial | tests/api/*, tests/auth/test_auth_endpoints.py, tests/matching/test_*route*.py + test_*scop*.py, tests/workspaces/, tests/isolation/, tests/platform/, tests/public_form/, tests/internal/ |
| `api/routes/internal.py` | 100 | 100% | H | tested | tests/api/*, tests/auth/test_auth_endpoints.py, tests/matching/test_*route*.py + test_*scop*.py, tests/workspaces/, tests/isolation/, tests/platform/, tests/public_form/, tests/internal/ |
| `api/routes/matching.py` | 70 | 0% | H | untested/partial | tests/api/*, tests/auth/test_auth_endpoints.py, tests/matching/test_*route*.py + test_*scop*.py, tests/workspaces/, tests/isolation/, tests/platform/, tests/public_form/, tests/internal/ |
| `api/routes/platform.py` | 89 | 67% | H | partial | tests/api/*, tests/auth/test_auth_endpoints.py, tests/matching/test_*route*.py + test_*scop*.py, tests/workspaces/, tests/isolation/, tests/platform/, tests/public_form/, tests/internal/ |
| `api/routes/public_form.py` | 81 | 65% | H | partial | tests/api/*, tests/auth/test_auth_endpoints.py, tests/matching/test_*route*.py + test_*scop*.py, tests/workspaces/, tests/isolation/, tests/platform/, tests/public_form/, tests/internal/ |
| `api/routes/workspaces.py` | 44 | 4% | H | untested/partial | tests/api/*, tests/auth/test_auth_endpoints.py, tests/matching/test_*route*.py + test_*scop*.py, tests/workspaces/, tests/isolation/, tests/platform/, tests/public_form/, tests/internal/ |
| `auth/__init__.py` | 100 | - | L | excluded | package marker, no behaviour |
| `auth/contracts.py` | 100 | - | H | tested | tests/auth/* |
| `auth/dependencies.py` | 95 | 88% | H | partial | tests/auth/* |
| `auth/supabase.py` | 56 | 25% | H | untested/partial | tests/auth/* |
| `auth/tokens.py` | 91 | 50% | H | partial | tests/auth/* |
| `config.py` | 100 | - | M | tested | tests/test_verify_env.py, tests/test_health.py |
| `database.py` | 61 | 50% | M | untested/partial | tests/conftest.py through every TestClient test |
| `main.py` | 88 | 75% | H | partial | tests/test_health.py, tests/api/test_showcase_static_routes.py |
| `models/__init__.py` | 100 | - | M | tested | tests/models/test_db_models.py, tests/*/* |
| `models/base.py` | 100 | - | M | tested | tests/models/test_db_models.py, tests/*/* |
| `models/form_response.py` | 100 | - | M | tested | tests/models/test_db_models.py, tests/*/* |
| `models/matching_run.py` | 100 | - | M | tested | tests/models/test_db_models.py, tests/*/* |
| `models/pair_score.py` | 100 | - | M | tested | tests/models/test_db_models.py, tests/*/* |
| `models/platform_audit_event.py` | 100 | - | M | tested | tests/models/test_db_models.py, tests/*/* |
| `models/preference_profile.py` | 100 | - | M | tested | tests/models/test_db_models.py, tests/*/* |
| `models/room.py` | 100 | - | M | tested | tests/models/test_db_models.py, tests/*/* |
| `models/room_assignment.py` | 100 | - | M | tested | tests/models/test_db_models.py, tests/*/* |
| `models/segment.py` | 100 | - | M | tested | tests/models/test_db_models.py, tests/*/* |
| `models/student.py` | 100 | - | M | tested | tests/models/test_db_models.py, tests/*/* |
| `models/tenant.py` | 100 | - | M | tested | tests/models/test_db_models.py, tests/*/* |
| `models/tenant_membership.py` | 100 | - | M | tested | tests/models/test_db_models.py, tests/*/* |
| `models/workspace.py` | 100 | - | M | tested | tests/models/test_db_models.py, tests/*/* |
| `models/workspace_form_link.py` | 100 | - | M | tested | tests/models/test_db_models.py, tests/*/* |
| `schemas/__init__.py` | 100 | - | L | excluded | package marker, no behaviour |
| `schemas/checker.py` | 100 | - | M | tested | tests/api/*, tests/services/scoring/* |
| `schemas/fairness.py` | 100 | - | M | tested | tests/api/*, tests/services/scoring/* |
| `schemas/form.py` | 100 | - | M | tested | tests/api/*, tests/services/scoring/* |
| `schemas/ingestion.py` | 100 | - | M | tested | tests/api/*, tests/services/scoring/* |
| `schemas/magic_fill.py` | 100 | - | M | tested | tests/api/*, tests/services/scoring/* |
| `schemas/matching.py` | 94 | 50% | M | partial | tests/api/*, tests/services/scoring/* |
| `schemas/segment.py` | 100 | - | M | tested | tests/api/*, tests/services/scoring/* |
| `schemas/workspace.py` | 100 | - | M | tested | tests/api/*, tests/services/scoring/* |
| `services/__init__.py` | 100 | - | L | tested | package marker / config glue (excluded) |
| `services/dashboard/summary.py` | 54 | 19% | M | untested/partial | tests/api/test_exports_dashboard_endpoints.py |
| `services/demo_seed/__init__.py` | 100 | - | L | excluded | package marker, no behaviour |
| `services/demo_seed/service.py` | 94 | 75% | L | partial | tests/auth/test_demo_seeder.py, tests/scripts/test_demo_seed_outputs.py |
| `services/explainability/__init__.py` | 100 | - | H | tested | tests/explainability/* |
| `services/explainability/consistency.py` | 89 | 82% | H | partial | tests/explainability/* |
| `services/explainability/contracts.py` | 100 | - | H | tested | tests/explainability/* |
| `services/explainability/factor_classification.py` | 76 | 64% | H | untested/partial | tests/explainability/* |
| `services/explainability/privacy_rules.py` | 100 | 100% | H | tested | tests/explainability/* |
| `services/explainability/reason_selection.py` | 92 | 88% | H | partial | tests/explainability/* |
| `services/explainability/room_aggregation.py` | 87 | 79% | H | partial | tests/explainability/* |
| `services/explainability/service.py` | 76 | 64% | H | untested/partial | tests/explainability/* |
| `services/explainability/template_catalog.py` | 100 | - | H | tested | tests/explainability/* |
| `services/explainability/template_renderer.py` | 97 | 89% | H | partial | tests/explainability/* |
| `services/fairness/__init__.py` | 100 | - | H | tested | tests/fairness/* |
| `services/fairness/contracts.py` | 100 | - | H | tested | tests/fairness/* |
| `services/fairness/distribution.py` | 90 | 80% | H | partial | tests/fairness/* |
| `services/ingestion/__init__.py` | 100 | - | L | excluded | package marker, no behaviour |
| `services/ingestion/csv_utils.py` | 79 | 75% | H | untested/partial | tests/ingestion/*, tests/public_form/* |
| `services/ingestion/form_collection.py` | 98 | 88% | H | partial | tests/ingestion/*, tests/public_form/* |
| `services/ingestion/form_response.py` | 94 | 89% | H | partial | tests/ingestion/*, tests/public_form/* |
| `services/ingestion/form_response_csv.py` | 85 | 67% | H | partial | tests/ingestion/*, tests/public_form/* |
| `services/ingestion/room_csv.py` | 81 | 73% | H | partial | tests/ingestion/*, tests/public_form/* |
| `services/ingestion/student_csv.py` | 90 | 84% | H | partial | tests/ingestion/*, tests/public_form/* |
| `services/magic_fill/__init__.py` | 100 | - | L | excluded | package marker, no behaviour |
| `services/magic_fill/service.py` | 100 | 100% | M | tested | tests/magic_fill/* |
| `services/matching/__init__.py` | 100 | - | H | tested | tests/matching/* |
| `services/matching/adapter.py` | 100 | - | H | tested | tests/matching/* |
| `services/matching/contracts.py` | 100 | - | H | tested | tests/matching/* |
| `services/matching/engine.py` | 80 | 68% | H | partial | tests/matching/* |
| `services/matching/errors.py` | 100 | - | H | tested | tests/matching/* |
| `services/matching/graph_builder.py` | 100 | 100% | H | tested | tests/matching/* |
| `services/matching/invariants.py` | 76 | 71% | H | untested/partial | tests/matching/* |
| `services/matching/labels.py` | 100 | 100% | H | tested | tests/matching/* |
| `services/matching/matcher_2bed.py` | 85 | 67% | H | partial | tests/matching/* |
| `services/matching/matcher_3bed.py` | 86 | 77% | H | partial | tests/matching/* |
| `services/matching/matcher_4bed.py` | 82 | 64% | H | partial | tests/matching/* |
| `services/matching/nx_mapping.py` | 88 | 80% | H | partial | tests/matching/* |
| `services/matching/pair_lookup.py` | 81 | 70% | H | partial | tests/matching/* |
| `services/matching/room_ids.py` | 82 | 67% | H | partial | tests/matching/* |
| `services/matching/satisfaction.py` | 100 | 100% | H | tested | tests/matching/* |
| `services/matching/swap_optimizer.py` | 87 | 79% | H | partial | tests/matching/* |
| `services/orchestration/__init__.py` | 100 | - | L | excluded | package marker, no behaviour |
| `services/orchestration/checker_workflow.py` | 89 | 77% | H | partial | tests/matching/test_run_workflow_scope.py, tests/api/*, tests/matching/test_checker_scope.py |
| `services/orchestration/run_workflow.py` | 84 | 71% | H | partial | tests/matching/test_run_workflow_scope.py, tests/api/*, tests/matching/test_checker_scope.py |
| `services/platform/__init__.py` | 100 | - | L | excluded | package marker, no behaviour |
| `services/platform/impersonation.py` | 93 | 50% | M | partial | tests/platform/* |
| `services/public_form/__init__.py` | 100 | - | L | excluded | package marker, no behaviour |
| `services/public_form/token_service.py` | 88 | 100% | H | partial | tests/public_form/* |
| `services/scoring/__init__.py` | 100 | - | H | tested | tests/services/scoring/* |
| `services/scoring/constants.py` | 100 | 100% | H | tested | tests/services/scoring/* |
| `services/scoring/distance.py` | 100 | 100% | H | tested | tests/services/scoring/* |
| `services/scoring/labels.py` | 100 | 100% | H | tested | tests/services/scoring/* |
| `services/scoring/matrix.py` | 100 | 100% | H | tested | tests/services/scoring/* |
| `services/scoring/mismatch.py` | 100 | 100% | H | tested | tests/services/scoring/* |
| `services/scoring/pipeline.py` | 100 | 100% | H | tested | tests/services/scoring/* |
| `services/scoring/segment_matrix.py` | 100 | 100% | H | tested | tests/services/scoring/* |
| `services/scoring/types.py` | 100 | - | H | tested | tests/services/scoring/* |
| `services/scoring_adapter.py` | 0 | - | L | untested/partial | package marker / config glue (excluded) |
| `services/segments/__init__.py` | 100 | - | L | excluded | package marker, no behaviour |
| `services/segments/status.py` | 93 | 84% | M | partial | tests/segments/test_status.py |

### Backend — non-application files

| File | Risk | Disposition |
|---|---|---|
| `backend/alembic/versions/0001_postgres_baseline_all_tables.py` | H | Owner: Postgres parity suite gated on `TEST_DATABASE_URL` (Phase 3/4). SQLite-only runs exercise `Base.metadata.create_all`, not this migration. |
| `backend/alembic/versions/518fbf2fb0e6_add_is_active_to_rooms.py` | H | Same Postgres parity suite (upgrade/downgrade). |
| `backend/alembic/versions/59c3bb185e91_add_index_source_form_response_id.py` | M | Same Postgres parity suite; index existence asserted. |
| `backend/alembic/versions/66d537ba5fdf_enable_rls_alembic_version.py` | H | Same Postgres parity suite; RLS policy asserted. |
| `backend/alembic/versions/712aa19360fd_enable_rls.py` | H | Same Postgres parity suite; RLS policy asserted. |
| `backend/alembic/versions/8744d05f47e1_add_service_role_rls_policies.py` | H | Same Postgres parity suite; RLS policy asserted. |
| `backend/alembic/versions/e26a92a336a6_add_workspace_id_index_to_matching_runs.py` | M | Same Postgres parity suite; index existence asserted. |
| `backend/alembic/versions/e26a92a336a7_cascade_delete_segment.py` | H | Same Postgres parity suite; cascade delete asserted. |
| `backend/alembic/versions/e26a92a336a8_unique_tenant_membership.py` | H | Same Postgres parity suite; unique constraint asserted. |
| `backend/alembic/env.py`, `script.py.mako` | M | Migration configuration template; exercised by the parity suite. No independent behaviour. |
| `backend/alembic/versions_archive_sqlite/0001..0004` | L | Archived SQLite-only history; not on the production upgrade path. Excluded deliberately. |
| `backend/scripts/evaluate.py` | M | Owner: `tests/scripts/test_evaluate_smoke.py` (subprocess, text + JSON). |
| `backend/scripts/generate_e2e_admin_token.py` | M | Owner: E2E `phase7.spec.ts` (subprocess). |
| `backend/scripts/showcase_bootstrap.py` | M | Owner: `tests/api/test_showcase_static_routes.py` (bootstrap + static serving). |
| `backend/pyproject.toml` | M | Declares deps + pytest/coverage config; verified by every run. Not behaviour. |
| `backend/alembic.ini`, `.env.example`, `.python-version`, `uv.lock` | L | Configuration glue; no runtime branch. |
| `backend/tests/fixer.py`, `refactor.py`, `refactor2.py`, `refactor3.py` | L | Dead scratch scripts, unreferenced (Phase 2 deletes). |

---

## Frontend — `frontend/src` (all 87 covered files)

| File | Line % | Branch % | Func % | Risk | Owner / reason |
|---|---:|---:|---:|---|---|
| `src/App.tsx` | 80.39 | 80 | 50 | H | src/test/routing/*, src/test/workspace-routing.test.tsx |
| `src/components/AdminPageHeader.tsx` | 95.83 | 37.5 | 100 | M | src/test/components/*, page tests |
| `src/components/DataTable.tsx` | 89.79 | 57.14 | 100 | M | src/test/components/*, page tests |
| `src/components/DataWarningBanner.tsx` | 4.34 | 100 | 0 | M | src/test/components/*, page tests |
| `src/components/DiffPreviewPanel.tsx` | 64.28 | 54.54 | 7.14 | M | src/test/components/*, page tests |
| `src/components/EmptyState.tsx` | 100 | 100 | 100 | M | src/test/components/*, page tests |
| `src/components/FileUploadPanel.tsx` | 96.1 | 53.84 | 100 | M | src/test/components/*, page tests |
| `src/components/FormQuestion.tsx` | 100 | 90 | 100 | M | src/test/components/*, page tests |
| `src/components/ImpersonationBanner.tsx` | 29.41 | 50 | 50 | M | src/test/components/*, page tests |
| `src/components/InlineAlert.tsx` | 100 | 33.33 | 100 | M | src/test/components/*, page tests |
| `src/components/SegmentLabel.tsx` | 100 | 100 | 100 | M | src/test/components/*, page tests |
| `src/components/StatCard.tsx` | 100 | 100 | 100 | M | src/test/components/*, page tests |
| `src/components/StatusBadge.tsx` | 100 | 100 | 100 | M | src/test/components/*, page tests |
| `src/components/checker/CheckerResultPanel.tsx` | 87.87 | 55.55 | 100 | M | src/test/pages/manual-checker-page.test.tsx |
| `src/components/checker/CheckerSelectionPanel.tsx` | 100 | 71.42 | 100 | M | src/test/pages/manual-checker-page.test.tsx |
| `src/components/checker/CheckerStudentsList.tsx` | 94.73 | 72.72 | 75 | M | src/test/pages/manual-checker-page.test.tsx |
| `src/components/home/ArtifactSection.tsx` | 99.36 | 80 | 100 | M | src/test/home/* |
| `src/components/home/BoundarySection.tsx` | 100 | 90.9 | 100 | M | src/test/home/* |
| `src/components/home/CompatibilitySection.tsx` | 100 | 96 | 100 | M | src/test/home/* |
| `src/components/home/FairnessSection.tsx` | 98.29 | 90.62 | 100 | M | src/test/home/* |
| `src/components/home/HeroRunStage.tsx` | 79.95 | 36.98 | 80 | M | src/test/home/* |
| `src/components/home/LimitsSection.tsx` | 100 | 100 | 100 | M | src/test/home/* |
| `src/components/home/SignOffSection.tsx` | 100 | 100 | 100 | M | src/test/home/* |
| `src/components/home/motion.ts` | 56.06 | 66.66 | 50 | M | src/test/home/* |
| `src/components/home/simulate.ts` | 97.69 | 93.96 | 93.93 | M | src/test/home/* |
| `src/components/matching/filters/RoomResultsFilters.tsx` | 100 | 100 | 100 | M | src/test/pages/*-results-page.test.tsx |
| `src/components/matching/filters/StudentResultsFilters.tsx` | 100 | 100 | 66.66 | M | src/test/pages/*-results-page.test.tsx |
| `src/components/matching/tables/RoomResultsTable.tsx` | 99 | 81.81 | 50 | M | src/test/pages/*-results-page.test.tsx |
| `src/components/matching/tables/StudentResultsTable.tsx` | 92.92 | 85.71 | 66.66 | M | src/test/pages/*-results-page.test.tsx |
| `src/components/panels/DetailSidePanelShell.tsx` | 93.84 | 87.5 | 50 | M | src/test/components/student-detail-panel.test.tsx |
| `src/components/panels/RoomStudentDetailPanel.tsx` | 100 | 50 | 100 | M | src/test/components/student-detail-panel.test.tsx |
| `src/components/panels/StudentDetailPanel.tsx` | 95.32 | 75 | 100 | M | src/test/components/student-detail-panel.test.tsx |
| `src/components/reports/FairnessBarChart.tsx` | 100 | 66.66 | 100 | M | src/test/pages/fairness-reports-page.test.tsx |
| `src/components/reports/FairnessCountsCard.tsx` | 100 | 33.33 | 33.33 | M | src/test/pages/fairness-reports-page.test.tsx |
| `src/components/reports/RunSegmentSelector.tsx` | 100 | 100 | 33.33 | M | src/test/pages/fairness-reports-page.test.tsx |
| `src/components/ui/button.tsx` | 100 | 100 | 100 | L | vendored shadcn primitives exercised indirectly; excluded from target |
| `src/components/ui/checkbox.tsx` | 100 | 100 | 100 | L | vendored shadcn primitives exercised indirectly; excluded from target |
| `src/components/ui/input.tsx` | 100 | 100 | 100 | L | vendored shadcn primitives exercised indirectly; excluded from target |
| `src/components/ui/select.tsx` | 89.18 | 100 | 100 | L | vendored shadcn primitives exercised indirectly; excluded from target |
| `src/components/ui/toast.tsx` | 46.03 | 100 | 100 | L | vendored shadcn primitives exercised indirectly; excluded from target |
| `src/components/ui/toaster.tsx` | 52.38 | 100 | 100 | L | vendored shadcn primitives exercised indirectly; excluded from target |
| `src/hooks/adminQueryKeys.ts` | 81.48 | 100 | 25 | M | src/test/hooks/* |
| `src/hooks/use-toast.ts` | 25.39 | 100 | 14.28 | M | src/test/hooks/* |
| `src/hooks/useAdminFormCollection.ts` | 21.21 | 100 | 0 | M | src/test/hooks/* |
| `src/hooks/useAdminMatchingRuns.ts` | 20.83 | 100 | 0 | M | src/test/hooks/* |
| `src/hooks/useAdminSegments.ts` | 40 | 100 | 0 | M | src/test/hooks/* |
| `src/hooks/useAdminUploads.ts` | 14.58 | 100 | 0 | M | src/test/hooks/* |
| `src/hooks/useAssignmentsExportMutation.ts` | 37.5 | 100 | 0 | M | src/test/hooks/* |
| `src/hooks/useFormSubmit.ts` | 12 | 100 | 0 | M | src/test/hooks/* |
| `src/hooks/useManualCheckerMutation.ts` | 37.5 | 100 | 0 | M | src/test/hooks/* |
| `src/hooks/useRunFairnessQuery.ts` | 40 | 100 | 0 | M | src/test/hooks/* |
| `src/hooks/useRunRoomsQuery.ts` | 100 | 75 | 100 | M | src/test/hooks/* |
| `src/hooks/useRunStudentsAllSegmentsQuery.ts` | 100 | 50 | 66.66 | M | src/test/hooks/* |
| `src/hooks/useRunStudentsQuery.ts` | 40 | 100 | 0 | M | src/test/hooks/* |
| `src/hooks/useSegmentStudentsQuery.ts` | 40 | 100 | 0 | M | src/test/hooks/* |
| `src/hooks/useWorkspacesQuery.ts` | 22.22 | 100 | 0 | M | src/test/hooks/* |
| `src/layouts/AdminLayout.tsx` | 96.06 | 57.14 | 66.66 | M | src/test/admin-*.test.tsx (shell rendered by page tests) |
| `src/lib/apiClient.ts` | 9.24 | 55.55 | 14.7 | H | src/test/lib/* (added in this pass) |
| `src/lib/dashboardStep.ts` | 83.65 | 92.3 | 100 | M | src/test/lib/* (added where missing) |
| `src/lib/factorDisplay.ts` | 93.54 | 71.42 | 100 | M | src/test/lib/* (added where missing) |
| `src/lib/formQuestions.ts` | 100 | 100 | 100 | M | src/test/lib/* |
| `src/lib/motion.ts` | 0 | 100 | 100 | M | src/test/lib/* (added where missing) |
| `src/lib/privacySafeRender.ts` | 100 | 100 | 100 | H | src/test/privacy/phase7-privacy.test.tsx |
| `src/lib/resultEnums.ts` | 100 | 100 | 100 | M | src/test/lib/* (added where missing) |
| `src/lib/resultPresentation.ts` | 100 | 100 | 100 | M | src/test/lib/* (added where missing) |
| `src/lib/segmentLabel.ts` | 89.65 | 88.57 | 100 | M | src/test/lib/* (added where missing) |
| `src/lib/supabase.ts` | 73.33 | 0 | 100 | M | src/test/lib/* (added where missing) |
| `src/lib/utils.ts` | 100 | 100 | 100 | M | src/test/lib/* (added where missing) |
| `src/pages/AdminAtRiskReview.tsx` | 13.11 | 100 | 0 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/AdminDashboard.tsx` | 87.03 | 74.35 | 57.14 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/AdminFairness.tsx` | 50 | 100 | 0 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/AdminFormCollection.tsx` | 72.02 | 32.5 | 61.11 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/AdminManualChecker.tsx` | 100 | 100 | 100 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/AdminMatchingRuns.tsx` | 69.83 | 38.09 | 77.77 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/AdminStudentsData.tsx` | 65.54 | 37.03 | 40 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/HomePage.tsx` | 93.63 | 100 | 33.33 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/LoginPage.tsx` | 78.06 | 22.22 | 16.66 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/StudentForm.tsx` | 88.32 | 78.84 | 83.33 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/WorkspaceChooserPage.tsx` | 53.4 | 17.64 | 20 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/checker/ManualCheckerPage.tsx` | 73.3 | 50.84 | 57.14 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/matching/RoomResultsPage.tsx` | 57.38 | 34.69 | 33.33 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/matching/StudentResultsPage.tsx` | 82.93 | 80.9 | 42.85 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/platform/PlatformTenantWorkspacesPage.tsx` | 9.35 | 100 | 0 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/platform/PlatformTenantsPage.tsx` | 5.03 | 100 | 0 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/pages/reports/FairnessReportsPage.tsx` | 65.69 | 27.9 | 30 | M | src/test/pages/*, src/test/admin-*.test.tsx |
| `src/providers/AuthProvider.tsx` | 37.26 | 50 | 66.66 | H | src/test/workspace-routing.test.tsx, src/test/routing/* |
| `src/providers/WorkspaceProvider.tsx` | 94.11 | 55.55 | 66.66 | H | src/test/workspace-routing.test.tsx, src/test/routing/* |

### Frontend — non-`src` files

| File | Risk | Disposition |
|---|---|---|
| `frontend/scripts/audit-redesign.mjs` | M | Evidence tool: a11y/overflow/console scan. Run in Phase 3 a11y sweep; not part of the unit suite. |
| `frontend/scripts/capture-redesign.mjs`, `capture-showcase-screenshots.mjs`, `motion-stills.mjs`, `record-motion.mjs`, `trace-motion.mjs` | L | Screenshot/motion evidence tooling. Excluded from coverage; manual evidence only. |
| `frontend/scripts/diff-screenshots.mjs` | L | Pixel-diff helper; no product behaviour. |
| `frontend/scripts/e2e-reset-db.mjs` | H | Owner: every E2E run (Playwright `webServer`). Resets the E2E SQLite DB. |
| `frontend/scripts/measure-redesign.mjs` | M | Perf proxy measurement; used in Phase 0/5 numbers. |
| `frontend/scripts/python-runtime.mjs` | H | Owner: E2E webServer + phase7 spec; resolves the Python runtime for seeding/admin token. |
| `frontend/scripts/seed-partial-workspace.mjs` | M | Scenario seeding for dashboard states; used by audit/capture scripts. |
| `frontend/scripts/start-backend-e2e.mjs`, `start-frontend-e2e.mjs` | H | Owner: every E2E run (Playwright `webServer`). |
| `frontend/scripts/verify-home-tokens.mjs`, `verify-motion-modes.mjs`, `verify-resting-states.mjs` | L | Evidence/style checks; no runtime behaviour. |
| `frontend/e2e/tests/*.spec.ts` (5) | H | The E2E layer itself; run twice in the DoD. |
| `frontend/e2e/fixtures/*.csv` (3) | M | Deterministic upload fixtures consumed by E2E. |
| `frontend/playwright.config.ts`, `vitest.config.ts`, `vite.config.ts`, `tsconfig*.json`, `tailwind.config.ts`, `postcss.config.js`, `components.json` | M | Build/test configuration; verified by typecheck/build/test runs. No independent behaviour. |
| `frontend/index.html`, `src/index.css`, `src/app/desk.css`, `src/app/motion.css`, `src/components/home/home.css` | L | Presentation only; covered by E2E visual/overflow assertions, not line coverage. |
| `frontend/package.json`, `.env.example`, `.env.local`, `vercel.json` | L | Dependency/deployment configuration. |
| `frontend/src/main.tsx` | L | React bootstrap (3 lines); excluded from line coverage, exercised by every E2E route. |
| `frontend/src/test/**` | L | Test harness itself (`setup.ts`, `renderWithProviders.tsx`); excluded. |

---

## Root / deploy / docs

| File | Risk | Disposition |
|---|---|---|
| `start.sh`, `start.bat` | M | Bootstrap path; verified manually + CI uses the same commands. Shell glue, no branches worth unit-testing. |
| `render.yaml`, `frontend/vercel.json` | M | Deploy configuration; validated by Phase 6 CI config test / review. |
| `.github/workflows/*.yml` | M | CI workflows; the Phase 6 workflow itself is the proof. |
| `demo-data/seed.py` | H | Owner: `tests/scripts/test_demo_seed_outputs.py`, E2E reset. |
| `demo-data/*.csv` | M | Deterministic fixture data; consumed by seed + E2E. |
| `docs/**`, `PRODUCT.md`, `DESIGN.md`, `README.md`, `images/**` | L | Documentation and screenshots; anti-goal to delete. |

---

## Exclusions (explicit)

1. **Package markers** (`__init__.py` with no statements) — no behaviour.
2. **Vendored shadcn primitives** (`src/components/ui/*`) — third-party pattern; they are exercised
   through page tests, but the 85 % frontend target covers `lib`, `hooks`, `pages` only.
3. **CSS** — asserted by E2E overflow/visual checks, not line coverage.
4. **Archived SQLite migrations** — superseded by `0001_postgres_baseline_all_tables.py`; not on any live path.
5. **Evidence scripts** (capture/verify/diff) — produce artefacts for humans, no product behaviour.

Anything not listed above has no exclusion. Rows above with `partial`/`untested` are the Phase 3
worklist.

## Post-pass changes (2026-11-15, final)

- `app/services/scoring_adapter.py` deleted: broken unused import shim (`profiles_to_scoring_profiles`
  no longer exists). No caller.
- `app/services/dashboard/summary.py::get_dashboard_summary` deleted: dead and broken (missing
  required `workspace_id`); the route uses `get_workspace_dashboard_summary`.
- Dead reactivation/duplicate branches removed in `room_csv`, `student_csv`, `matcher_3bed`,
  `matcher_4bed`; the 9 formerly uncovered lines are gone rather than suppressed.
- Final backend coverage is 99.93 % line / 99.20 % branch; all four required packages are 100 %.
  Frontend final is 95.02 line / 88.37 branch / 95.18 function (386 tests).

