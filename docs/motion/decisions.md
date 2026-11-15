# Decisions

## D1 — Direction: "The Mark" (rules draw, material settles)

**Chosen.** The homepage's grammar applied to tools: a rule draws, a sheet lifts, a stamp presses, a
drawer slides out of the file. Everything frequent is 160ms; state changes 320ms; one scene (login)
560ms.

**Alternatives.** *The Ledger* — choreographed data on every table (the homepage rejected this as an
overall system; in a tool it taxes scanning and makes dense surfaces slower). *The Press* — every panel
stamped in sequence (uniform rhythm, queues content, the "everything fades up" failure).

**Why.** It is the only direction that is both the homepage's language and invisible during work. It
also lets the app use the homepage's tokens unchanged.

## D2 — Promote the motion tokens to `:root` instead of mirroring them

**Chosen.** Moved the nine `--m-*` declarations out of `.mm-home` into `:root` in
`frontend/src/app/motion.css`; nothing else in any homepage file changed. `.mm-home` inherits them.

**Alternatives.** (a) Copy the values into a `.desk` block with a comment — two sources of truth that
drift; (b) leave the homepage alone and hard-code durations in the app — a second system, forbidden by
the brief.

**Evidence.** Computed styles of all nine tokens on `.mm-home` before/after: **0 differences**
(`tokens-before/tokens.json` vs `tokens-after/tokens.json`). The homepage at 1280 is **pixel-identical**
before/after (full-page, reduced motion, 0 differing pixels) and its page height is unchanged (7310px).
The hero beat still runs after the move (video frames 40/80 in `motion-app/frames/home/`).

## D3 — No page-level route fade; the rail tick is the route signal

**Chosen.** Content paints immediately on every route change; the only transition is the active nav
tick drawing in (160ms).

**Alternatives.** A 120–200ms opacity/translate on the page container (Material-style), or a shared
element transition on the paper edge.

**Why.** A content fade starts at `opacity: 0`, which Chrome excludes from LCP, so it trades measured
speed for decoration; and a tool should never make a warden wait to read a table. The tick already
exists in the static design, so the signal costs no pixels.

## D4 — The drawer enters, it does not exit

**Chosen.** The panel slides 320ms and the scrim fades 160ms on open; closing is instant.

**Alternatives.** Keep the shell mounted for one token after close. That requires the parent to hold
the record after the URL drops `?student=…`, delaying the URL/back-button state by 320ms.

**Why.** A close animation that delays navigation is motion in the way. Logged as a trade-off; if the
human wants an exit, it needs parent-level presence (see `open-questions.md`).

## D5 — Dense surfaces stay still; only colour confirms

**Chosen.** Register rows, cells, numbers, chips, filters, the segmented control, the 12 questions and
the option rows have no entrance, hover or selection motion. Row tints transition colour only.

**Why.** The brief names these explicitly, and a 96-row register that cascades is slower to scan. The
app's motion budget is spent on transitions between states, not on elements moving.

## D6 — The student form's step crossfade was cut after measuring it

**Pilot lesson.** The identity → questions step had a 160ms fade. Under 4× CPU the settle trace showed
TBT 357ms with motion vs 276ms with the switch off (+81ms) on an interaction where the user is about to
answer twelve questions. Removed the fade; the receipt keeps its 320ms stamp (a one-off moment).
Re-measured: TBT 294ms vs 276ms off — inside run noise.

**Why.** The brief says the 12-question phone form is one of the surfaces where motion costs a warden
time. The measurement agreed, so the effect went.

## D7 — The skeleton breathe is the only loop

**Chosen.** `.desk-skel` breathes opacity 1 → 0.62 → 1 over `calc(var(--m-dur-focal) * 2)` (1.8s), only
while a skeleton is on screen. Killed by reduced/off; the tab throttles it when hidden.

**Alternatives.** A shimmer sweep (needs a gradient and a repaint, feels like a different product), or
static blocks (the user cannot tell "working" from "stuck").

**Why.** Waiting is the one place where a loop earns its keep; opacity is compositor-only and the
amplitude is low enough not to pull the eye.

## D8 — No 3D, no canvas, no renderer

**Chosen.** All graphics motion is CSS-drawn: stage rules, fairness bars, drawer sheet, stamps.

**Why.** The world is flat paper and wax; the homepage rejected 3D for the same reason and it applies
double to a working desk. A renderer would add weight to the single 739 kB chunk for a costume. The
"signature graphic moments" are the ones that carry meaning: readiness rules and proportion.

## D9 — One switch, honoured by CSS, set before first paint

**Chosen.** `<html data-motion>`; `initMotion()` applies it before React renders; CSS owns the
behaviour; `window.__setMotion()` / `__clearMotion()` for a person; the unit-test setup forces `off`.

**Alternatives.** A React context that conditionally renders animations (JS in the hot path, flashes
unanimated content on first paint), or only `prefers-reduced-motion` (no manual control).

**Why.** The human asked for a manual kill switch in addition to the accessible path, and the test
setup needs determinism. CSS also means the switch is respected by the homepage without importing app
code.

## D10 — The auth bootstrap spinner was replaced by the desk's boot state

**What.** `ProtectedRoute`/`PlatformRoute` used a shadcn blue spinner on white while `/api/auth/me`
resolved — visible for a moment on every cold load, and not part of the approved design. It is now the
field with the mono note "Reading the desk".

**Why.** The brief asks for no flash of unanimated content and no janky first paint; a blue spinner on
white is a different product for half a second. It is a loading state, not page layout or copy, so it
does not touch the approved resting design. Recorded in `deviations.md` §1.

## D11 — The login slip takes 560ms

**Chosen.** The one "scene" in the app. The slip rises 8px and fades in over `--m-dur-scene`.

**Why.** Auth is a first impression and the brief allows richness there. Measured login LCP after the
change: 368ms desktop / 920ms mobile vs baseline 388/919 — the slip is not the LCP element, so the
entrance costs no measured speed.

## D12 — Stagger is applied from fixed order, not inline styles

**Chosen.** Stage rules and bar rows use `:nth-child` delays of `--m-stagger` (28ms), capped at 4 steps
in practice. No `style={{"--i": n}}` in components.

**Why.** It keeps the markup (and the approved static DOM) unchanged, so the diff is CSS-only on those
components.

## D13 — Test setup uses the switch, not timers

**Chosen.** `src/test/setup.ts` sets `data-motion="off"` once. No `waitFor` was added or changed; no
test was touched.

**Why.** The brief allows disabling motion in tests through the global switch, and prefers it to
loosening assertions. All 57 existing tests pass unchanged, plus the new mode-checking script.
