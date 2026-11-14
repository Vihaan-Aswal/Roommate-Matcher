# 01 — UX plan

> Phase 2. This file decides structure before any UI code. Build order and the pilot are at the end.
> Decisions with alternatives live in `decisions.md`; departures from the repo docs in `deviations.md`.

## 1. Who is doing what, and what "done" means

| Person | Context | Job | Success looks like |
|---|---|---|---|
| **Warden / housing officer** | Office desktop, 9–6, sometimes a phone on rounds | Get the roster and responses in, run the match, read the proposal, chase the weak cases | Knows within ten seconds of opening a page whether anything needs them, and can answer "why is this student here?" in one screen |
| **Dean of student affairs** | Meeting room, projector, or a forwarded PDF | Approve or challenge a proposal | The fairness page can be read aloud: the floor, the at-risk list, the weakest room per segment |
| **Student** | Phone, one sitting, no account | Answer 12 questions once | Finishes in under five minutes without a single avoidable error |
| **Platform admin** | Internal ops, rare | Find a tenant, enter a workspace, leave | Never confuses their own context with the tenant's |
| **After-hours warden** | Manual checker | Second opinion on a hand-picked group | Gets an answer with its caveats, without touching saved data |

Non-negotiables carried from `PRODUCT.md`: a person signs, the system proposes; explain the weakest
student, not the average one; privacy is structural (reasons, never raw answers); same inputs, same
outputs.

## 2. Ideal journeys

**A. First look (2 minutes).** Homepage → "Open the desk" → login. The demo is the primary path for a
first-time visitor; sign-in is for people who already have accounts. Demo → dashboard shows a real
seeded workspace with a completed run, so the first click is "read the proposal", not "upload a CSV".

**B. Prepare (10 minutes).** Dashboard states the four readiness stages and what is missing, each
stage linking to the page that fixes it. Students & Data presents students and rooms as two intake
lanes with the same three-step shape (choose → review the diff → applied), and states the file
contract *before* the upload, not after the failure. Form & Collection puts the link first, then the
completion meter, then the chase list.

**C. Run.** Matching Runs is one screen: what is ready, one primary "Run all ready segments", and the
history. When something is not ready, the reason is on the row, not in a tooltip.

**D. Review.** Rooms → per-room proposal with pair scores and a needs-review mark. Students → the
student's score, label, at-risk mark, and one-line reasons; open one for the full reason list and the
factor trace. Fairness → the floor: label distribution, at-risk count, per-segment minimum, each a
link into the exact filtered student list. At-risk review is this same table pre-filtered, and the
page says so.

**E. Sign-off.** There is no signing feature in the product (no endpoint, no field). The app's job ends
at a proposal a person can defend, plus a CSV export. Copy must not imply a signature flow that
doesn't exist. *(Proposal logged in `04-open-questions.md`.)*

**F. Student.** Link → identity (admission number + last 4) → 12 questions with a sticky progress and
submit → receipt. Every validation message names the field and the fix.

## 3. Information architecture

```
/                        public argument (frozen)
/login                   open the desk — demo first, sign-in second
/f/:token                student response (no shell)
/app                     choose a desk (workspace)
/app/:ws/dashboard       the desk today
/app/:ws/students-data   inputs: roster + rooms
/app/:ws/form-collection inputs: the link, the meter, the chase list
/app/:ws/matching-runs   the run: readiness, run, history
  …/:runId/rooms         the proposal, room by room
  …/:runId/students      the proposal, student by student
/app/:ws/fairness[/:runId] the floor
/app/:ws/at-risk-review  redirect → students?atRisk=1 (kept as a route)
/app/:ws/manual-checker  an advisory second opinion
/platform                tenant register (super-admin)
/platform/tenants/:id/workspaces
```

Route changes: **none required.** All existing URLs stay, including `/admin/*` → `/app` and the
`/at-risk-review` redirect. No new routes are added, so no redirects are needed.

Navigation model: one persistent rail (desktop) / top bar + drawer (mobile), grouped by the work
sequence rather than by feature list:

- **Setup** — Students & Data · Form & Collection
- **Run** — Matching Runs
- **Review** — Reports & Fairness · At-Risk Review · Manual Checker

Dashboard sits above the groups as *the desk*. The workspace name is always visible in the rail; the
run id is visible on every results page. There is no nav wall: three groups, seven destinations, mono
group labels.

Things removed, merged or demoted:

- **At-Risk Review** stops being a page that redirects with a flash message; the route stays, and the
  student results page renders itself in *review mode* (title, one-line explanation, amber count)
  when `atRisk=1`. Nothing is deleted; the round trip is just honest.
- **Questionnaire preview** on Form & Collection collapses into a disclosure — 12 questions is
  reference material, not the page's job.
