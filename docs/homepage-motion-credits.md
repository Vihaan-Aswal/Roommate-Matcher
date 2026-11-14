# Homepage motion credits

No new library, asset, snippet or font was added for this motion pass. The work uses browser-native CSS transforms/transitions, SVG line drawing and the existing React hooks in `frontend/src/components/home/`. All typefaces and font files were already local to the repository from the homepage build (Besley, Public Sans, IBM Plex Mono, in `frontend/public/fonts/`).

| Item | Source | Licence | Why |
|---|---|---|---|
| CSS transitions and `requestAnimationFrame` | Browser platform | n/a | No dependency or download. |
| SVG line/rule drawing | Authored in the page | n/a | The register's rules are already part of the visual world. |
| Besley / Public Sans / IBM Plex Mono | Existing `frontend/public/fonts/` | Already cleared for the committed page | No new request, no external host. |

The 3D/2D renderer question was considered and rejected: the page's world is flat paper, ink and wax, and the motion is carried by rules and material settling. No WebGL, no canvas, no animation package, no CDN.
