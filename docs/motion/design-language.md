# Motion language — extracted from the homepage (`68551b6`, canvas `3caf886`)

The homepage is the reference. This is what it actually does, read from
`frontend/src/components/home/home.css` and `motion.ts`, before anything in the app was changed.

## The idea

**The Cut.** A rule is drawn, then the material it governs settles. Boundaries are cut before pairs,
the floor is drawn before the report, a signature line is drawn before the seal. Motion is
one-directional and physical: things arrive, draw, settle, press. Nothing loops, nothing floats, no
bounce, no elastic.

## Tokens (the only motion scale in the product)

Declared on `.mm-home` today:

| Token | Value | Homepage use |
|---|---|---|
| `--m-ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | arrivals, rules, paper (deceleration) |
| `--m-ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | thresholds, presses |
| `--m-dur-feedback` | `160ms` | hover / press |
| `--m-dur-change` | `320ms` | small state, focus |
| `--m-dur-scene` | `560ms` | a section object settling |
| `--m-dur-mark` | `600ms` | a mark landing |
| `--m-dur-focal` | `900ms` | a boundary rule, a document fan |
| `--m-stagger` | `28ms` | list/step stagger |
| `--m-stagger-cap` | `280ms` | cap per group |

41 `var(--m-…)` usages inside `home.css`; exactly nine declarations, all in the `.mm-home` block.

## Primitives and conventions

| Primitive | What it does | Where |
|---|---|---|
| `prefersReducedMotion()` | one-shot media query read | `motion.ts` |
| `usePrefersReducedMotion()` | reactive media query, SSR-safe | `motion.ts` |
| `useInView()` | IntersectionObserver reveal at `threshold 0.16`, `rootMargin 0 0 -6%`, one-shot (disconnects after first hit) | `motion.ts` |
| `window` event `mm-motion-lite` | a global "give up on motion now" signal; `useInView` reveals everything immediately when it fires | `motion.ts`, `HeroRunStage` |
| `.mm-motion-lite` CSS scope | `animation: none !important; transition: none !important` on every descendant, plus explicit resting values for objects that animate from a hidden state | `home.css` |
| Frame probe → lite path | 10 frames after the hero beat starts; slower than 28ms average → lite | `HeroRunStage.tsx` |
| `useScrollThread()` | one damped `requestAnimationFrame` for the wax tick; direct writes for the header rule; pauses on `visibilitychange`; stops when settled | `motion.ts` |
| `@media (prefers-reduced-motion: reduce)` | 0.001ms durations, 0ms delays, `scroll-behavior: auto`, explicit resting values | `home.css` |

Conventions that matter for the app:

1. **Content is static HTML first.** Reveals default to visible if JS, observers or CSS fail.
2. **One focal sequence, everything else supporting.** The hero is 5.4s; no other beat exceeds 1.1s.
3. **No layout properties.** Transform, opacity, `clip-path` only; the thread writes a CSS custom
   property and a `scaleX` transform.
4. **Loops are prohibited** except the scroll thread (finite, visibility-aware).
5. **Reduced motion is a complete version**, not a broken one: final values, same information.

## The app before this pass — what is abrupt today

Every state change is instant. Nothing is wrong with the resting design; the *transitions* are missing.

| Surface | Abrupt moment | What the user cares about |
|---|---|---|
| Shell / every route | content swaps in one frame; active rail row jumps | orientation: "which page am I on now" |
| Dashboard | skeleton blocks vanish into content in one frame; stage rules appear fully drawn | "is it ready, and what next" |
| Login | the slip simply exists; demo creation shows only a label change | first impression, trust |
| Chooser | rows appear at once | which desk, and creating one |
| Students & Data | step 1 → step 2 → applied replace each other with no continuity | did my file go in, what changed |
| Form & Collection | "Copy link" text flip; regenerate confirm appears | the link is the object |
| Matching Runs | run button → "Running…" → results with no cause/effect | the run happened |
| Room / student results | drawer snaps into place; selected row tints instantly | opening a record, closing it |
| Fairness | bars are already full at paint | proportion, the floor |
| Manual checker | validation line changes; result panel appears | did the answer land |
| Student form (phone) | identity → 12 questions swaps the whole card; receipt appears | confidence, completion |
| Platform console | rows snap | low priority, internal |
| Toasts | appear/disappear with no transition | confirmation |
| Skeletons | static blocks, no sign of life | "is it working" |

Dense surfaces (register rows, filters, the 12 questions) are *fast*, and the brief forbids animating
them. The inventory is therefore about **transitions between states**, not about elements moving.
