# Homepage refinement — evidence

The concept and rejected directions are in [CONCEPT.md](./CONCEPT.md). This pass turns the page
below the approved film into one run file: a station index, numbered station marks, a continuous
route rule, and the film’s order restored.

## What changed

| Area | Change |
|---|---|
| Header | A live station label (`03 Boundaries`, `06 Fairness`, …) on wide screens; the progress rule stays. |
| Hero | Copy, CTA, sample note and the approved film are unchanged. The shared film chrome moved out of the classic stylesheet so the default film no longer depends on it. |
| Station path | New bridge under the film: “The film is the run. The page is the file.” Eight stations; 01–02 link back to the film, 03–08 link to their sections. |
| Boundary (03) | Station mark and route rule added. Content unchanged. |
| Score & Match (04–05) | Station mark and route rule added. Content unchanged. |
| Fairness (06) | Moved before Documents. Four-panel chart + weakest-room table replaced by one floor register: four segment rows, 24 sorted marks each, a 0.55 floor line, exact mean, weakest room and below-floor count. |
| Documents (07) | Station mark and route rule added. Run pack carries room means to three decimals. |
| Sign-off (08) | Station mark and route rule added. Signature slip unchanged; floor reads 0.416. |
| Limits | Edge-notes kicker added; still outside the numbered run, after the signature. |
| Close | “End of file · RM-D1C916” kicker added. |
| Footer | Unchanged. |

The classic film now loads only with `?classic=1`; its JS and CSS are separate chunks.

## Consistency pass

- On mobile, every factor row stacks as factor name, bar, then three labelled columns:
  `Weight 20%`, `Raw 1.00`, `Points 0.200`. The desktop five-column table is unchanged.
- The film’s sign-off rule is empty. The wax seal, keys-held note and “Signed by a person” placeholder
  remain; there is no red signature stroke in the film.
- Key evidence uses the run's three-decimal values: segment mean 0.827, R-12 / floor 0.416, pair
  R-15 0.733. The boundary note, fairness register, compatibility sheet, sign-off and fairness
  statement agree. The assignment table labels its column "Room score" and notes that these are
  room means, not pair scores, shown to three decimals (R-15's room score is 0.781; its pair score
  is 0.733).

## Screenshots

Each width has top, path, film, every section, close and footer:
[1440](./shots/1440-top.png) · [1280](./shots/1280-top.png) ·
[912×672](./shots/912x672-top.png) · [375](./shots/375-top.png).

The full set is in [`shots/`](./shots). Station frames for the film are still in
[`../cohort-pipeline/shots`](../cohort-pipeline/shots).

## Verification

- Unit: `npm test` — 53 files, 432 tests passed.
- E2E: `a11y.spec.ts`, `routes.spec.ts`, `cohort-pipeline.spec.ts` — 13 tests passed.
  Covers axe on public and authenticated pages, route/overflow/console sweep, the full film at
  1440/1280/912/375, reduced-motion autoplay, no homepage `/api/` calls, and the classic flag.
- Typecheck: `npm run typecheck` passed.
- Build: `npm run build` passed.
- Bundle: largest JS **563.77 kB raw / 162.24 kB gzip** (was 589.17 / 167.24), 35 chunks.
  The classic chunk is 29.03 kB JS + 47.82 kB CSS off the default path.
- Overflow: 0 px at 1440, 1280, 912×672 and 375.

## Capture notes

`frontend/scripts/capture-home-redesign.mjs` captures the evidence set against a running dev
server. It hides the skip link and header for whole-section cuts so the sticky bar does not cover
the station mark. The top cut keeps the real sticky header.
