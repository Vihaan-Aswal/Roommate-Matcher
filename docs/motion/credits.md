# Credits — libraries and assets

**No library, asset, font, snippet or boilerplate was added.** The motion layer is CSS keyframes and
transitions plus one 120-line TypeScript module, all authored here. No CDN, no WebGL, no canvas, no
animation package, no icon download.

| Item | Source | Licence | Why |
|---|---|---|---|
| CSS keyframes / transitions | Browser platform | n/a | No download, compositor-only. |
| `frontend/src/lib/motion.ts` | Authored in this pass | n/a | Mode switch + system-preference handling. |
| Besley / Public Sans / IBM Plex Mono | Existing `frontend/public/fonts/` | Already cleared in the repo | No new request; the app reuses them. |

## Tooling (not shipped)

| Tool | How it was used | Licence |
|---|---|---|
| Playwright (`@playwright/test`, already a devDependency) | screenshots, video, traces, mode assertions | Apache-2.0 |
| `npx lighthouse` (run on demand, **not** added to `package.json`) | before/after scores | Apache-2.0 |
| `ffmpeg-win64.exe` bundled with Playwright | extracting frames from the recordings | LGPL-2.1 (as distributed with Playwright, used only locally) |

No asset, snippet or code was copied from a third party. The motion grammar comes from the project's
own homepage (`docs/homepage-motion-plan.md`).
