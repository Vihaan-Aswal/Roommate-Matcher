# 03 — Progress

**Phase:** complete — review rounds 2 and 3 · **Branch:**
`feat/homepage-motion-and-app-redesign` (no git commands run by this agent; the human commits)
**Homepage commit:** `9c491bf` · **App redesign commit:** `eddee75` · **Last updated:** 2026-11-14

## Review round 2 — three seams (after `eddee75`)

| Seam | Rule now | Files |
|---|---|---|
| Segments had three names | `lib/segmentLabel.ts` + `<SegmentLabel showKey />`: human label primary everywhere; raw key only as the mono subline in registers. Guarded by a unit test and a runtime text scan on 12 routes. | `lib/segmentLabel.ts` (new), `components/SegmentLabel.tsx` (new), `app/desk.css` (`.desk-segname*`), `pages/AdminMatchingRuns.tsx`, `pages/AdminFormCollection.tsx`, `pages/AdminStudentsData.tsx`, `pages/matching/RoomResultsPage.tsx`, `pages/matching/StudentResultsPage.tsx`, `pages/reports/FairnessReportsPage.tsx`, `pages/checker/ManualCheckerPage.tsx`, `components/reports/FairnessCountsCard.tsx`, `components/reports/RunSegmentSelector.tsx`, `components/checker/CheckerSelectionPanel.tsx`, `components/matching/filters/RoomResultsFilters.tsx`, `components/matching/filters/StudentResultsFilters.tsx` |
| The rail lied on at-risk | Active row derived from the review state: student register + `atRisk=1` → **At-Risk Review**, Matching Runs suppressed. No route change. | `layouts/AdminLayout.tsx` |
| Readiness had two vocabularies | Four rules: **Missing** (quiet) · **In Progress** (plain) · **Ready** (wax) · **Risk / Impossible** (amber). "Complete"/"Pending"/"Collecting" removed; the detail line carries the count. | `pages/AdminDashboard.tsx`, `components/StatusBadge.tsx` |
| The directive led away from the blocker | `lib/dashboardStep.ts` derives the act **and** its destination; the note carries only the blockers the directive is not about, one action each, and disappears when it would repeat the directive. | `lib/dashboardStep.ts` (new), `pages/AdminDashboard.tsx`, `test/dashboard-step.test.ts` (new), `test/admin-dashboard-next-action.test.tsx` (new) |
| *(found while photographing)* the public form could not submit | Request/response mapping for `POST /api/public/forms/:token/submit`; config reads `workspace_display_name`. Verified through the real UI. | `lib/apiClient.ts` |

Guards added to `scripts/audit-redesign.mjs`: no raw segment key outside `.desk-segname-key`, the
expected active rail row per route (it would have caught seam 2), and a click on the dashboard's
directive that must land under the expected path. `scripts/seed-partial-workspace.mjs` seeds a
4-student workspace, drives the student form UI end to end, photographs the blocked dashboard at
1280/375, clicks its directive and asserts the landing path; `--rooms 1 --tag capacity --expect
/students-data` photographs the capacity-gap state instead (files: `partial-dashboard-*`,
`capacity-dashboard-*`).

## How to run

```powershell
# dev server on a private port (5173 belongs to the homepage-motion agent)
cd frontend
npm run dev -- --port 5175 --strictPort

# production build + preview (perf + bundle)
npm run build
npx vite preview --port 4175 --strictPort

# screenshots (creates its own demo workspace + one matching run through the API)
node scripts/capture-redesign.mjs --out ../.impeccable/review/app/after --tag after --widths 375,768,1280,1920
node scripts/capture-redesign.mjs --only rooms --widths 1440 --view        # viewport only

# evidence helpers
node scripts/diff-screenshots.mjs <dirA> <baseA> <dirB> <baseB> [widths]    # pixel diff, no deps
node scripts/measure-redesign.mjs --base http://127.0.0.1:4175 --out ../.impeccable/review/app/perf.json
node scripts/audit-redesign.mjs --base http://127.0.0.1:5175               # a11y / overflow / console

# checks
npm run test        # 20 files / 42 tests
npm run typecheck
npm run build       # tsc -b + vite build (use this, not typecheck alone: project refs are stricter)
```