- **Magic Fill** stays (it is a real capability) but leaves the page header: it becomes a labelled
  utility inside Students & Data, next to the data it generates, with amber reserved for the
  generated-data state it causes.
- Nothing else is removed. Every page keeps its heading, its actions, and its data.

## 4. Content strategy

Voice: the homepage's. Plain concrete nouns, short declaratives, no adjective stacking, no "seamless",
"powerful", "effortless", "insights". Numbers are stated with their unit and their scope. Where a
figure is illustrative, it says so.

Rules:
1. **Name the thing the warden controls.** "Run all ready segments", not "Execute matching".
2. **Say what a number means.** "96 of 96 responses" not "Collection complete 100%".
3. **State the consequence before the action.** Regenerating the link invalidates the one students
   already have — say it before the button, not after.
4. **Never claim a capability that isn't there**: no signing, no notifications, no email sending, no
   SLA, no accuracy figure.
5. **Privacy wording** stays literal: "Reasons, never raw answers."
6. **No institution, hall, term or person is invented.** The seeded workspace's own name
   (e.g. "Demo — Spring 2025") is shown where it exists; otherwise "this workspace".
7. **Errors say what happened and what to do next**, in that order, in the user's nouns.

Examples (before → after):

| Before | After |
|---|---|
| "Track setup readiness, collection progress, and the latest run summary before triggering a new matching run." | "Four stages stand between this workspace and a proposal. Each row opens the page that moves it." |
| "Upload responses are authoritative and dependent views are automatically refreshed after each upload." | "Upload the students file or the rooms file. Nothing is written until you confirm the changes." |
| "Manual Checker is advisory only. Running this report does not modify saved assignments or matching runs." | "An advisory read. It never edits a run, a room or an assignment." |
| "No rows match current filters" | "No students match these filters. Clear the label or at-risk filter to see the rest." |

## 5. Per-page contract

Each page gets: one purpose, one primary action, a content hierarchy, and every state. "States" means
empty, loading, error, success, at-risk/attention, long lists, narrow viewport.

### /login
- **Purpose:** open the desk.
- **Primary action:** Start the demo (first-time visitors). Secondary: sign in with email.
- **Hierarchy:** masthead (product name in mono + claim) → one slip with two routes → footnote on what
  the demo creates.
- **States:** idle, pending (button label + disabled), bad credentials (field-level), demo creation
  failed (slip-level, retry), already signed in (redirect).
- **Success:** lands on the seeded dashboard with a run ready to read.

### /app (workspace chooser)
- **Purpose:** pick the desk to work at.
- **Primary:** open a workspace (whole row is the target). Secondary: create one.
- **Hierarchy:** masthead → register of workspaces (name, created, status, demo mark) → new-workspace
  row that expands inline.
- **States:** loading (row skeletons), error (retry), zero workspaces (one prompt + create form),
  one, many (scroll), create pending, create error.

### /app/:ws/dashboard
- **Purpose:** what is ready, what is not, and where to go next.
- **Primary:** the next unblocking step (upload / collect / run / review). One wax control.
- **Hierarchy:** masthead with workspace name → four-stage readiness strip (roster, rooms, responses,
  segments) → latest run block with three destinations → generated-data note if present.
- **States:** loading (stage skeletons), error (retry), no run yet, run present, partial readiness
  (some stage pending), generated data present, zero students.
- **Success:** the warden knows whether they can run matching.

### /app/:ws/students-data
- **Purpose:** put the roster and the room list in.
- **Primary:** upload and apply (per lane). Secondary: see the file contract.
- **Hierarchy:** masthead → two intake lanes (Students, Rooms), each step-marked (1 choose, 2 review,
  3 applied) → validation snapshot → Magic Fill utility, clearly labelled as generating data.
- **States:** idle, file selected, previewing, validation errors (count + table), warnings, applying,
  applied (counts), apply failed (retry from preview), contract disclosure open/closed.
- **Success:** the applied counts match the file, and the dashboard stages advance.

### /app/:ws/form-collection
- **Purpose:** get responses in.
- **Primary:** copy the link. Secondary: open it, chase non-submitters (export).
- **Hierarchy:** masthead → the link slip (URL in mono, copy, open, regenerate with consequence copy)
  → completion meter + segment register → non-submitters (count in the heading, export) →
  questionnaire disclosure.
- **States:** link loading/error, link ready, regenerating (pending + consequence), regenerated
  (success note), no students, 100% complete, table loading/error/empty.
- **Success:** the warden can paste one link into the class group and see who has not answered.

### /app/:ws/matching-runs
- **Purpose:** run the match and get to the output.
- **Primary:** run all ready segments (with the count in the label). Secondary: run one segment.
- **Hierarchy:** masthead → run bar (ready count, primary action, last run) → segment readiness
  register (readable profile, size, status, students/capacity, per-row action) → run history
  (newest first, run id as the link into its three views).
