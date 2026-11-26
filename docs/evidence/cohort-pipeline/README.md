# Cohort pipeline — full explainer evidence

The full one-camera, eight-station explainer. It is the default on this branch at **`/`**;
the classic film is kept at **`/?classic=1`**. Production `main` is untouched.

- Concept and beat sheet: [CONCEPT.md](./CONCEPT.md)
- **Full 50-second take:** [cohort-pipeline-50s.webm](./cohort-pipeline-50s.webm)
  (VP9, 864×810, 25 fps, 50.0 s)
- Approved 10-second spike: [cohort-pipeline-10s.webm](./cohort-pipeline-10s.webm)

## Station holds

| Time | Station | What is fully framed | 1440 | 375 |
|---|---|---|---|---|
| 2.5 s | 01 Inputs | 96 students, 38 rooms, private 12-question form | [frame](./shots/1440-inputs.png) | [frame](./shots/375-inputs.png) |
| 7.5 s | 02 Form | 96 responses, sealed envelope, normalised preferences | [frame](./shots/1440-form.png) | [frame](./shots/375-form.png) |
| 13.0 s | 03 Boundaries | four stamps, four segments, 4,560 → 3,456 → 1,104, R-12 open | [frame](./shots/1440-boundaries.png) | [frame](./shots/375-boundaries.png) |
| 19.0 s | 04 Score | 0.416, ten factor rows, raw scores, weights, three zeros, one blank | [frame](./shots/1440-score.png) | [frame](./shots/375-score.png) |
| 26.5 s | 05 Match | 12-room example segment, chosen lines, 24 + 8 + 6 = 38 rooms | [frame](./shots/1440-match.png) | [frame](./shots/375-match.png) |
| 34.0 s | 06 Fairness | 0.827 mean, R-12 0.416, 2 at risk, 3/3/0 swap, floor statement | [frame](./shots/1440-fairness.png) | [frame](./shots/375-fairness.png) |
| 40.5 s | 07 Documents | assignments, 96 notes, fairness, audit, sealed raw answers | [frame](./shots/1440-documents.png) | [frame](./shots/375-documents.png) |
| 47.5 s | 08 Sign-off | signed slip, wax seal, held keys | [frame](./shots/1440-signoff.png) | [frame](./shots/375-signoff.png) |

Extra readability checks: [912×672 score](./shots/912x672-score.png) ·
[912×672 match](./shots/912x672-match.png) ·
[912×672 fairness](./shots/912x672-fairness.png) ·
[912×672 documents](./shots/912x672-documents.png) ·
[912×672 sign-off](./shots/912x672-signoff.png) ·
[1280 sign-off](./shots/1280-signoff.png).

## Score station

The ledger shows the raw factor score beside the effective weight; the bar encodes the raw score.
Cleanliness 0.00, Room use 0.00 and Night activity 0.00 are tinted and marked in wax; Sleep schedule
is the blank row. The score is fully framed from 16.64 s to 22.96 s (6.3 s), with 0.416 large enough
to read at 375.

## Matching and fairness

- The match graph draws the twelve chosen pairs of **one** 2-bed segment as vertical lines and labels
  itself “12 rooms · one of two”. The 2-bed card is the **two-segment total** (24 rooms); the 3-bed
  card is 8 rooms; the 4-bed card is 6 rooms. “24 + 8 + 6 = 38 rooms” is written out. The cards carry
  real mini-diagrams: pair line, seed-and-grow triangle, and two pairs with a merge line.
- Fairness is the only station with the red thread. It starts at the R-12 bar and ends in a bracket
  whose ticks land on the S-009 and S-021 cards at 1440, 912 and 375. The chart is sorted by room
  score, with mean 0.827 and floor 0.55 marked.

## Documents

The reasons card shows one real example reason (“cleanliness expectations differ”) at 11px, with the
student id on its own line; the 96-note count remains the headline. Raw answers stay sealed.

## Capture notes

- The WebM is assembled from exact playhead samples at 25 fps, so every sampled frame is
  deterministic. The transport therefore reads *Play* in the recording; the live page autoplays and
  the E2E suite verifies that.
- The bundled Playwright ffmpeg build has no GIF muxer, so the capture ships WebM plus the frame set
  rather than a GIF. No new dependency was added to encode one.
- Regenerate with `npm run dev` followed by `node scripts/capture-cohort-pipeline.mjs` from
  `frontend/`. The script also accepts `PIPELINE_BASE_URL`.
