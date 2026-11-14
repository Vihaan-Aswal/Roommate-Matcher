# 00 — Research: the app before the redesign

> Phase 1 evidence. Nothing here changed code. Captures live in `.impeccable/review/app/baseline/`
> (`before-<page>-<width>.png`, widths 375/768/1280/1920), taken from a fresh demo workspace
> seeded through `POST /api/auth/demo`, with one matching run executed so every results page had
> real artifacts.

## 1. Stack and tooling

| Layer | What it is |
|---|---|
| Build | Vite 6 + React 18 + TypeScript (strict-ish; `npm run typecheck` = `tsc --noEmit`) |
| CSS | Tailwind 3 with an HSL variable theme in `frontend/src/index.css`; the homepage adds a hand-written, `.mm-home`-scoped stylesheet (`components/home/home.css`, 53 KB) |
| Components | shadcn-shaped local primitives in `components/ui/*` (button, card, table, badge, input, select, sheet, alert, toast, skeleton) over Radix (`react-select`, `react-checkbox`, `react-toast`, `react-slot`) + CVA + `clsx`/`tailwind-merge` |
| Data | TanStack Query 5 hooks in `src/hooks/*`; one API client (`lib/apiClient.ts`) holding the bearer token in a module variable |
| Routing | React Router 6, `BrowserRouter`, routes in `App.tsx` |
| Auth | Supabase email/password **or** demo app-JWT (`POST /api/auth/demo`), `sessionStorage.demo_token`, plus platform-admin impersonation tokens |
| Icons | `lucide-react` 1.x (the homepage already uses it: ArrowRight, Play) |
| Tests | Vitest + Testing Library, 20 files / 42 tests; jsdom |
| Fonts | Self-hosted woff2 in `frontend/public/fonts`: Besley, Public Sans, IBM Plex Mono. Declared `@font-face` in `home.css` — therefore available app-wide |

Nothing in the app references the homepage's fonts or palette today: the shell uses the default
shadcn blue (`--primary: 221.2 83.2% 53.3%`), a white/cream radial gradient, and `font-serif`
(Georgia). The homepage and the app currently look like two products.

## 2. Route inventory

| Route | File | Who | Purpose today |
|---|---|---|---|
| `/` | `pages/HomePage.tsx` | public | **Frozen.** Persuade surface. |
| `/login` | `pages/LoginPage.tsx` | signed out | Email/password + "Try the Demo" |
| `/f/:token` | `pages/StudentForm.tsx` | students (no account) | Identity check (admission no + phone last 4), 12 preference questions, submit |
| `/app` | `pages/WorkspaceChooserPage.tsx` | signed in | Pick or create a workspace |
| `/app/:workspaceId/dashboard` | `pages/AdminDashboard.tsx` | warden | Setup readiness, collection stats, latest run |
| `/app/:workspaceId/students-data` | `pages/AdminStudentsData.tsx` | warden | Upload students CSV, rooms CSV; preview diff; apply |
| `/app/:workspaceId/form-collection` | `pages/AdminFormCollection.tsx` | warden | Share/rotate form link, completion by segment, non-submitters, questionnaire preview |
| `/app/:workspaceId/matching-runs` | `pages/AdminMatchingRuns.tsx` | warden | Segment readiness, run scope, run history |
| `/app/:workspaceId/matching-runs/:runId/rooms` | `pages/matching/RoomResultsPage.tsx` | warden | Room-level proposal + student drawer + CSV export |
| `/app/:workspaceId/matching-runs/:runId/students` | `pages/matching/StudentResultsPage.tsx` | warden | Student-level proposal, label/at-risk filters, student drawer |
| `/app/:workspaceId/fairness[/:runId]` | `pages/reports/FairnessReportsPage.tsx` | warden, dean | Distribution, per-segment floors, at-risk drill-through |
| `/app/:workspaceId/at-risk-review` | `pages/AdminAtRiskReview.tsx` | warden | Resolves the newest completed run and redirects to the student table with `atRisk=1` |
| `/app/:workspaceId/manual-checker` | `pages/checker/ManualCheckerPage.tsx` | warden (after hours) | Advisory compatibility report for a hand-picked group |
| `/platform` | `pages/platform/PlatformTenantsPage.tsx` | platform admin | All tenants, filter, impersonate entry point |
| `/platform/tenants/:tenantId/workspaces` | `pages/platform/PlatformTenantWorkspacesPage.tsx` | platform admin | Tenant workspaces, enter as workspace |
| `/admin/*` | redirect | legacy | → `/app` |
| `*` | redirect | anyone | → `/login` |