Backend: already running on `127.0.0.1:8000` (sqlite `data/app.db`). Demo data: `POST /api/auth/demo`
(no credentials). Platform pages need a super-admin token: `scripts/generate_e2e_admin_token.py`
fails on a second run (fixed tenant slugs), so mint one from an existing membership with
`AppData\Local\Temp\opencode\mm_admin_token.py` (read-only helper, written this session).

## Phase status

| Phase | Status |
|---|---|
| 0 Setup | done |
| 1 Research | done — `00-research.md` |
| 2 UX plan + self-review | done — `01-ux-plan.md` |
| 3 Design system | done — `02-design-system.md` + `src/app/desk.css` |
| 4 Pages | done — 15 surfaces rebuilt, pilot calibrated |
| 5 Harden | done |

## Pages (all rebuilt, all states implemented)

| # | Page | Route | Files |
|---|---|---|---|
| 0 | Shell | `/app/:ws/*` | `layouts/AdminLayout.tsx` |
| 1 | Dashboard (pilot) | `/app/:ws/dashboard` | `pages/AdminDashboard.tsx` |
| 2 | Login | `/login` | `pages/LoginPage.tsx` |
| 3 | Workspace chooser | `/app` | `pages/WorkspaceChooserPage.tsx` |
| 4 | Students & Data | `/app/:ws/students-data` | `pages/AdminStudentsData.tsx`, `components/FileUploadPanel.tsx`, `components/DiffPreviewPanel.tsx` |
| 5 | Form & Collection | `/app/:ws/form-collection` | `pages/AdminFormCollection.tsx` |
| 6 | Matching Runs | `/app/:ws/matching-runs` | `pages/AdminMatchingRuns.tsx` |
| 7 | Room results | `…/:runId/rooms` | `pages/matching/RoomResultsPage.tsx`, `components/matching/tables/RoomResultsTable.tsx`, `components/matching/filters/RoomResultsFilters.tsx` |
| 8 | Student results + review mode | `…/:runId/students` | `pages/matching/StudentResultsPage.tsx`, `components/matching/tables/StudentResultsTable.tsx`, `components/matching/filters/StudentResultsFilters.tsx` |
| 9 | At-risk review | `/app/:ws/at-risk-review` | `pages/AdminAtRiskReview.tsx` |
| 10 | Fairness | `/app/:ws/fairness[/:runId]` | `pages/reports/FairnessReportsPage.tsx`, `components/reports/{FairnessBarChart,FairnessCountsCard,RunSegmentSelector}.tsx` |
| 11 | Manual checker | `/app/:ws/manual-checker` | `pages/checker/ManualCheckerPage.tsx`, `components/checker/{CheckerSelectionPanel,CheckerResultsPanel,CheckerStudentsList}.tsx` |
| 12 | Student form | `/f/:token` | `pages/StudentForm.tsx`, `components/FormQuestion.tsx` |
| 13 | Platform console | `/platform`, `/platform/tenants/:id/workspaces` | `pages/platform/{PlatformTenantsPage,PlatformTenantWorkspacesPage}.tsx` |
| 14 | Drawers / notes / tables / chips | shared | `components/{AdminPageHeader,StatCard,StatusBadge,DataTable,InlineAlert,DataWarningBanner,EmptyState}.tsx`, `components/panels/**`, `components/ImpersonationBanner.tsx`, `components/ui/{button,input,select,checkbox,toast}.tsx` |

## Baseline (before) — kept

- `.impeccable/review/app/baseline/` — 20 routes × 4 widths, `before-<route>-<width>.png`.
- Tests: 20 files / 42 tests green. Bundle: JS 713.00 kB (208.21 gzip), CSS 77.40 kB (15.62 gzip).
- Lighthouse CLI unavailable (no dependency may be added); perf proxy measured in production build.

## After (evidence)

