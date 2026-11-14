# OPTIONAL INPUTS (leave blank; the agent infers from the repo and docs)
- Key flows that matter most:
- Off-limits (must stay exactly as is: legal text, pricing, signed-off layouts):
- How to run locally + test accounts/roles/seed data:
- Product voice in a few words, and who the users are:
- Reference sites I like:
- Primary device: mobile-first / desktop-first / equal
Blank means you decide. Infer from the repo, docs, and homepage. For login-gated pages with no credentials provided, look for seed scripts, fixtures, or test accounts in the repo. If none exist, create local-only fixtures or mocked auth state in the dev environment. If that is impossible, log it and redesign that page from its code and states, noting the limitation.

# GOAL

The homepage is finished and final. It is my design source of truth. Every other page needs a full redesign: UX, flow, information architecture, content, layout, and visual design. I'm not satisfied with any of it today. These pages must be top tier and feel like the same product as the homepage.

Be bold. You may go beyond the existing .md docs and improve flow, structure, copy, and composition, as long as the app's core functionality and purpose keep working as intended. This is a static redesign only: no animations, transitions, or motion work (the homepage's motion system will be extended to these pages later). Build so that door stays open: clean semantic structure, stable component boundaries, nothing that fights future motion. Basic hover, focus, and pressed states are fine.

You have full autonomy over the "how". Use /impeccable's skills throughout, wherever they apply, at every stage: research, UX planning, design system, building, critique, and polish.

# AUTONOMY (run end to end in one go)

- **Do not stop to ask me anything.** There are no checkpoints. Run every phase and every page through to the final report in one continuous run.
- When you face a decision, weigh the options, choose the best one by the bar below, and log it in `docs/redesign/decisions.md` (decision, alternatives considered, reason). When unsure, choose the more conservative, lower-risk option.
- If something fails twice, log it in `docs/redesign/04-open-questions.md`, take the safest fallback (ship the simpler version or skip that piece), and keep going. Never hack around a problem, and never stall or idle.
- My review is replaced by stricter self-review: the pilot calibration, the evidence requirements, and the critique loops below. Treat them as real gates.

# HARD RULES

1. **Homepage is frozen.** Record its commit hash and the files, components, and tokens it depends on. Before editing any shared component or token, check whether the homepage uses it. If it does, create a variant or new component instead, unless you can prove the homepage stays pixel-identical.
2. **Functionality survives.** Auth, data flows, forms, permissions, validation, routing, and API contracts all keep working. Do not change the backend, database, data model, permissions, auth, or pricing, and do not remove any feature. If a UX improvement would truly need one of these, don't implement it. Log the proposal in `04-open-questions.md` and ship the best design that works within current functionality.
3. **Never invent facts.** No made-up stats, testimonials, customer names, features, pricing, certifications, or legal text. Write copy only from what the product actually does. Where real content is missing, use a clearly marked placeholder and list it in `docs/redesign/placeholders.md`.
4. **Stay non-destructive.** Use local/dev environments, fixtures, and mocks only. Never run destructive actions against production data or real third-party services. Never print, log, or commit secrets or `.env` contents.
5. **Never weaken tests.** Don't delete, skip, or loosen tests to get green. If a test is genuinely wrong, fix it minimally, and log why in `decisions.md`.
6. **URLs and SEO.** Keep existing routes or add redirects. Preserve metadata, analytics, and accessibility landmarks unless improving them.
7. **Git:** work on a new branch, at least one commit per page, in logical steps. Never push, merge, or open a PR. Don't commit baseline screenshots, recordings, or traces.
8. **Log every departure from the official docs** in `docs/redesign/deviations.md` with the reason.
9. **Skills are a floor, not a ceiling.** /impeccable's skills guide the work, but the result must still pass this brief's checks (homepage consistency, functionality, tests, accessibility, evidence). A skill's output is not proof that something is done.

# CONTEXT AND MEMORY MANAGEMENT (critical: you have a 1M-token window, but quality degrades long before it fills)

