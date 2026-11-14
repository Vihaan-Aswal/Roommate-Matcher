# GOAL

My home page looks good but it's completely static. Make it feel alive and premium by adding smooth animations, transitions, and 2D/3D graphics that deeply enhance it. This is an elevation, not a redesign: the result must feel like it was always part of this page's existing identity, layout, copy, and brand. Everything that makes the page good today must survive.

You have full autonomy. Decide what to add, where, and how. You may install any library, search the web, and pull from any boilerplate, demo, doc, or asset source. Use /impeccable throughout for design direction, critique, and polish.

# HOW I WANT YOU TO WORK

**1. Understand before you touch anything.**
Study the stack, the existing design language, and every section of the home page. Reuse what's already installed before adding anything new. Before changing anything, record a baseline: production bundle size, Lighthouse scores, Core Web Vitals (LCP, CLS, INP/TBT), and screenshots at mobile, tablet, laptop, and large-desktop widths. Store baseline artifacts outside version control (or gitignored).

**2. Ideate properly.**
Don't jump to the first idea. Explore several distinct directions for the page's motion and graphic concept, including a signature centerpiece. Weigh them against the brand and current design, pick one, and note why. Decide deliberately what NOT to animate; restraint is part of the craft. Write the plan, chosen direction, and decisions to a file in the repo (e.g. `docs/homepage-motion-plan.md`) and re-read it as you work so nothing is lost over a long session.

**3. Build one coherent system, not a pile of effects.**
The whole page should feel authored by one hand: a shared motion language (timing, easing, choreography, hierarchy of attention) defined in one central place and reused everywhere, with no magic numbers scattered around. Every effect must earn its place by guiding attention, confirming interaction, or strengthening the story. If it doesn't, cut it.

**4. Verify tools with current info.**
Use web search to check current best practices, versions, maintenance status, bundle size, and license for every library or asset you consider. Don't rely on memory. Pick the minimum tooling that achieves the vision; prefer native CSS/browser APIs when they do the job. Log every external asset or snippet with its source URL and license in `docs/homepage-motion-credits.md`. Don't ship anything with an unclear or restrictive license.

**5. Be efficient (hard limits).**
- LCP, CLS, and INP/TBT must not regress versus baseline. Lighthouse performance may not drop more than 2 points.
- The LCP element must never be gated behind an animation or heavy script.
- Initial-load JS increase must stay small. Report the exact delta and justify it. Heavy things (3D, large assets) are lazy-loaded, code-split, and started only after first paint or on viewport entry.
- Sustain smooth ~60fps, including under 4x CPU throttling. Degrade gracefully on weak devices (fewer particles, lower DPR, or a simple static fallback).
- Pause work when offscreen or when the tab is hidden. Clean up everything on unmount (animation loops, listeners, scroll triggers, GPU resources).
- Animate only compositor-friendly properties; reserve space for anything that loads or animates in so there is zero layout shift.

**6. Prove it works, including the motion itself.**
Don't claim success without evidence. Stills can't prove motion quality, so also use Playwright (or equivalent) to record video or capture frame sequences of the load sequence, scroll animations, and interactions, and use performance traces to check for dropped frames and long tasks. Then run build, lint, types, and tests, and test the hard cases: reduced-motion preference, throttled CPU and network, WebGL disabled, keyboard-only use, fast scrolling, resize and orientation change, tab switching, and navigating away and back repeatedly (watch for leaks). No console errors or warnings. Re-measure against baseline and show before/after numbers.

**7. Critique your own work harshly, with a limit.**
When done, review it with /impeccable as a ruthless senior design director. List everything weak, generic, janky, or overdone, and fix it. Do this for up to 3 rounds, stopping earlier if no meaningful issues remain. Also check for stacking/z-index bugs, text readability over animated backgrounds, mobile overflow, flash of unstyled or unanimated content, and sticky/pinned sections on short viewports.

# THE BAR

- **Anti-slop**: no uniform "everything fades up on scroll," no gratuitous parallax, no scroll-jacking that takes control from the user, no effects that exist just because they're possible. Vary choreography by importance. Motion should feel physical and intentional.
- **Fits the page**: colors, typography, spacing, and tone stay consistent. Light/dark mode respected if the site has it.
- **Accessible**: reduced-motion users get a genuinely calm experience, not a half-disabled one. No flashing. Focus is always visible and never obscured. Decorative graphics are hidden from assistive tech. Contrast holds in every animated state.
- **Robust**: progressive enhancement. The page stays fully readable and usable if JS, WebGL, or all motion fails. Works on touch devices (no hover-dependent affordances) and across Chrome, Safari (including iOS quirks), and Firefox.
- **Safe**: don't break or remove existing content, SEO, links, analytics, or unrelated pages.

# GIT RULES

Work on a new branch and commit in logical steps. Do not push, merge, or open a PR. Don't commit baseline screenshots, recordings, or trace files.

# FINAL REPORT

Keep it concise:
1. The concept you chose, what you built, and why (plus what you deliberately skipped)
2. Libraries and assets added, with license and reason
3. Before/after metrics (bundle size, Lighthouse, Web Vitals) and evidence of the tests above
4. Anything I should check manually on a real device
5. Where to tune or disable the effects

Start by exploring and planning. Show me your chosen direction before building.