- `.impeccable/review/app/after/` — the same 20 routes × 4 widths, `after-<route>-<width>.png`.
- `.impeccable/review/app/seams/` — the nine affected pages at 1280 and 375 (`seams-*`), the two
  dashboard states (`seams-dashboard-*` all-ready, `partial-dashboard-*` Ready/Ready/In Progress/Risk),
  `capacity-dashboard-*` (Impossible / capacity gap) and `student-form-receipt-390.png`.
- `.impeccable/review/app/page*/` — viewport captures used while judging individual pages.
- `.impeccable/review/app/perf-after-prod.json` — LCP / CLS / bytes on the production preview:
  home LCP 700 ms · login 340 ms · dashboard 364 ms · matching-runs 368 ms; CLS 0.0006–0.0136;
  DOMContentLoaded ≤ 177 ms; ~91–92 kB transferred per route (gzip).
- Bundle after the directive fix: JS **736.93 kB** (214.08 gzip), CSS **88.04 kB** (17.74 gzip).
  No new dependency.
- Tests: **23 files / 57 tests** green (42 base + 4 segment formatter + 8 next-step + 3 dashboard
  next-action). `npm run build` (tsc -b + vite) and `npm run typecheck` green.
- `scripts/audit-redesign.mjs` → **CLEAN** at 375 and 1280 across 12 routes: one `h1` and one `main`,
  no heading-order breaks, no unnamed controls, no console errors, visible focus ring on the first
  three tab stops, no horizontal overflow, no target under 24px, **no raw segment key in copy**,
  **the expected active rail row**, and **the dashboard CTA clicked through to its asserted
  destination** (`Read the proposal` → the run's rooms).
- Impeccable detector over `desk.css` + every page, component and layout → **no findings**.

## Homepage regression

`desk.css` was added to `main.tsx` only. Proof it changes nothing on `/`: the homepage was captured
normally and again with the `desk.css` style element removed, then pixel-diffed at 375/768/1280/1920 —
**0 differing pixels** at every width (`scripts/diff-screenshots.mjs`,
`.impeccable/review/app/nodesk/`). The homepage files themselves were never edited; their mtimes show
the homepage-motion agent's concurrent edits (that is why the before/after *homepage* captures differ —
that work is theirs, not this pass).

## Next action

Nothing pending. The three seams and the form-submit fix are in; the only follow-ups are the
proposals in `04-open-questions.md`.

## Per-page file list (for splitting commits)

**Design system + shell**
`frontend/src/app/desk.css` (new), `frontend/src/main.tsx`, `frontend/src/layouts/AdminLayout.tsx`,
`frontend/src/components/AdminPageHeader.tsx`, `StatCard.tsx`, `StatusBadge.tsx`, `DataTable.tsx`,
`InlineAlert.tsx`, `DataWarningBanner.tsx`, `EmptyState.tsx` (new), `ImpersonationBanner.tsx`,
`components/ui/button.tsx`, `input.tsx`, `select.tsx`, `checkbox.tsx`, `toast.tsx`,
`providers/AuthProvider.tsx` (token ordering), `lib/apiClient.ts` (form-link type).

**Deleted (unused after the rebuild)**
`components/ui/card.tsx`, `badge.tsx`, `table.tsx`, `alert.tsx`, `skeleton.tsx`, `sheet.tsx`,
`components/matching/tables/roomResultsColumns.tsx`, `studentResultsColumns.tsx`.

**Dashboard (pilot)**
`frontend/src/pages/AdminDashboard.tsx`, `frontend/src/test/admin-dashboard.test.tsx`.

**Login**
`frontend/src/pages/LoginPage.tsx`.

**Workspace chooser**
`frontend/src/pages/WorkspaceChooserPage.tsx`.

**Students & Data**
`frontend/src/pages/AdminStudentsData.tsx`, `frontend/src/components/FileUploadPanel.tsx`,
`frontend/src/components/DiffPreviewPanel.tsx`.

**Form & Collection**
`frontend/src/pages/AdminFormCollection.tsx`.

**Matching Runs**
`frontend/src/pages/AdminMatchingRuns.tsx`.

