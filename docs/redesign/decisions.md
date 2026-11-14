# Decisions

Every choice the brief asked me to log: decision, alternatives considered, reason. Newest last
within each phase.

## Phase 0–1

### D1 — App surface: dark frame with one cream ledger page (not dark cards on the field)
- **Options.** (A) Dark field everywhere with each panel a floating paper sheet, i.e. the homepage
  composition applied literally. (B) Dark rail/field frame with one continuous cream page per route.
  (C) A fully dark console with tables on green.
- **Chose B.** The app is a working document: a register is paper, and one continuous page gives
  dense tables a single reading surface instead of nested containers. It also gives the best
  contrast (12.6:1) on the largest area, which matters for long shifts and for a projector in a
  dean's office. C was rejected outright: `DESIGN.md` says paper carries the data, and a dark results
  table would invert the product's own material logic. A was rejected because it turns every panel
  into a card — the "Two Pennies Rule" run backwards — and wastes gutters at 1440.
- **Kept from the human's instinct:** dark shell, cream work surface. What changed is that the cream
  is one page, not a field of cards.

### D2 — Navigation grouped by the job, not the feature list
- **Options.** Keep seven flat links; group by Setup → Run → Review (chosen); collapse review pages
  under one section.
- **Chose Setup → Run → Review** with Dashboard above. The product's own sequence is prepare → run →
  review → sign; the rail should teach it. Seven flat links also made "At-Risk Review" look like a
  peer of "Dashboard" when it is a filtered view.

### D3 — No light/dark theme toggle
- **Options.** Add a toggle; keep one world.
- **Chose one world.** The app already contains both materials on one screen (field frame, paper
  page). A toggle would fork the system the brief forbids forking, and the homepage has no such
  affordance.

### D4 — Status colour comes from value, not hue
- **Options.** Keep the emerald/sky/amber/rose chip palette; map everything onto wax/amber/ink
  (chosen); a four-colour scale tuned to the palette.
- **Chose wax mark / amber attention / quiet.** `DESIGN.md` reserves amber for risk and forbids
  decorative accents. A four-hue rainbow would be a second palette inside the product and would make
  "Okay" compete with "at risk". Excellent/ready/completed get the wax mark (a mark a person left);
  Poor/at-risk/needs-review/failed get amber; the middle stays quiet. Hue is never the only carrier —
  every chip has its word.

### D5 — Registers, not cards: `DataTable` becomes the data container
- **Options.** Keep shadcn tables inside cards; a card per row on mobile; a register table that
  stacks into labelled rows on narrow screens (chosen).
- **Chose stacking.** Horizontal scrolling tables hide the most important column (score, or reasons)
  on a phone; a card per row is a different component per page. `data-stack="true"` reuses the same
  markup and prints each cell's label from `data-label`.

### D6 — Loading has its own vocabulary
- **Options.** Keep `InlineAlert` "Loading segments — Preparing segment filters…"; a spinner;
  static skeletons shaped like the content plus a mono note (chosen).
- **Chose skeletons.** An alert-shaped loading state reads as a permanent notice and made slow
  queries look broken. Motion is out of scope this pass, so the skeleton is static — it rests in a
  legible state, which is the same rule the homepage follows under reduced motion.

### D7 — Two-line auth fix before baseline
- **What.** `AuthProvider` called `setApiToken(token)` in an effect, which runs after child query
  effects; on every hard reload with a stored demo token the page fired `/api/auth/me`,
  `/api/workspaces` and the dashboard request with no bearer token, got three 401s, then recovered
  through React Query retries. Fixed by calling `setApiToken(appSessionToken)` in the bootstrap,
  before state is set.
- **Why it is in scope.** The brief requires no console errors and honest loading states; the 401
  burst was visible in the first baseline captures as a page that never resolved. No contract,
  permission or backend change.
- **Consequence.** Baseline screenshots were re-taken after the fix so before/after compare design,
  not a race. The pre-fix captures are in `.impeccable/review/app/debug/`.