- **States:** loading, error, no segments, some ready, none ready (explain why), run pending, run
  failed, run completed, history empty.
- **Success:** a completed run and a one-click path into rooms, students, fairness.

### …/:runId/rooms
- **Purpose:** read the proposal room by room.
- **Primary:** open a student (drawer). Secondary: export the segment CSV, filter needs-review.
- **Hierarchy:** masthead with run id and segment → filter bar → register of rooms (room id, size,
  group score, health, students with pair scores) → student drawer.
- **States:** loading, error, empty segment, filtered-empty (needs review), selected room, drawer open
  (long reasons, many factors), export pending/failed, at-risk room marked.
- **Success:** every room's weakest pairing is visible without opening anything.

### …/:runId/students
- **Purpose:** answer "why is this student here?" and surface the weak ones.
- **Primary:** open a student. Secondary: filter by label / at-risk; review mode from the nav.
- **Hierarchy:** masthead (review mode changes title + explanation) → filter bar with live counts →
  distribution strip (Excellent/Good/Okay/Poor with counts) → student register → drawer.
- **States:** loading, error, empty run, filtered empty, at-risk empty (good news, said plainly),
  drawer with no reasons, drawer with privacy-redacted reasons, 900 rows.
- **Success:** the at-risk list is the first thing a warden can reach.

### /app/:ws/fairness[/:runId]
- **Purpose:** state the floor.
- **Primary:** drill into at-risk students. Secondary: switch run/segment; drill into a label.
- **Hierarchy:** masthead → run + segment selector → floor statement (total, at-risk, thresholds
  explained) → distribution → per-segment panels (counts, %, minimum satisfaction, at-risk) → links
  into students.
- **States:** no run, run with no segments, loading, error, all segments, one segment, zero at-risk
  (stated as success), generated data note.
- **Success:** a dean can read the fairness statement aloud without the docs.

### /app/:ws/manual-checker
- **Purpose:** an advisory second opinion.
- **Primary:** run the compatibility report. Secondary: change segment, search, pick.
- **Hierarchy:** masthead with the advisory line → two-pane workbench: selection (segment, room size,
  roster checklist with search, candidate) | result (score, label, at-risk, per-student reasons and
  factor classes) → validation line next to the action.
- **States:** no segments, loading, error, incomplete selection (specific message), running, result,
  error, long roster, no search results.
- **Success:** the answer arrives with its caveat and the user knows nothing was saved.

### /f/:token
- **Purpose:** answer 12 questions once.
- **Primary:** submit. Secondary: back to identity.
- **Hierarchy:** quiet masthead (workspace name, "12 questions") → identity step → question set with
  progress → submit → receipt.
- **States:** loading, invalid/expired link, identity errors (per field), unanswered questions
  (per question + summary), submitting, submit error, success receipt.
- **Success:** finish on a phone without horizontal scroll or a lost answer.

### /platform, /platform/tenants/:id/workspaces
- **Purpose:** find a tenant, enter a workspace, leave cleanly.
- **Primary:** open a tenant → enter a workspace. Secondary: filter, include demo tenants.
- **Hierarchy:** platform masthead (mono "Platform console" mark) → filter row → tenant register
  (name, slug, contact, type, workspaces, created, open) → workspace register with an explicit
  "enter as this tenant" action and its consequence.
- **States:** loading, error, empty, filtered empty, many tenants, impersonation pending, impersonation
  failed, impersonation active (banner on every workspace page).
- **Success:** the operator never forgets whose data they are in.

## 6. Design direction

**Where the app matches the homepage exactly:** the material world (near-black forest field, cream
paper, oxblood wax as the mark, amber only for attention), the three typefaces and their jobs (Besley
for judgement, Public Sans for explanation, Plex Mono for evidence), pill controls, small paper radii,
offset shadows, the ruled register as the data container, and the plain voice.

**Where the app legitimately differs:** density and composition.

| | Homepage | App |
|---|---|---|
| Purpose | persuade | operate |
| Type scale | display 2.9–4.4rem | page title 1.75–2.25rem, section title 1.25rem, body 15–16px, data 13px mono |
| Section spacing | 96–128px | 24–40px |
| Paper | discrete objects on the field | one continuous ledger page per route |
| Controls | 49px pills, generous | 36px compact + 44px touch minimum on mobile |
| Colour budget | amber rare | amber strictly at-risk/attention; wax for primary; green never used for "good" |

Density is chosen per task: the dashboard breathes (four stages, one run block), the results tables
are tight (13px rows, 44px height), the student form is spacious (one question per block, 48px
options), the platform console is a compact register.