**Room results**
`frontend/src/pages/matching/RoomResultsPage.tsx`,
`frontend/src/components/matching/tables/RoomResultsTable.tsx`,
`frontend/src/components/matching/filters/RoomResultsFilters.tsx`.

**Student results + at-risk review**
`frontend/src/pages/matching/StudentResultsPage.tsx`, `frontend/src/pages/AdminAtRiskReview.tsx`,
`frontend/src/components/matching/tables/StudentResultsTable.tsx`,
`frontend/src/components/matching/filters/StudentResultsFilters.tsx`,
`frontend/src/components/panels/DetailSidePanelShell.tsx`, `StudentDetailPanel.tsx`,
`RoomStudentDetailPanel.tsx`, `frontend/src/test/components/student-detail-panel.test.tsx`.

**Fairness**
`frontend/src/pages/reports/FairnessReportsPage.tsx`,
`frontend/src/components/reports/{FairnessBarChart,FairnessCountsCard,RunSegmentSelector}.tsx`.

**Manual checker**
`frontend/src/pages/checker/ManualCheckerPage.tsx`,
`frontend/src/components/checker/{CheckerSelectionPanel,CheckerResultPanel,CheckerStudentsList}.tsx`,
`frontend/src/test/pages/manual-checker-page.test.tsx`.

**Student form**
`frontend/src/pages/StudentForm.tsx`, `frontend/src/components/FormQuestion.tsx`.

**Platform console**
`frontend/src/pages/platform/PlatformTenantsPage.tsx`, `PlatformTenantWorkspacesPage.tsx`.

**Evidence tooling (not part of the product; commit separately or drop)**
`frontend/scripts/capture-redesign.mjs`, `diff-screenshots.mjs`, `measure-redesign.mjs`,
`audit-redesign.mjs`.

**Docs**
`docs/redesign/00-brief.md` (pre-existing), `00-research.md`, `01-ux-plan.md`, `02-design-system.md`,
`03-progress.md`, `decisions.md`, `deviations.md`, `placeholders.md`, `04-open-questions.md`,
`docs/redesign/design-language.md` (merged into `02-design-system.md` §1–3).

**Review round 2 (three seams + the form-submit fix)**

New: `frontend/src/lib/segmentLabel.ts`, `frontend/src/components/SegmentLabel.tsx`,
`frontend/src/test/segment-label.test.ts`, `frontend/scripts/seed-partial-workspace.mjs`,
`frontend/src/lib/dashboardStep.ts`, `frontend/src/test/dashboard-step.test.ts`,
`frontend/src/test/admin-dashboard-next-action.test.tsx`.
Changed: `frontend/src/app/desk.css` (`.desk-segname*`), `frontend/src/layouts/AdminLayout.tsx`,
`frontend/src/pages/AdminDashboard.tsx`, `frontend/src/components/StatusBadge.tsx`,`frontend/src/pages/AdminMatchingRuns.tsx`, `frontend/src/pages/AdminFormCollection.tsx`,
`frontend/src/pages/AdminStudentsData.tsx`, `frontend/src/pages/matching/RoomResultsPage.tsx`,
`frontend/src/pages/matching/StudentResultsPage.tsx`,
`frontend/src/pages/reports/FairnessReportsPage.tsx`,
`frontend/src/pages/checker/ManualCheckerPage.tsx`,
`frontend/src/components/reports/FairnessCountsCard.tsx`,
`frontend/src/components/reports/RunSegmentSelector.tsx`,
`frontend/src/components/checker/CheckerSelectionPanel.tsx`,
`frontend/src/components/matching/filters/RoomResultsFilters.tsx`,
`frontend/src/components/matching/filters/StudentResultsFilters.tsx`,
`frontend/src/lib/apiClient.ts` (public form request/response mapping),
`frontend/scripts/audit-redesign.mjs` (raw-key + active-nav guards),
`frontend/scripts/capture-redesign.mjs` (`--workspace` override).
Docs: `docs/redesign/decisions.md` (D25–D28), `docs/redesign/03-progress.md`.
