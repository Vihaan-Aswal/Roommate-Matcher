# Homepage motion plan

**Baseline before this pass:** `.impeccable/baseline/` — `build.txt`, `lighthouse-desktop.json`, `lighthouse-mobile.json`, `baseline-metrics.json`, and `mobile/tablet/laptop/desktop` fold + full captures at 390, 768, 1440 and 1920. All captures are at `127.0.0.1:4173` (production preview), not the shared dev server.

Baseline numbers: **712.99 kB JS / 76.77 kB CSS**; page **7536 px at 1440**, 8605 at 768, 10876 at 390, 7550 at 1920. Lighthouse: desktop performance 69, mobile 67; accessibility 100; best practices 96; SEO 82. Playwright Web Vitals at load: mobile LCP 672 ms / CLS 0.125, tablet 732 / 0.040, laptop 688 / 0.020, desktop 852 / 0.010. No console errors or warnings, no external requests.

The page is already good and is the reference for the rest of the product. This is not a redesign. The world, palette, typefaces, copy, layout, order, numbers and seeded fixture are frozen. Movement is the only material being added.

## Directions considered

1. **The Cut — the working register is cut, inked and filed.** The page is a working document. Rules draw, marks land, paper lifts, a wax seal presses. The focal moment is the hero boundary: 96 arriving marks cross four visible cut lines into four labelled shelves, then the room cells hold. Supporting motion follows the same grammar: a line draws first, then the thing it contains settles.
2. **The Platen — every section is stamped by a press.** Strong objecthood, but it turns every section into the same printing event, and the page already varies its density by section. Rejected: sameness and a risk of heavy shadows/layout.
3. **The Thread — one ink line that draws down the whole page and branches into every diagram.** Strong continuity, but it would compete with the existing margin thread, is hard to make robust without canvas, and risks becoming a decorative overlay. Rejected: the page already has a persistent thread; it does not need a second.
4. **The Lamp — a moving pool of light reveals the ink.** Faithful to the lit-desk world, but it would sit on top of text and paper, threaten contrast in animated states, and invite expensive blur/gradient work. Rejected: not worth the risk for the meaning it adds.
5. **The Sort — data choreography as the whole language.** Marks, bars and segments always moving. This overlaps the chosen boundary but has no paper or human mark, so it explains the algorithm and not the product. Rejected as the overall system; retained only inside the stage.
6. **3D paper / particles.** Rejected. The world is a flat working document; depth is already carried by layered paper and wax. 3D would be a costume, an extra renderer and a performance cost for no argument.

## Chosen: The Cut

The one idea: **a rule is drawn, then the material it governs settles.** It is the grammar of the product: boundaries are drawn before pairs, the floor is drawn before the report, a signature line is drawn before the seal. It is expressed with CSS transforms/opacity and SVG line drawing, not a new renderer.

- **Focal moment: the hero boundary crossing.** 96 marks arrive over a ghost register. Four boundary rules draw across the sheet, one per segment, left to right. The marks assigned to each segment cross their rule in four sequential waves (not one global move), briefly hold at the threshold, then settle into the room cells; room outlines tighten, pair edges resolve, and four documents fan out. The sequence rests in the current final state. This keeps the existing pipeline and changes only choreography. The full beat is **5.4s**: setup 0–1.15s, four boundary waves 1.15–3.8s, pairs 3.8s, documents 4.5s, rest 5.4s.
- **Continuity: the margin thread.** The wax tick follows scroll progress with weight (a short damped follow), while the header rule stays direct. It pauses when the tab is hidden and settles when scrolling stops; no perpetual loop.
- **Graceful fallback: the lite path.** A 10-frame probe starts when the boundary beat begins. If the average frame is slower than 28ms, the stage and the rest of the homepage resolve immediately to their finished state and all nonessential transitions stop (`.mm-motion-lite`). The content remains complete; the 4x CPU pass uses this path.
- **Supporting beats, varied by importance:**
  - Boundary section: the segment room cells settle in a stagger; the amber risk room is last.
  - Compatibility: the paper lifts into place, factor bars fill from the left, strategy edges draw.
  - Artifacts: the folder sheets pull out in reading order with a slight paper rotation; not a uniform fade-up.
  - Fairness: the segment mark groups rise first, the floor rule draws after them at 1050ms, then the S-009/S-021 bracket settles at 1200ms. The numbers are visible immediately; the drawing only confirms them.
  - Sign-off: the signature rule draws, then the wax seal presses. No loop, no pulse.
  - Limits: hairlines draw in, text is left alone.
- **Controls:** wax buttons press 1px and deepen; ghost controls fill; focus is always visible and never animated away. Replay remains the only repeatable sequence.

## Timing and easing, in one place

Tokens live on `.mm-home` in `home.css`:

- `--m-ease-out: cubic-bezier(0.16, 1, 0.3, 1)` — arrivals, rules, paper.
- `--m-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)` — thresholds, presses.
- `--m-dur-feedback: 160ms` — hover/press.
- `--m-dur-change: 320ms` — small state, focus.
- `--m-dur-scene: 560ms` — a section object settling.
- `--m-dur-focal: 900ms` — a boundary rule or a document fan.
- `--m-stagger: 28ms`, capped at 280ms per group.

The rhythm is: rule 0–420ms, content 120–700ms, floor/seal 500–900ms. No bounce, no elastic; physical deceleration only. No single transition runs longer than 1.1s; the staged hero sequence is 5.4s. There are no nonessential animation loops.

## Deliberately not animated

- Headings, body copy, table rows and numbers. Reading is never competed with.
- The page's light field and paper texture. No parallax, drifting light, grain or noise.
- Arrows, icons or decorations that carry no state.
- No scroll-jacking, no reveal on every paragraph, no custom cursor, no hover-only affordance.
- No canvas/WebGL renderer and no new dependency. The world does not need a second rendering system, and the performance budget is better spent on the single focal sequence.

## Reduced motion

Reduced motion is its own calm version, not a broken half: the hero renders its complete final stage, section objects are already in place, the fairness chart is complete, and the seal is pressed. Hover/focus color feedback remains. The thread jumps directly to progress. No information is lost and nothing is delayed.

## Performance and lifecycle

- CSS transitions/transforms and one `requestAnimationFrame` for the thread; no per-frame React state.
- The hero stage timers are cleared on replay/unmount; the ResizeObserver and IntersectionObserver are disconnected; the thread rAF stops on hidden tab and when settled.
- LCP content is static HTML before the animation runs; all reveals default to visible if JS or observers fail.
- Budget: no new package, no new font, no new raster. Target 60fps under 4x CPU; if a beat cannot hold, simplify that beat, never the content.

## Evidence plan

- Frame sequences of the load at 250/700/1300/2000/2900/3900/5200/5600ms.
- Scroll captures at every section and a full-page capture at 1440/768/390/1920.
- Performance traces with 4x CPU throttle and long-task/dropped-frame counts.
- Reduced motion, WebGL disabled, keyboard, fast scroll, resize, tab hidden, unmount/replay.
- Lighthouse and Web Vitals re-measured against baseline; bundle delta.
- Screenshots to `.impeccable/review/motion/`; baseline stays in `.impeccable/baseline/`.