### D8 — Capture harness runs on its own port with CORS disabled
- **What.** `scripts/capture-redesign.mjs` drives Chromium against `127.0.0.1:5175` with
  `--disable-web-security`.
- **Why.** The brief requires a private port so the other agent's HMR does not corrupt screenshots;
  the backend CORS allowlist only knows `5173`, so a second origin is rejected. Disabling web
  security affects the capture browser only, never the app or the repo.

### D9 — Dashboard test: assert the heading and the workspace separately
- **What.** `admin-dashboard.test.tsx` asserted `getByText("Test Workspace Dashboard")`, which forced
  the workspace name to be a single text run inside the `h1` and prevented setting it as data.
  Replaced with `getByRole("heading", { level: 1, name: "Dashboard" })` **plus**
  `getByText("Test Workspace")`.
- **Why.** Testing Library's string matcher reads an element's own text nodes, so any styled child
  breaks the assertion; the old string encoded a layout decision into a test. The replacement asserts
  strictly more (a real `h1` with the right name, and the workspace attribution in the dateline) and
  is not a relaxation.
- **Alternatives.** Keep the concatenation and set the whole line in 34px serif (wrong type role for
  data); a visually-hidden duplicate string (a test that can drift from what is shown).

### D10 — Routes stay exactly as they are
- **What.** No route added, removed or renamed. `/at-risk-review` keeps its redirect; `/admin/*` keeps
  redirecting to `/app`.
- **Why.** Hard Rule 6. The only IA change is that the destination page now *says* it is in review
  mode instead of flashing a redirect notice.

### D11 — Magic Fill is demoted, not removed
- **What.** Workspace-wide Magic Fill moves from the dashboard header into a closed disclosure below
  the run block; per-segment Magic Fill stays on the matching-runs register as a labelled row action.
- **Why.** It writes synthetic preference data — a rehearsal tool, not a step in the pipeline. In the
  header it was the loudest control on the page (amber text) and it competed with "Run matching".

### D12 — Hand-written CSS classes instead of extending Tailwind
- **What.** `frontend/src/app/desk.css` carries tokens and component classes; Tailwind stays for
  layout utilities that already exist.
- **Why.** The homepage already proved this pattern (`home.css`); it keeps the palette in one file,
  gives real `data-tone` variants without class soup, and avoids touching `tailwind.config.ts` beyond
  what the other agent owns. No dependency added.

### D13 — No Lighthouse CLI; measured proxies instead
- **What.** Lighthouse is not installed and adding it is forbidden this pass. Performance is measured
  with Playwright (`LCP`, `CLS`, `domContentLoaded`, transferred bytes) plus the bundle sizes from
  `npm run build`.
- **Why.** Honest measurement beats a skipped gate. The proposal to add Lighthouse in CI is in
  `04-open-questions.md`.

## Phase 4 (pilot calibration)

### D14 — The dashboard's next action is derived, and it is the only primary
- **What.** A rule set turns `setup_status`, `form_collection_stats` and `segments_status` into one
  sentence and one button ("Upload the students file" → "Add the room list" → "Share the form" →
  "Open matching runs" → "Run matching" → "Read the proposal").
- **Why.** The old page had four equal-weight header buttons and no answer to "what now?". The rule
  uses only real fields; where a state is unknown it falls back to the least specific sentence.

### D15 — Stage strip rules instead of progress bars
- **What.** First version drew a fill bar per stage; Roster/Rooms are binary, so four full wax bars
  read as decoration and made three of four stages look like warnings.
- **Now.** A 2px rule under each stage reports state (paper-mid pending, ink settled, amber
  attention). Real ratios keep a proper meter (collection, score, distribution).

### D16 — Directive is not a note
- **What.** The next-action band started as `.desk-note` (the alert component) and looked like a
  warning. It is now `.desk-directive`: one sentence + one button between hairlines, no fill, no
  tone. Alerts keep the note shape so a warning always looks like a warning.