- First action: save this entire prompt as `docs/redesign/00-brief.md`.
- `docs/redesign/` is your durable memory: brief, research, UX plan, design language, design system, decisions, progress, deviations, placeholders, open questions. Anything important that lives only in your context will be lost at compaction, so write it to these files as you go.
- Keep `03-progress.md` current at all times: current phase, pages done, pages remaining, the page in progress and its exact status, which /impeccable skills you used where, the baseline artifact locations, the homepage commit hash, how to run the dev server and tests, and a precise "Next action" line.
- **Compact proactively.** Compact your context when any of these is true: you've finished a page, you've finished a phase, your context passes roughly 400-500K tokens, or you notice you're re-reading or repeating yourself. Don't wait for the limit.
- **Before every compaction:** update `03-progress.md` and `decisions.md` so a fresh context can resume from the files alone. Then compact (use the harness's compact command if one exists), directing the summary to preserve: the brief's hard rules, the design language essentials, the current page's spec, open issues, and the Next action.
- **After every compaction:** re-read `docs/redesign/` (00-brief, design-language, 02-design-system, 03-progress, decisions) before doing anything else. Follow `00-brief.md` as the source of truth, not your memory of it.
- **Keep context lean.** Don't dump large files, long logs, or whole directories into context. Read targeted ranges, grep first, and summarize test and build output. Screenshots are expensive: view only what you need, at the resolution you need, and record conclusions in text, then move on. Prefer sub-agents for broad exploration or repetitive verification if your harness supports it, so the main context stays focused.

# PHASE 0: SETUP

- Verify your tooling: the dev server runs and Playwright (or equivalent) works for capturing screenshots.
- Confirm a clean git state (stash or commit nothing of mine; if the tree is dirty, branch from the current state and note it), create the branch, and record the homepage commit hash.

# PHASE 1: RESEARCH AND UNDERSTAND (change nothing)

- Identify the stack, routing, tokens, component library, and how the homepage is built. Extract its design language precisely (type, color, spacing, grid, radius, density, tone of voice, component patterns, personality) into `docs/redesign/design-language.md`.
- Read all docs and .md files for purpose, audience, and intended behavior.
- Inventory every non-home page and route, including system pages: auth, settings, legal, 404/500/error, empty or maintenance pages, and email templates if they're in the repo. For each, record purpose, content, components, states (empty, loading, error, success, no-permission, edge cases), who uses it, and how users arrive and leave.
- Map the real user journeys end to end, and the data and functionality behind each page.
- Baseline: screenshots of every page at 375 / 768 / 1280 / 1920 px (including authenticated views and states), Lighthouse scores, and bundle size. Store these outside version control and record their location in `03-progress.md`.
- Protect critical flows: run the existing tests, and where coverage is thin, write end-to-end tests for the key flows so functionality can be proven preserved afterward.
- Write `docs/redesign/00-research.md`: what each page is for, what's wrong with it (UX, flow, content, visual), and what the product needs from it.

# PHASE 2: HOLISTIC UX PLAN

Write `docs/redesign/01-ux-plan.md`:
- Core jobs-to-be-done and ideal journeys across all pages.
- Target information architecture: sitemap, navigation model, hierarchy, and how pages connect to the homepage and each other. Remove, merge, split, or reorder pages if it improves flow (log in deviations, with redirects per Hard Rule 6).
- Per page: single main purpose, primary and secondary actions, content hierarchy, sections, required states, and definition of success.
- Content strategy in the homepage's voice. No lorem ipsum, no filler, no generic SaaS phrasing, no invented claims (Hard Rule 3).
- Design direction: where pages match the homepage exactly, and where app pages legitimately need different density or structure (forms, tables, dashboards) while still feeling like the same product.
- At least two alternative flow/structure options, weighed, with the chosen one justified in `decisions.md`.
- Build order with reasoning, and the pilot page: the most representative page, one that exercises the most components. Not the simplest, not the riskiest.

Then run a harsh self-review of the plan with the relevant /impeccable skills: look for gaps, contradictions, flows that lose functionality, and anything that violates the Hard Rules. Fix it, then proceed directly to Phase 3. Do not wait for approval.

# PHASE 3: DESIGN SYSTEM FOUNDATION

Extend the homepage's language into reusable building blocks for the rest of the app. Reuse and extend existing tokens and components. Never fork a second system, and don't add a component library.
- Cover what app pages need that the homepage doesn't: shells and navigation, forms and inputs, buttons, tables and lists, cards, modals and drawers, tabs, badges, toasts, empty/loading/error states, pagination, and filters, as relevant.
- Every component gets all its states (default, hover, focus, active, disabled, loading, error), in light and dark mode if the site supports both.
- Consolidate duplicated styles. Document in `docs/redesign/02-design-system.md`.

# PHASE 4: REBUILD, PILOT FIRST, THEN ONE PAGE AT A TIME

Follow the build order, starting with the pilot page. Finish each page before starting the next. For each page:
1. Write a short page spec (purpose, layout, content, states) in `03-progress.md`.
2. Rebuild the UI and content to the new UX and design system.
3. Implement every state: empty, loading, error, success, no-permission, long content, many items, zero items, and edge cases.
4. Verify at 375 / 768 / 1280 / 1920 px with real screenshots, which you actually look at. No horizontal overflow, nothing cramped or awkward in between.
5. Verify accessibility: semantic HTML, heading order, labels and form errors, keyboard navigation with visible focus, contrast, screen-reader sense, touch target sizes.
6. Confirm functionality against the protected flows. Run build, lint, typecheck, and tests. No console errors or warnings.
7. Critique the page as a ruthless senior design director using the relevant /impeccable skills, fix what's weak (up to 2 rounds), update `03-progress.md`, commit, and compact if due.

**Pilot calibration (replaces my review).** After the pilot page, critique it as if you were me seeing it for the first time. Compare it side by side with the homepage and ask: does this feel like the same product? Is it generic or template-like? Is the density right for a working UI? Then adjust the page and the design system based on what you find, record the lessons in `decisions.md`, and apply them to every remaining page. Only then continue.

# PHASE 5: HOLISTIC REVIEW AND HARDENING

- Walk every key journey end to end as a first-time user and as a returning user. Check navigation, repeated patterns, tone, density, and consistency. Fix inconsistencies.
- Homepage regression check: diff against the recorded commit and compare before/after screenshots at all four widths.
- Re-run the full test suite, Lighthouse, and bundle size against baseline. Performance and accessibility must not regress.
- Run a final critique over the whole app with /impeccable's skills (up to 3 rounds, stopping early if nothing meaningful remains). Hunt for: inconsistent components, weak empty/error states, leftover old styling, dead code, broken links, contrast failures, text overflow, and anything still generic or template-like.
- Delete dead code and unused components from the old UI.
- Confirm `placeholders.md`, `deviations.md`, `decisions.md`, and `04-open-questions.md` are complete and accurate.

# THE BAR

- **Anti-slop:** no template look, no default component-library feel, no filler copy, no decorative clutter, no cards-in-cards, no gradients or effects just because they're available. Every layout decision comes from the page's purpose and the user's task.
- **Cohesive:** same voice, visual language, and quality as the homepage.
- **Purposeful UX:** obvious main action, less friction, clear hierarchy and wayfinding, graceful failure.
- **Accessible and responsive:** WCAG AA minimum; fully usable on mobile, keyboard, and screen reader.
- **Efficient:** no heavier or slower than before. Add a dependency only if it clearly earns its place, after checking license, size, and maintenance status via web search.
- **Proven:** nothing is done without evidence: screenshots, passing tests, measured numbers.

# FINAL REPORT (concise, written when everything is done)

1. New product structure and flow, with reasoning
2. Page by page: what changed and why
3. Key decisions, every deviation from the docs, and every placeholder I need to fill (point to `decisions.md`, `deviations.md`, `placeholders.md`)
4. Any functionality, route, or API changes (should be minimal or none), redirects added, and proposals I should review from `04-open-questions.md`
5. Before/after evidence: screenshots, Lighthouse, bundle size, tests, homepage regression check
6. Known limitations and what I should check manually
7. Animation-pass readiness: where motion should go and how the structure supports it

Begin now and run to completion without stopping. Write no UI code until `01-ux-plan.md` is complete and self-reviewed.
