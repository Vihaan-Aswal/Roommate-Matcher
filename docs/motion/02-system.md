# 02 — Motion system

> Everything the app animates is declared in `frontend/src/app/motion.css` and switched by
> `frontend/src/lib/motion.ts`. No component invents a duration or an easing.

## Tokens

The nine `--m-*` tokens now live on `:root` in `motion.css`. They were moved, unchanged, out of the
`.mm-home` block in `home.css`, so the homepage and the app read the same values from one place.
`.mm-home` inherits them; a computed-style dump before/after shows identical values (see
`decisions.md` D2).

| Token | Value | App use |
|---|---|---|
| `--m-ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | arrivals, rules, bars, sheets |
| `--m-ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | state colours, the skeleton breathe |
| `--m-dur-feedback` | `160ms` | presses, ticks, toasts, note/lift feedback, copy confirm |
| `--m-dur-change` | `320ms` | rule draw, bar fill, drawer, stamp, lift |
| `--m-dur-scene` | `560ms` | the login slip only |
| `--m-dur-mark` / `--m-dur-focal` | `600ms` / `900ms` | **not used by the app**; derived from for the skeleton loop |
| `--m-stagger` | `28ms` | stage rules, bar rows, stackbar segments |

Distances are not timings and are the only app-local values: `--app-lift: 6px`, `--app-lift-sm: 3px`,
`--app-lift: 8px` on the slip.

## The mode switch

```html
<html data-motion="full | reduced | off">
```

* `full` — default. All app motion runs.
* `reduced` — no movement. Set automatically from `prefers-reduced-motion: reduce` (CSS media query
  handles it without JS), or manually.
* `off` — nothing animates anywhere in the product, including the homepage. `animation: none`,
  `transition: none`, `scroll-behavior: auto`, with `!important`.

Manual control (persisted in `localStorage["mm-motion"]`):

```js
window.__setMotion("off")      // or "reduced" / "full"
window.__clearMotion()          // back to the system preference
```

The test setup sets `document.documentElement.dataset.motion = "off"` before every test, so no test
ever waits on a frame. `scripts/verify-motion-modes.mjs` asserts the three modes with computed styles.

## Choreography rules

1. **First paint is never animated.** No element in the first viewport starts from `opacity: 0`. The
   masthead, `h1`, description, figures, directive, first table rows and the form's first field render
   final. LCP is never gated by motion.
2. **Dense surfaces are still.** Register rows/cells, numbers, chips, filters, the segmented control,
   the 12 questions and option rows get no entrance, hover or selection motion. Colour confirms only.
3. **Rules draw, material settles.** A 1px rule draws (`scaleX`) before the thing it governs.
4. **One action, one duration.** Frequent = 160ms; state changes = 320ms; the login scene = 560ms.
   Nothing in the app uses `--m-dur-mark` or `--m-dur-focal`.
5. **No loops** except the skeleton breathe (waiting state, opacity only, 1.8s), which is killed by
   reduced/off and pauses with the tab (browser throttling).
6. **No layout animation.** Transform, opacity and colour only. No height, width, top/left, margin.
7. **Route changes do not fade content.** Only the rail's active tick draws in (160ms); content paints
   immediately.

## Primitives

| Class / element | What it does | Where used |
|---|---|---|
| `.m-lift` | 6px rise + fade, 320ms | notes, empty states, checker result, regenerate confirm |
| `.m-fade` | fade, 160ms | the diff proof sheet when step 2 appears |
| `.m-stamp` | 1.06 → 1 scale + fade, 320ms | "Applied" stamp, student-form receipt |
| `.m-slip` | 8px rise + fade, 560ms | the login slip |
| `.desk-skel` | breathing opacity, 1.8s, infinite while waiting | every skeleton |
| `.desk-stage-rule` | draws left→right 320ms, 28ms stagger by stage; colour cross-fades 320ms on state change | dashboard readiness |
| `.desk-bar-track span`, `.desk-stackbar span`, `.m-meter span` | fill from the left 320ms, 28ms stagger | fairness distribution, segment cards, collection meter |
| `.desk-nav-link[aria-current="page"]::before` | tick draws 160ms | every route change |
| `.desk-drawer-panel` / `.desk-drawer-scrim` | sheet slides 320ms / scrim fades 160ms | student details |
| `.desk-toast` | rise+fade 160ms in, 160ms out (Radix `data-state`) | confirmations |
| `.desk-btn`, `.desk-slip` | press 1px / copy border 160ms | every control |

## Deliberately absent

No page fade, no scroll-linked effects, no drawer exit animation (the shell unmounts on close; a
delayed close would delay the URL), no staggered table rows, no counters, no number odometers, no
illustrations, no WebGL/canvas/3D, no new dependency. Rationale per item in `01-plan.md` and
`decisions.md`.