No 404 page, no 500 page, no legal pages, no email templates in the repo. The system surfaces that
exist are: the auth bootstrap spinner, the guard redirects, the form-unavailable state, and the
per-page empty/error/loading branches.

## 3. Data and functionality behind each page

| Surface | Endpoint(s) | Real fields shown |
|---|---|---|
| Dashboard | `GET /workspaces/:id/dashboard` | `setup_status.{master_students_uploaded,rooms_uploaded,forms_collection_started,at_least_one_segment_ready}`, `form_collection_stats.{total_students,students_with_valid_preferences,percentage_complete}`, `segments_status.{total_segments,ready,impossible,at_risk}`, `latest_matching_run.{run_id,status,created_at}`, `generated_data_warning` |
| Students & Data | `POST /students/upload/preview`, `/students/upload/apply`, same for `/rooms/…`, `GET /collection/status` | counts, `validation_errors[]`, `diff_entries[]` (`admission_number/full_name/action/changes/warnings`) |
| Form & Collection | `GET /form-link`, `POST /form-link/regenerate`, `GET /collection/status`, `GET /collection/non-submitters` | `form_url`, `expires_at`, `total_students`, `valid_responses`, `invalid_responses`, `percentage_valid`, `by_segment[]`, `non_submitters[]` |
| Matching Runs | `GET /segments`, `GET /matching/runs`, `POST /matching/runs` `{scope:"segment"\|"all_ready_segments"}`, `POST /magic-fill` | `segments[].{segment_key,gender,year_group,ac_type,room_size,status,student_count,total_capacity}`, `runs[].{run_id,scope,status,segments_completed,created_at}` |
| Room results | `GET /matching/runs/:run/rooms?segment_key=`, `GET …/students?segment_key=`, `GET /exports/assignments/:run` | `rooms[].{room_id,room_size,group_score,needs_review,assigned_students[].{full_name,admission_number,pair_scores_with_roommates}}` |
| Student results | `GET …/students?segment_key=`, `GET …/students/all-segments` | `students[].{admission_number,full_name,room_id,satisfaction_score,satisfaction_label,is_at_risk,reasons[],factor_trace[]}` |
| Fairness | `GET /fairness/:runId` | `total_students`, `run_label_counts/percentages`, `run_at_risk_count`, `by_segment[].{segment_key,total_students,label_counts,label_percentages,at_risk_count,minimum_satisfaction}` |
| Manual checker | `GET /segments`, `GET /segments/:key/students`, `POST /checker/compatibility` | `room_size`, roster, `group_score`, `group_label`, `at_risk_students`, per-student reasons + factor trace |
| Student form | `GET /api/public/forms/:token`, `POST …/submit` | `token_valid`, `workspace_name`, `expires_at` |
| Platform | `GET /platform/tenants`, `GET /platform/tenants/:id`, `…/workspaces`, `…/impersonate` | tenant display name, slug, contact email, `is_demo`, `workspace_count`, `created_at` |
| Workspaces | `GET/POST /api/workspaces` | `name`, `created_at`, `status`, `is_demo_seeded` |

Business rules that constrain the UI (from `PRODUCT.md`): four immutable boundary keys; ten weighted
factors; labels Excellent/Good/Okay/Poor with at-risk = score < 0.55; wardens see reasons, never raw
answers; a person signs, the system proposes; identical inputs produce identical outputs.

## 4. User journeys

1. **First contact → demo.** `/` → "Open the desk" → `/login` → Try the Demo → demo workspace
   seeded (96 students, 38 rooms, 96 responses) → dashboard. Win condition: a seeded run they can look at.