### D17 — Language and structure lessons applied to every later page
1. Mast = title + mono dateline (workspace · run · segment) + one lede + secondary actions only.
2. The primary action lives where the task is, never twice.
3. Every number carries its unit and its scope; every figure row is ruled, not boxed.
4. Loading is a skeleton of the thing that will arrive, with a mono note.
5. Amber only ever appears next to a state a person must act on.
6. If a page can be read in one scroll at 1440 without a card grid, it should be.

## Phase 5 (hardening)

### D18 — Wax is for marks and actions; ink carries measurements
- **What.** Proportion bars (collection meter, score bars, label distribution) are drawn in `paper-ink`;
  only the below-floor/at-risk state switches them to amber.
- **Why.** The first pass drew every bar in wax, so the fairness page was four red rules and the
  collection meter was a red line across the page. Wax must stay scarce to mean "a person's mark";
  measurements are evidence and belong in ink, exactly as `DESIGN.md` splits the roles.

### D19 — Small controls get a 24px floor, not padding all over the page
- **What.** Text links in table cells, the rail wordmark, "Switch workspace" and chip-buttons are
  `min-height: 24px` (`button.desk-link`, `.desk-chip` as button). Table rows stay 40px.
- **Why.** WCAG 2.2 AA target size is 24×24 for pointer targets. Raising every row to 30px+ would
  have cost ~15% more height across 96-row registers for no legibility gain. `scripts/audit-redesign.mjs`
  enforces the 24px floor at 375 and 1280 and treats label-wrapped inputs as one target.

### D20 — Paper resets the text colour
- **What.** `.desk-paper` and `.desk-sheet` set `color: var(--paper-ink)`.
- **Why.** Field pages set `color: var(--ink)` (cream) on the canvas root; any unstyled text inside a
  paper object on those pages inherited cream-on-cream. Caught on the platform console before shipping.

### D21 — The student form composes its own public URL
- **What.** `FormLinkResponse` marks `form_url`/`expires_at` optional; the page builds
  `${window.location.origin}/f/${token}`.
- **Why.** The backend returns only a token, so Copy/Open were dead controls. Frontend-only fix, no API
  change; proposal to return the URL server-side is in `04-open-questions.md` §2.

### D22 — Four test edits, all replacing presentation assertions
`test/admin-dashboard`, `test/components/student-detail-panel`, `test/pages/manual-checker-page` (×2).
Details and justification in `deviations.md` §6. Nothing was deleted, skipped or loosened: the dashboard
assertion now checks a real `h1` plus the workspace attribution; the emoji assertions became text
assertions; the duplicated-disclaimer assertion became a single-copy assertion.

### D23 — Evidence tooling stays in the repo
- **What.** Four small scripts in `frontend/scripts/`: capture (routes × widths), pixel diff (canvas,
  no dependency), perf proxy (LCP/CLS/bytes), and an a11y/overflow/console audit.
- **Why.** The brief demands measured evidence; these are how it was produced and how the next pass can
  reproduce it. They are not imported by the app and add nothing to the bundle. The homepage's
  `capture-showcase-screenshots.mjs` set the precedent.

### D24 — The Impeccable detector's five findings were fixed, not waived
- **What it found.** Five `side-tab` warnings — a coloured rule down the left edge of a component
  (notes at 3px, the form-link slip at 3px, toasts at 3px, and 2px inset stripes on attention rows).
- **What changed.** Notes, the slip and toasts now use a 1px tone-coloured border all round plus a
  tinted fill; attention rows and selected rows use a wash of the tone colour instead of a stripe.
  The tone is carried by the border colour, the fill, the title text and the chip's word.
- **Why.** `DESIGN.md` already says "Hairlines are 1px; the only decorative rule over 1px is the 2px
  wax tick", so the thick edge was also a self-inconsistency. Removing the stripes made the rows
  quieter and left the chip as the single carrier of the word "at risk".
- **Re-run:** `impeccable detect` over `desk.css`, every page, component and layout → **no findings**.
