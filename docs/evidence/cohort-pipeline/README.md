# Cohort pipeline — 10-second spike evidence

Phase 1 of the whole-cohort explainer. Open it at **`/?pipeline=1`**; the classic film stays at `/`.

- Concept and beat sheet: [CONCEPT.md](./CONCEPT.md)
- Ten-second take: [cohort-pipeline-10s.webm](./cohort-pipeline-10s.webm) (VP9, 864×810, 25 fps, 10.0 s)

## Frames

The 1440 set covers the full required sampling. The 375 and 912×672 frames are the
readability checks for the score ledger and boundary folders.

| Time | Beat | 1440 | 375 |
|---|---|---|---|
| 0.5 s | Inputs entering | [frame](./shots/1440-frame-0.5.png) | [frame](./shots/375-frame-0.5.png) |
| 2.0 s | Inputs settled: 96 students, 38 rooms, 12-question form | [frame](./shots/1440-frame-2.0.png) | [frame](./shots/375-frame-2.0.png) |
| 3.5 s | 96 response cards arriving | [frame](./shots/1440-frame-3.5.png) | [frame](./shots/375-frame-3.5.png) |
| 5.0 s | Raw answers sealed; normalised preferences out | [frame](./shots/1440-frame-5.0.png) | [frame](./shots/375-frame-5.0.png) |
| 7.0 s | Four boundary stamps; folders rising | [frame](./shots/1440-frame-7.0.png) | [frame](./shots/375-frame-7.0.png) |
| 8.5 s | 4,560 → 3,456 → 1,104; R-12 folder open | [frame](./shots/1440-frame-8.5.png) | [frame](./shots/375-frame-8.5.png) |
| 9.5 s | Score ledger fully framed | [frame](./shots/1440-frame-9.5.png) | [frame](./shots/375-frame-9.5.png) |

Extra readability checks: [912×672 boundaries](./shots/912x672-frame-8.5.png) ·
[912×672 score](./shots/912x672-frame-9.5.png) ·
[1280 score](./shots/1280-frame-9.5.png).

## Capture notes

- The WebM is assembled from exact playhead samples at 25 fps so every sampled frame is
  deterministic. The transport therefore reads *Play* in the recording; the live page
  autoplays on mount and the E2E suite verifies that.
- The bundled Playwright ffmpeg build has no GIF muxer, so the capture ships WebM plus
  the frame set rather than a GIF. No new dependency was added to encode one.
- Regenerate with `npm run dev` followed by
  `node scripts/capture-cohort-pipeline.mjs` from `frontend/`. The script also accepts
  `PIPELINE_BASE_URL`.