**Both dark and light support?** No. One world, one palette: the app is the same lit desk, always on.
There is no theme toggle in the product and adding one would fork the system; the paper is already the
light surface and the field the dark one, in the same screen.

## 7. Two structural options, weighed

**Option A — field shell with floating paper cards** (homepage composition applied literally): dark
field everywhere, every panel a paper sheet.
- *For:* maximum family resemblance, each section a "document".
- *Against:* a dense table on a floating sheet inside a dark field gives nested containers, cards-in-
  cards, and vertical gutters that waste a 1440 screen; scrolling long results becomes a column of
  separately shadowed sheets; the "Two Pennies Rule" (paper must carry real content) turns into
  "every panel is paper", which is the same failure as "every panel is a card".

**Option B — field frame, one ledger page** (chosen): the rail, top bar and outer gutter are the dark
room; the whole working area is a single cream page, with paper's small top radius, edge and shadow.
- *For:* tables sit on paper the way a register does; one continuous scroll; the field frames the work
  instead of competing with it; the largest surface is the one with the best contrast for text
  (`#1d2519` on `#ece0c6` ≈ 12.6:1) and the least glare for a bright office; on a projector the cream
  page is the slide; mobile simply drops the frame and the page fills the screen.
- *Against:* less dramatic at first glance than the homepage; must earn the material feel through the
  rail, the masthead rules, the wax marks and the paper edge rather than through many floating sheets.

**Chosen: B.** It is the human's instinct (dark shell, cream work surface) resolved into a single
material rather than a field of cards, and it satisfies both the register metaphor and the operating
context. Reasoning and rejected variants in `decisions.md` §D1.

## 8. Build order and the pilot

1. **Design system foundation** (`02-design-system.md`): app tokens, shell, masthead, section, paper,
   register table, chips, notes, figures, forms, drawer, empty/loading/error, mobile rules.
2. **Pilot: Dashboard.** Justification: it is the page every signed-in user lands on, and it exercises
   the shell, the masthead, the stage strip (a bespoke composition), figures, chips, notes, the
   loading skeleton, the error branch, the empty/no-run branch, and both breakpoints. It is not the
   simplest page (login) and not the riskiest (results tables), and it forces the *system* decisions
   that every other page inherits. Calibration after it, before anything else.
3. **Login** — establishes forms, field errors, the paper slip, and the public-to-app transition.
4. **Workspace chooser** — the register-list pattern.
5. **Students & Data** — upload, diff, applied; the file contract.
6. **Form & Collection** — link slip, meter, chase list, disclosure.
7. **Matching Runs** — the dense register + row actions + run history.
8. **Room results** — the densest table + drawer.
9. **Student results** — filters, distribution strip, review mode, drawer.
10. **Fairness** — the statement page, charts, drill-throughs.
11. **Manual checker** — the two-pane workbench.
12. **Student form** — the public mobile form and its receipt.
13. **Platform pages** — the internal register + impersonation.
14. **Harden** — journeys end to end, homepage regression, a11y, dead code, docs.

Order rationale: shell-first (the pilot proves it), then the pages that feed the pipeline in the order
a warden meets them, then the review surfaces that depend on the table pattern, then the two public/
internal edge surfaces, then hardening. Every page after the pilot reuses only components proven in
the pilot or introduced by the page immediately before it.

## 9. Self-review of this plan (harsh pass)

Fixed after review:

1. *Contradiction:* §5 gave `/login` "Start the demo" as primary while §3 lists `/login` as "open the
   desk — demo first". Resolved: demo is primary for visitors without an account; the email form is
   present but visually secondary, and copy says why.
2. *Gap:* the plan never said what happens to the four existing `StatCard` figures on the dashboard.
   Resolved: they become the four-stage readiness strip (each stage carries its own figure), so no
   data is dropped.
3. *Gap:* "no run" and "no students" are different empty states on the same page; the per-page contract
   now names both.
4. *Risk:* putting the workspace name inside the `<h1>` because a test asserts the exact string
   "Test Workspace Dashboard". Recorded in `decisions.md` §D9 with the layout that makes it read well.
5. *Risk:* removing `At-Risk Review` from the nav could look like a feature loss. It stays in the nav;
   the route stays; only the redirect flash is replaced by review mode on the destination page.
6. *Risk:* the student form's submit must stay reachable on a phone. Resolved: sticky action bar with
   the answered count; the existing submit copy is unchanged.
7. *Hard rule check:* no backend, auth, permissions, pricing or API change is proposed anywhere in
   this plan. The one code change outside the redesign is the two-line auth-token ordering fix already
   made (it removes a 401 burst on reload, no contract change).
8. *Anti-slop check:* no page in §5 uses "icon + heading + text" card grids; each page's composition is
   derived from its task (stage strip, intake lanes, link slip, register, workbench, form).
