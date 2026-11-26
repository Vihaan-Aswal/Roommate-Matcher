# Film performance pass

## Method

- Production build served locally from `frontend/dist` at `http://127.0.0.1:4175` on the same
  branch and commit as the preview.
- Chromium, reduced motion, 912×672 and 1440×900.
- `Tracing.start` with renderer/timeline categories only (no CPU-profiler sampling overhead),
  plus `PerformanceObserver({ type: "longtask", buffered: true })`.
- The film was settled, then a rail seek to Form (7.5 s), then played from 7.7 s to 20.2 s —
  through Boundaries (10.0 s) and Score (16.5 s).
- The same script is committed as `frontend/scripts/profile-cohort-pipeline.mjs`.

## Trigger

The reproducible transition work before the fix was a **65–84 ms style-recalculation burst** at
each station change. The trace’s `UpdateLayoutTree` children followed per-frame writes of inherited
custom properties (`--on` on every station and `--cam`/`--travel` on the world). The 163.685 ms
deployed task did not reproduce as a separate `jumpTo` task locally; it is consistent with that
style-recalc burst under the deployed trace’s overhead and hardware.

No React commit exceeded ~2 ms in the local diagnosis. The cost was browser style work, not React.

## Fix, no visual change

- World camera now writes `transform` directly instead of an inherited `--cam`.
- Station fade now writes `opacity` on `.cp-bay-body` directly instead of inherited `--on`.
- Only the visible station’s local timeline variables are updated.
- The static station world is memoized, so rail/caption/control state renders do not reconcile it.

The 96 response cards and all eight stations remain mounted. The film’s visuals are unchanged and
the Form → Boundaries → Score frames were checked again after the change.

## After

| Viewport | Rail seek long tasks | Form → Boundaries → Score long tasks | Trace tasks >50 ms | Initial page mount |
|---|---:|---:|---:|---:|
| 912×672 | **0** | **0** | **0** | 128 / **461** / 124 / 83 ms |
| 1440×900 | **0** | **0** | **0** | 127 / **470** / 190 ms |

The playback ran from `00:07.7` (step 2) to `00:20.2` (step 4), so the measured interval actually
covered Form, Boundaries and Score.

Raw traces (gzipped): [912×672](./trace-912x672.json.gz) · [1440×900](./trace-1440x900.json.gz)  
Metrics: [912×672](./metrics-912x672.json) · [1440×900](./metrics-1440x900.json)

## Remaining floor

The only remaining >50 ms tasks are **initial page mount**: 461 ms at 912 and 470 ms at 1440, plus
the shorter 83–190 ms mount tasks. This is outside playback and seeking.

I tested `content-visibility: auto` and `contain: layout paint` on stations to cut that mount work.
Both removed station content from the rendered film and were reverted. Conditional mounting would
move the cost into the animated transitions, which is exactly the risk this pass is meant to remove.
I stopped at the measured initial-mount floor instead of adding that complexity.
