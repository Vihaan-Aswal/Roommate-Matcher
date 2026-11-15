# 01 — Motion plan

> Written after reading `docs/motion/design-language.md`, `docs/redesign/` and the homepage motion
> record. No motion code exists yet.

## The job

The app is a desk people use every day. Motion here is not the argument (that was the homepage); it is
the hand on the paper: it orients, confirms, and explains cause and effect. Frequent actions stay
under ~120ms and nearly invisible. Rare moments (first-run, success, auth) may take 320–480ms. Nothing
delays input, navigation or reading. The resting designs are final and must not move a pixel.

## Directions considered

**A. The Mark — chosen.** Every state change is a mark on paper: a rule draws, a sheet lifts, a stamp
presses, a drawer slides out of the file. It is the homepage's grammar (*a rule is drawn, then the
material it governs settles*) applied to tools, with every duration pulled down: feedback 120ms,
change 200ms, scene 320ms, rare 480ms. Nothing loops, nothing animates content on first paint, and
dense surfaces are still. The signature moments are small and material: the four stage rules drawing,
fairness bars filling once, the drawer's sheet, the applied/success stamp.

**B. The Ledger — rejected.** Choreographed data: numbers count up, every table row cascades, bars
redraw on every filter. It is the homepage's own *The Sort* direction, which the homepage rejected as
an overall system ("explains the algorithm, not the product"). In a tool it is worse: motion on a
register costs scanning time, and `prefers-reduced-motion` users would lose information the static
design already gives them. Kept only where a proportion is the message (fairness bars, once).

**C. The Press — rejected.** Every panel stamped in sequence. Uniform rhythm is the anti-slop failure
("everything fades up"), it delays content behind a queue, and it would make the dashboard feel slower
than the page it replaced.

| | A. The Mark | B. The Ledger | C. The Press |
|---|---|---|---|
| Speaks the homepage's language | yes (rule → material) | partly (data only) | yes (stamp) |
| Cost to a warden | near zero on frequent actions | high on dense surfaces | delays every visit |
| Performance risk | CSS transforms only, first paint untouched | per-row work | queued entrances |
| Fits "elevation, not redesign" | yes | no (adds motion to content) | no (changes rhythm) |

## What stays identical to the homepage, and what is deliberately calmer

| Stays identical | Calmer / faster | Why |
|---|---|---|
| Easing curves (`--m-ease-out`, `--m-ease-in-out`) | — | same hand; no second set of curves |
| 28ms stagger, capped | cap 168ms in the app (6 steps) | lists are 4–8 items, not 24 |
| Rule-then-material grammar | scene 320ms instead of 560ms | a tool should settle, not perform |
| Lite/reduced vocabularies, final values | no 5.4s sequence anywhere | no showpieces inside the desk |
| No bounce, no elastic, no loops | — | physical deceleration only |
| No layout-property animation | — | transform/opacity only |

## The rules this pass is built on

1. **First paint is never animated.** The masthead, `h1`, page description, figures, the directive, the
   table's first rows and the form's first field render final. Nothing on screen starts at
   `opacity: 0`, so LCP is never gated by motion and there is no flash of unanimated content.
2. **Dense working surfaces are still.** Register rows, table cells, numbers, filters, the segmented
   control, the 12 questions and the option rows get **no** entrance, hover or selection motion. Their
   only motion is a colour confirm ≤120ms (row tint, copy confirmation).
3. **Frequent actions ≤ 120ms, state changes 200–320ms, rare moments ≤ 480ms.** Presses, toggles,
   draw-open/close, copy, step changes.
4. **Rules draw, material settles.** Entrances that exist are a 1px rule drawing (`scaleX`) followed by
   a 2–6px lift, never a uniform fade-up of everything.
5. **Nothing runs in a loop** except the skeleton breathe (a waiting state, opacity only), which is
   paused offscreen and killed by reduced motion and the switch.
6. **No renderer.** No WebGL, canvas, particles or 3D. The world is flat paper and wax; the homepage
   rejected 3D for good reasons that apply double to a working desk. "Signature graphics" are the
   stage rules, the fairness bars, the drawer sheet and the stamp — all CSS, all compositor-only.
7. **Route changes are not fades.** The content paints immediately; the only route signal is the
   masthead rule drawing (160ms) and the rail's active tick fading in (120ms). A content fade would
   trade LCP and perceived speed for decoration.

## Categories, evaluated once (applies to every page)

| Category | Decision |
|---|---|
| Route transitions | No content transition. Masthead rule draws 160ms; active rail tick fades 120ms. |
| Load choreography | Skeletons breathe (opacity 1.6s) → content replaces them instantly; below-the-fold stage rules draw (160ms, 60ms stagger). Never on first-paint content. |
| Component motion | Buttons press 1px (90ms); selects/popovers keep their instant open (Radix) — no scale/fade theatre; toasts rise+fade 160/120ms; drawer sheet slides 220ms with a 160ms scrim. |
| State feedback | Step changes (upload step, form step, run pending) crossfade 120–160ms; applied/success stamps press 320ms; copy confirmation colour flip 120ms; validation lines appear with the field, no shake. |
| Scroll / layout | Sticky rail unchanged; no scroll-linked effects; no scroll-jacking; disclosures animate height via CSS `grid-template-rows`? **No** — height animation is a layout property; disclosures stay instant. |
| Graphics (2D/3D) | None beyond CSS-drawn rules and bars. Justified in "not animated" below. |
| Ambient | None behind working UI. The skeleton breathe is the only repeating motion, and only while waiting. |