2. **Setup.** Dashboard → Students & Data (students CSV, rooms CSV; preview then apply) → Form &
   Collection (copy link) → Dashboard shows stages green.
3. **Collection.** Warden shares link; students open `/f/:token` on a phone; warden watches
   completion and chases non-submitters from the same page.
4. **Run.** Matching Runs → segments ready → run one segment or all → run history row.
5. **Review.** Rooms (per segment, needs-review filter) and Students (label/at-risk) → student drawer
   with reasons and factor trace → Fairness for the floor and the at-risk list.
6. **Second opinion.** Manual Checker: pick segment, pick n-1 existing + 1 candidate, run, read the
   advisory report. Changes nothing.
7. **Platform.** Super-admin opens `/platform`, filters tenants, enters a workspace as that tenant,
   sees the amber impersonation banner, exits back to `/platform`.

## 5. What is wrong — by page

### Shell (`AdminLayout`)
- A 280px white sidebar with seven flat links; the active state is a saturated shadcn blue pill —
  the only blue in a product whose mark colour is oxblood. It reads as a different product.
- Wordmark set in Georgia on two lines, the workspace name in 14px grey directly under it, so the
  page's identity is ambiguous ("which workspace am I in?" is answered in the weakest type on screen).
- "Switch Workspace" is a bare text link with an arrow character.
- No breadcrumb or run context: on a results page you cannot tell which run you are reading except
  from the URL or a sentence in the page header.
- No global status: whether collection is complete or at risk is invisible from other pages.
- Mobile: the sidebar stacks *above* the content, so every phone visit starts with a 300px menu.
- The `ImpersonationBanner` is a full-width amber-brown bar that fights the page; the exit control
  is a second amber chip.
- `min-h-screen` + decorative radial gradient: the "desk at night" world is replaced by a pastel
  wash.

### Login
- Two equal stacked cards ("Sign In", "Try the Demo") with identical weight; the demo path — the one
  a first-time visitor wants — is styled as the *secondary* action.
- No product voice, no sense of what the desk does, no link back to the homepage or its argument.
- `console.log("handleDemo called!")` and friends ship to production.
- Error states are a bare red line; no `aria-live`, no field-level messaging, no disabled/pending
  affordance beyond opacity.

### Workspace chooser
- Three-column card grid of identical cards, each with name + date + two badges. Looks like a SaaS
  template, says nothing about the work inside.
- "Create workspace" is a dashed card that becomes a form in place; no empty-state design for the
  zero-workspace case beyond a dashed box.
- Status text is lowercased raw enum (`active`), demo flag is a blue chip.

### Dashboard
- Four identical stat cards (total, valid, %, ready) — a card grid, not a story. The four numbers
  answer "is this ready?" but nothing connects them into the sequence roster → rooms → responses → run.
- "Setup Checklist" is four bordered rows inside a bordered card (cards-in-cards).
- "Latest Matching Run" is a label/value dump, including the raw run id in 14px body text.
- The workspace name is interpolated into the h2: "Demo — Spring 2025 Dashboard".
- Primary action is not obvious: four pill buttons of nearly equal weight at top right, one of them
  ("⚡ Magic Fill Missing") in amber text — the attention colour used for a convenience utility.
- Empty/no-run case: the "Latest Matching Run" block shows "No runs available" in the same layout as
  a real run, with dead labels above empty values.
- Loading: four grey skeleton rectangles and nothing else; no indication of what is loading.

### Students & Data
- Two upload cards side by side, each a generic shadcn form: file input, sentence, button. Nothing
  explains the file contract (the exact columns) even though the backend validates them strictly.
- The three-step flow (select → preview → applied) has no visible step structure; the page silently
  replaces the upload card with a preview card.
- Preview (`DiffPreviewPanel`) is a card with a stat-card row of its own, an alerts stack, a table,
  and two buttons in the card header. Destructive "Confirm & Apply" is red, not wax.
- Applied state is a green card with four white stat cards inside (cards-in-cards again).
- No column reference anywhere; users learn the schema by failing an upload.

