# 03 — Progress

**Phase:** 8 — done (holistic review + hardening) · **Branch:**
`feat/homepage-motion-and-app-redesign` (no git commands run by this agent; the human commits)
**Frozen homepage:** `68551b6` (motion pass) + `3caf886` (root canvas `#07110b`)
**Baseline commit of the static app:** `f5a3140` · **Date:** 2026-11-15

## How to run

```powershell
cd frontend
npm run dev -- --port 5175 --strictPort        # own port; :5173 stays clean
npm run test                                    # 23 files / 57 tests
npm run typecheck
npm run build

# evidence
node scripts/capture-redesign.mjs --out .impeccable/review/motion-app/after --tag after --motion off --widths 375,768,1280,1920
node scripts/verify-resting-states.mjs --base http://127.0.0.1:5175     # motion off vs no stylesheet
node scripts/verify-motion-modes.mjs --base http://127.0.0.1:5175       # full / reduced / off
node scripts/record-motion.mjs --base http://127.0.0.1:5175 --out ../.impeccable/review/motion-app/video
node scripts/motion-stills.mjs --url "/app/:ws/dashboard" --auth --out ../.impeccable/review/motion-app/stills/x
node scripts/trace-motion.mjs --base http://127.0.0.1:5175 --out ../.impeccable/review/motion-app/after --settled
node scripts/verify-home-tokens.mjs --base http://127.0.0.1:5175 --out ../.impeccable/review/motion-app/tokens-after
node scripts/audit-redesign.mjs --base http://127.0.0.1:5175
```

**Disable motion:** `window.__setMotion("off")` (persisted), `__setMotion("reduced")`, `__clearMotion()`.
Tests force it off in `src/test/setup.ts`.

## Phases

| Phase | Status |
|---|---|
| 1 Research + motion language | done — `design-language.md` |
| 2 Plan + directions | done — `01-plan.md` |
| 3 Baseline | done — screenshots (80), vitals, Lighthouse ×4, traces/chases (4×CPU) |
| 4 Foundation | done — `motion.css`, `lib/motion.ts`, switch, tokens promoted |
| 5 Pilot (dashboard) + calibration | done — lessons in `decisions.md` D6 |
| 6–7 Pages | done — table below |
| 8 Harden | done — tests, switch, reduced motion, homepage regression, metrics |

## Per page — what moves

| Page | Motion | Duration | Notes |
|---|---|---|---|
| Shell (all routes) | active rail tick draws; buttons press | 160 / 160 | no content fade; no page transition cost |
| Dashboard | skeleton breathe; four stage rules draw (28ms stagger); rule colour on state change; empty state + risk note lift; Magic Fill toast | 1.8s loop · 320 · 320 · 320 · 160 | first paint static; rules are the authored beat |
| Login | paper slip rises 8px + fades; demo/sign-in press | 560 · 160 | one scene; LCP unaffected |
| Chooser | **none** | — | 1–3 rows; motion adds nothing |
| Students & Data | proof sheet fades in; "Applied" stamp presses; notes lift | 160 · 320 · 320 | upload steps keep their place |
| Form & Collection | link slip border on copy; regenerate note lifts; collection meter fills | 160 · 320 · 320 | link unchanged |
| Matching Runs | inline result note lifts; toasts; buttons | 320 · 160 | no row choreography |
| Room results | drawer sheet + scrim; selected row tint (colour) | 320 / 160 · 160 | rows static |
| Student results / At-risk | same drawer; row tint; review note lift | 320 · 160 | rows static |
| Fairness | distribution bars fill (28ms stagger), card stackbars fill, floor cards lift | 320 · 160 | numbers visible immediately |
| Manual checker | result panel lifts; validation text is instant | 320 | no shake, no delay |
| Student form | success receipt stamps; **nothing on the 12 questions** | 320 | step crossfade cut after +81ms TBT (D6) |
| Platform console | buttons, toasts only | 160 | internal, dense |

## Evidence (all under `.impeccable/review/motion-app/`, gitignored)

- `baseline/` — 80 screenshots (20 routes × 4 widths) before any motion code; `vitals.json`;
  `lighthouse-{home,login}-{desktop,mobile}.json`; `frames.json` + `trace-*.zip` (4×CPU, load).
- `after/` — the same 80 with `--motion off`; `vitals.json`; Lighthouse ×4 (+2 login-mobile re-runs);
  `frames*.json` (load and settled, motion on and off).