## Per page — what moves, why, timing, fallback

| Page | Motion | Why | Timing |
|---|---|---|---|
| **Shell** (every route) | masthead rule draws; active rail tick fades; mobile menu opens instantly (native `<details>`) | orientation without delaying content | 160 / 120ms |
| **Dashboard** (pilot) | skeletons breathe; on load the four stage rules draw left→right (60ms stagger); stage rule colour transitions when a state changes; empty state lifts 4px; Magic Fill toast | the page's job is "is it ready, what next" — the rules drawing is the one authored beat | 160ms per rule, 240ms total; state 200ms |
| **Login** | the paper slip lifts 8px + fades 420ms; the mono footer fades 600ms; demo button press | first impression, auth is allowed to be richer | ≤ 600ms, once |
| **Chooser** | rows lift 3px with 30ms stagger (translate only, no opacity) | shows the list is a list, keeps LCP paint | 180ms, cap 120ms |
| **Students & Data** | step 1 → 2 crossfade 160ms; applied stamp presses 320ms | cause and effect: the file was read, then written | ≤ 320ms |
| **Form & Collection** | copy confirmation flip 120ms; regenerate confirm appears with a 160ms lift; slip border tints when copied | the link is the object; confirmation only | ≤ 160ms |
| **Matching Runs** | run button label change 120ms; when a run completes the history row lifts 4px (translate only) | cause and effect once, no list choreography | 160ms |
| **Room results** | drawer sheet 220ms + scrim 160ms; selected room tint 120ms | opening a record is a place-change | ≤ 220ms |
| **Student results / At-risk** | same drawer; row tint 120ms; filtered-empty state lifts 4px | same | ≤ 220ms |
| **Fairness** | distribution bars fill once (`scaleX` 0→value, 120ms stagger, 320ms); floor rule draws after them (160ms) | proportion is the message; numbers visible from the start | ≤ 480ms total |
| **Manual checker** | validation line colour/opacity 120ms; result panel lifts 4px when the reading arrives | confirmation, no waiting | ≤ 160ms |
| **Student form** | step change crossfade 120ms; success receipt stamps 320ms. **Nothing else** — no question, option, scroll or progress motion | a phone form must never make anyone wait | ≤ 320ms, twice |
| **Platform console** | none beyond toasts | internal, dense | — |
| **Empty / error / no-permission states** | 4px lift + fade 200ms when they appear | a state changed; acknowledge it | 200ms |

## Deliberately not animated

- Register and table rows, cells, numbers, scores, chips: no entrance, no hover motion (hover tint is a
  colour transition only where it already exists).
- The 12 questions, option rows, progress text and submit bar on the student form.
- Filter controls, segmented controls, selects, checkboxes.
- Headings, body copy, figures, the directive line — anything in the first viewport.
- The paper/fibre texture, the field gradient, the light pool. No parallax, no grain, no drift.
- Icons, arrows, the wordmark, the rail (except the active tick), the impersonation banner.
- Disclosures and the mobile menu: native, instant. Animating height would be a layout property.
- No counters, no typewriter text, no number odometers, no confetti, no cursor effects.
- No 3D/WebGL/canvas: the world is flat paper; a renderer would be a costume and a bundle.

## Foundation (built before pages)

- Tokens: promote the nine `--m-*` declarations to `:root` in one shared stylesheet so the app and the
  homepage read the same values (homepage keeps its rules; only the declaration block moves).
- `lib/motion.ts`: mode resolution (`full` / `reduced` / `off`) from a manual switch (`data-motion`,
  persisted), `prefers-reduced-motion`, and a `useMotionMode` hook. One switch disables everything.
- `app/motion.css`: the only place app motion is written; classes for press, lift, rule-draw, stamp,
  toast, drawer, skeleton breathe; reduced/off overrides; `prefers-reduced-motion` block.
- Component hooks: toast (Radix data-state), drawer shell, stage strip, skeletons, fairness bars.
- Test setup sets `data-motion="off"`, so tests are deterministic and never wait on animation.

## Ranked by impact ÷ cost

1. Stage rules drawing + skeleton breathe (dashboard) — the page everyone lands on; CSS only.
2. Drawer sheet + scrim — the most repeated modal interaction in the product.
3. Toasts — every confirmation in the app.
4. Press/confirm feedback (buttons, copy, step changes) — felt dozens of times per session.
5. Login slip + first-run entries — the only pages where richness is affordable.
6. Fairness bars — the one data graphic whose motion explains meaning.
7. Stamps (applied, success) — rare, memorable, 320ms.
8. Everything else: cut.

## Build order

Foundation → **pilot: Dashboard** (exercises shell, load choreography, stage rules, skeleton swap,
empty state, toast) → Login → Chooser → Matching Runs → Rooms (drawer) → Student results + At-risk
(drawer, filters) → Fairness → Manual checker → Students & Data → Form & Collection → Student form →
Platform → hardening.

## Evidence plan

- Resting states: all 20 routes × 375/768/1280/1920 with the switch off, pixel-diffed against the
  baseline captured before any change (`.impeccable/review/motion-app/baseline/`).
- Motion: video + frame stills for the stage draw, drawer, fairness bars, login, form steps; traces
  and frame-gap/long-task numbers at 4× CPU before and after.
- Homepage: before/after computed-style dump of the nine tokens, screenshots at four widths, video of
  the hero beat, Lighthouse desktop/mobile and Web Vitals, compared to the recorded baseline.
- Tests, typecheck, build, bundle delta; reduced-motion and switch-off passes; keyboard pass.