### Form & Collection
- The link is a grey rounded box with a copy button; the most important object on the page looks like
  a text field.
- "Regenerate link" is destructive (invalidates the live link for every student) but styled as a
  quiet outline button with a red label, and its warning appears *after* the confirm row appears.
- Four stat cards again, then two tables, then a 12-card questionnaire preview that swamps the page.
- Non-submitters table has no count in the title and no sense of urgency.
- Empty states are a single grey line inside a table.

### Matching Runs
- Two tables stacked with 6–7 columns each; "Actions" cells hold three outline buttons plus a
  "⚡ Fill Missing" amber-text button. Row actions are the loudest thing on the page.
- Segment identity is a raw key (`F_1st_year_NonAC_3`) plus `gender | year | ac` in a second column —
  the same information twice.
- Run ids are the first column of the history in full; status is a coloured chip; there is no
  indication of which run is the one worth opening.
- "Run All Ready Segments" is disabled with no explanation when nothing is ready.

### Room results
- A shadcn table where each row's second cell contains a stack of bordered boxes per student with a
  second stack of rounded pill pair scores — a table inside a cell inside a card.
- Score shown twice (`84.0%` and `raw 0.8397`), health as a chip.
- The filter bar is a white strip with a native-looking select and a checkbox.
- "Showing N rooms." above the table; no segment context in the masthead, only in the URL.
- Student drawer is a white shadcn sheet with a "Close" button; reasons are bordered boxes; the
  factor table is a second table.
- Export CSV sits alone at top right with no indication it exports the *filtered* segment.

### Student results
- Same table pattern with seven columns; reasons are clipped to one line with "+N more" but there is
  no way to see all reasons except the drawer.
- At-risk is duplicated: `satisfaction_label` chip and a separate "Risk/Healthy" chip, so a Poor
  student shows two red-adjacent chips.
- The at-risk route (`/at-risk-review`) lands on this page with no on-page acknowledgement that the
  user is in a review context; the filter checkbox is the only clue.
- Filter bar: three controls, no result count until the table line below.

### Fairness
- "Run summary" card: three label/value pairs, one of which is a *button* styled like a bordered row
  ("At risk: 3") that drills into students.
- "Run label distribution" is four full-width bordered buttons with 10px bars in four saturated
  colours (emerald/sky/amber/rose) — a palette that exists nowhere else in the product.
- Per-segment panels: four bordered boxes in a 2-col grid, each with four bordered buttons inside.
- The page never states the floor rule or the at-risk threshold, so the numbers have no meaning
  without the docs.

### Manual checker
- Two white cards side by side, each repeating the same amber disclaimer box (duplicate copy).
- The student list is a bordered scroll box of native checkboxes; the candidate is a Radix select;
  the validation sentence sits under the button in 12px grey.
- Result panel shows a score, a label chip, "At-risk students: …", then a bordered article per student
  with reasons and a factor line — dense but unstructured.
- Empty result state: "Select students and run compatibility report to view results."

### Student form
- A 4xl card with a yellow→blue→green gradient header, 12 bordered question cards each with a
  coloured legend, native radios, and a separate "Back"/"Submit" pair at the very bottom.
- No sticky progress; on a phone the submit button is 12 screens away from the first question.
- Identity step: two inputs, no field-level errors, error text appended in one place.
- Success: a green tinted box. Nothing tells the student what happens next (or that nothing does).
- Invalid/expired token: "Form Unavailable — This link has expired or is invalid." with no
  instruction.

### Platform tenants
- A raw `<table>` with `uppercase tracking-wider` headers, blue "Impersonate →" text links, green/blue
  status chips, and a "God Mode" amber chip inside the h1.
- Filter input + native checkbox in a row with no labels beyond the checkbox.
- Loading is three grey pulse blocks; error is a red-tinted div.
- Workspace page: 3-col cards with full UUIDs printed in mono and an amber "Enter as this workspace"
  button. No indication of risk or of the current impersonation.

## 6. Cross-cutting problems