- `tokens-before/`, `tokens-after/` — computed `--m-*` on `.mm-home` + homepage stills at 1280.
- `video/` — `dashboard-load`, `drawer`, `fairness-load`, `login-load`, `route-change`, `home-hero`.
- `frames/` — extracted frames per recording.
- `resting.json`, `resting-fail/` — motion-off vs stylesheet-removed comparison.

## Results

| Metric | Baseline (`f5a3140`) | After motion |
|---|---|---|
| JS bundle | 736.93 kB (214.08 gzip) | **738.39 kB (214.47 gzip, +0.39 kB gzip)** |
| CSS bundle | 88.04 kB (17.74 gzip) | **91.93 kB (18.40 gzip, +0.66 kB gzip)** |
| Tests | 23 files / 57 | 23 files / 57 (unchanged) |
| typecheck / build | clean | clean |
| LCP (prod, 1280) | home 732 · login 388 · dashboard 400 · runs 384 | home 712 · login 376 · dashboard 384 · runs 392 |
| CLS (prod, 1280) | 0.0041 / 0.0005 / 0.0014 / 0.0174 | 0.0041 / 0.0005 / 0.0014 / 0.0531¹ |
| Lighthouse home desktop/mobile | 0.69 / 0.67 | 0.70 / 0.69 |
| Lighthouse login desktop/mobile | 1.00 / 0.90 | 1.00 / 0.91 (runs: 0.87, 0.89, 0.91)² |
| Audit (12 routes × 375/1280) | CLEAN | CLEAN |
| Resting states | — | 5 data-stable routes **byte-identical** at 4 widths; motion-off vs no-stylesheet: 25 of 26 route/width pairs **0 px**, one pair differs only inside a single text line's box (antialiasing)³ |

¹ matching-runs CLS varies 0.0136–0.0531 between runs on both builds (skeleton→table); all values are
"good" (< 0.1) and the change is not attributable to motion (identical when the switch is off).
² three runs: 0.87, 0.89, 0.91; baseline 0.90. Within run noise (see `open-questions.md` §4).
³ 26 route/width pairs at 375/768/1280/1920: 25 identical; `students-risk` differs only inside one text
line's bounding box (3.8k px at 1920, 8.9k at 1280) with **identical layout boxes** and no colour or font
property applied by `motion.css` to that element — subpixel text rasterisation changing when the sheet
is removed at runtime. Two 24 px cases appeared once each in earlier runs and did not reproduce.

## Next action

Nothing pending. Hand the file list below to the human for per-page commits.

## File list (per page / per concern)

**Foundation**
`frontend/src/app/motion.css` (new), `frontend/src/lib/motion.ts` (new), `frontend/src/main.tsx`,
`frontend/src/test/setup.ts`, `frontend/src/components/home/home.css` (token block removed)

**Shell / boot**
`frontend/src/App.tsx`, `frontend/src/layouts/AdminLayout.tsx` (no markup change — the tick is CSS)

**Dashboard (pilot)**
`frontend/src/pages/AdminDashboard.tsx` (m-lift on the risk note + latest-run empty state),
`frontend/src/components/EmptyState.tsx` (`className`), `frontend/src/components/InlineAlert.tsx` (m-lift)

**Login**
`frontend/src/pages/LoginPage.tsx` (m-slip)

**Chooser**
none (deliberate)

**Students & Data**
`frontend/src/components/DiffPreviewPanel.tsx` (m-fade), `frontend/src/pages/AdminStudentsData.tsx` (m-stamp)

**Form & Collection**
`frontend/src/pages/AdminFormCollection.tsx` (data-copied, m-meter, m-lift)

**Matching Runs**
`frontend/src/components/InlineAlert.tsx` (shared, already listed)

**Results + drawer**
CSS only (`motion.css` drawer/toast/rows) — no page files changed

**Fairness**
CSS only (bar fill + stagger) — no page files changed

**Manual checker**
`frontend/src/components/checker/CheckerResultPanel.tsx` (m-lift)

**Student form**
`frontend/src/pages/StudentForm.tsx` (m-stamp on the receipt; no step motion)

**Platform**
none beyond shared buttons/toasts

**Evidence tooling (not shipped; commit separately or drop)**
`frontend/scripts/motion-stills.mjs`, `record-motion.mjs`, `trace-motion.mjs`,
`verify-home-tokens.mjs`, `verify-resting-states.mjs`, `verify-motion-modes.mjs`,
`capture-redesign.mjs` (`--motion` flag)

**Docs:** `docs/motion/{design-language,01-plan,02-system,03-progress,decisions,deviations,credits,open-questions}.md`
