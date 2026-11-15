# Open questions

1. **Drawer exit animation.** Closing is instant because the shell unmounts when the URL drops
   `?student=…`; keeping it mounted for one token would delay the URL and the back button. If you want
   the sheet to slide out, it needs a presence wrapper at the page level (both results pages) and a
   decision that the URL may lag the visual by 320ms. Not done deliberately.

2. **A visible home for the switch.** The manual switch is `window.__setMotion("off")` /
   `__clearMotion()`, persisted per browser. If you want it in the product UI (settings or the user
   menu), that is a product decision and a small amount of new markup; the mechanism is ready.

3. **The loading dateline says "0 segments" before data arrives.** Seen in the dashboard recording: the
   masthead renders `0 segments` during the skeleton phase, which is a content lie for a fraction of a
   second. It is a static-content issue from the approved design, not motion, so it was not changed.
   Proposal: hide the dateline count until the dashboard query resolves.

4. **Mobile Lighthouse TBT varies by ±1s on the same build.** Login mobile scored 0.87, 0.89, 0.91
   across three runs (baseline 0.90); home mobile TBT swung 2,359–3,668ms between runs. Any
   performance gate needs repeated runs and a median, otherwise the score is noise. Suggested budget:
   performance ≥ baseline − 2 on a median of 3 runs, LCP/CLS from the same run.

5. **The homepage has its own fallback path (`.mm-motion-lite` + the `mm-motion-lite` event) that is
   separate from the new global switch.** Both still work; the global switch also disables the
   homepage. Unifying them would mean editing the homepage's frame probe, which is frozen this pass.

6. **The skeleton breathe is the only repeating animation.** If anyone finds it distracting on a slow
   connection, `__setMotion("reduced")` is the answer, and it could be made a user preference later.

7. **`requestAnimationFrame` cost of the homepage thread does not exist in the app** — the app has no
   rAF loops at all. If a future feature adds one, it must follow the homepage's pattern (pause on
   hidden, stop when settled) and be registered with the switch.