1. **One skeleton, different paint.** Eight authenticated pages share the same shape: `AdminPageHeader`
   → card grid → table. The page's *job* never shapes the layout. This is the exact failure the human
   named ("lack of imagination, poor planning").
2. **The attention colour is spent on conveniences.** Amber appears on Magic Fill buttons, "Okay"
   chips, generated-data banners, and demo chips. On the homepage amber means *at risk*; in the app
   it means "extra".
3. **Every figure is a card.** Counts, run ids, statuses and percentages all get card chrome, so
   nothing has weight; the eye has no entry point.
4. **Loading is a paragraph.** `InlineAlert` is used for loading ("Loading segments — Preparing
   segment filters for this run.") and for errors, so a slow query looks like a permanent notice.
   This is also what made the first baseline captures show full-page skeletons: the token race
   (`setApiToken` ran after child queries mounted) produced a 401 storm on every hard reload.
   Fixed with a 2-line ordering change in `AuthProvider` (see `decisions.md`).
5. **Typography has no scale.** Page titles are 30px Georgia; everything else is 14px Inter-ish;
   data is not set in mono, so numbers cannot be compared column-wise.
6. **No state design.** Empty states are a dashed box or a grey sentence; error states are InlineAlerts
   without recovery; loading never resembles the content that will replace it.
7. **Mobile is a stacked desktop.** Tables become horizontally scrolling boxes; the sidebar costs the
   first screen; tap targets are 32–36px.
8. **Contrast and focus.** Focus rings are the shadcn ring (blue) or absent; `outline` buttons on
   cream sit near 1.05:1 borders; several 12px grey labels are below 4.5:1.
9. **Copy is system dialect.** "Track setup readiness, collection progress, and the latest run
   summary before triggering a new matching run", "Upload responses are authoritative and dependent
   views are automatically refreshed after each upload" — written for a developer, not a warden.
10. **Dead ends.** `/at-risk-review` redirects with a flash of an InlineAlert; `/platform` has no way
    back to the tenant console from a workspace except the exit banner; the chooser has no sign-out.

## 7. Baseline measurements

Recorded in `03-progress.md` §Baseline. Lighthouse CLI is not installed and no dependency may be
added this pass; the performance baseline is therefore Playwright-measured LCP / CLS / long tasks
plus bundle size, and that substitution is logged in `04-open-questions.md`.

## 8. Homepage dependency audit (frozen surface)

Commit `9c491bf` — `feat(home): public homepage for Roommate Matcher`.

Files owned by the homepage (read-only for this pass):

- `frontend/src/pages/HomePage.tsx`
- `frontend/src/components/home/**` (`HeroRunStage`, `BoundarySection`, `CompatibilitySection`,
  `ArtifactSection`, `FairnessSection`, `SignOffSection`, `LimitsSection`, `motion.ts`, `simulate.ts`,
  `home.css`)
- `frontend/public/fonts/**` (besley, public-sans, ibm-plex-mono-400/500)
- `frontend/src/test/home/**`
- `PRODUCT.md`, `DESIGN.md`

Shared files the homepage depends on (additive changes only): `frontend/src/index.css` (imported by
`main.tsx`, applies `border-border` to `*` and the body font), `frontend/tailwind.config.ts`,
`frontend/src/main.tsx` (imports `index.css`; mounting order), `frontend/src/App.tsx` (the `/` route).

The homepage uses **none** of `components/ui/*`, `components/AdminPageHeader`, `StatCard`,
`StatusBadge`, `DataTable`, `InlineAlert`, or any page component. Its only shared imports are React,
`react-router-dom`, `lucide-react`, and `home.css`. Therefore:

- Reworking `components/ui/*` or any app component cannot move a homepage pixel.
- Adding keys to `index.css` / `tailwind.config.ts` cannot move a homepage pixel either, because
  `.mm-home` sets its own font, colours, and radii, and nothing in `home.css` consumes the Tailwind
  theme except utility classes that already exist. This pass still only adds.
- The one shared thing that could affect the homepage is the `@font-face` block: it lives in
  `home.css`, so the app may *reuse* those families but must not redeclare or change them.
