# Deviations from the official docs

Each entry: what the docs say, what this pass did, and why. Hard Rule 8.

## 1. The app no longer keeps "its own tokens"
- **`DESIGN.md` (Do's):** "keep the field palette scoped to `.mm-home`; the signed-in admin app keeps its own tokens."
- **What happened:** the app now uses the same field/paper/wax/amber palette and the same three typefaces, in its own `.desk` scope (`frontend/src/app/desk.css`).
- **Why:** the brief's goal is that every other page "feel like the same product as the homepage", and the human's own instinct was a dark shell with cream work surfaces. Keeping a separate token set would have guaranteed a second product. The homepage's CSS was not modified; the values were copied from `DESIGN.md`, and the app scope is `.desk`, so the homepage remains isolated and pixel-identical (proved by diff — see the final report).

## 2. App type scale is smaller than the homepage display scale
- **`DESIGN.md`:** Display is `clamp(2.9rem, 4.6vw, 4.4rem)` for "the hero claim and closing line only".
- **What happened:** app page titles top out at `2.1rem` (Besley 800), section titles at `1.15rem`.
- **Why:** `DESIGN.md` already restricts display type to the hero and closing line; an operating screen that used 4.4rem headings would push the work below the fold. The app uses the same families, weights and tracking, at density the task needs. Recorded in `02-design-system.md` §3.

## 3. A second CSS prefix in the same codebase
- **Docs:** the homepage stylesheet uses `mm-*` classes.
- **What happened:** app components use `desk-*` classes scoped under `.desk`.
- **Why:** the homepage files are frozen; reusing `mm-*` names would have created collisions with `home.css` (both stylesheets load globally). `desk-*` makes ownership obvious in a diff.

## 4. Auth bootstrap ordering (code, not design)
- **Docs:** none.
- **What happened:** `AuthProvider` now calls `setApiToken(sessionToken)` before hydrating, instead of relying on a later effect.
- **Why:** child queries mounted before the effect ran, so every hard reload fired three 401s before recovering. No auth contract, backend or permission change. Logged in `decisions.md` §D7.

## 5. Student form URL composed on the client
- **Docs / API:** `GET /api/workspaces/:id/form-link` returns `{ token }`.
- **What happened:** `FormLinkResponse` now marks `form_url`/`expires_at` optional, and the page builds `${window.location.origin}/f/${token}`.
- **Why:** the API no longer returns a URL (verified against the running backend), so the "Copy link" control was dead. Composing the public link from the origin is correct for any deployment and needs no backend change. Proposal to return the URL server-side is in `04-open-questions.md`.

## 6. Four test edits
| File | Change | Why |
|---|---|---|
| `test/admin-dashboard.test.tsx` | `getByText("Test Workspace Dashboard")` → heading `Dashboard` + text `Test Workspace` | The old assertion forced the workspace name into the `h1` as one text run, which prevented setting it as data. The replacement asserts strictly more. |
| `test/components/student-detail-panel.test.tsx` | `/⚠ mismatch/i` → `/works against/i` + `/Strong Mismatch/i` | Emoji glyphs were replaced by a written polarity plus a mark, for screen readers and consistency. |
| `test/pages/manual-checker-page.test.tsx` | two disclaimer copies → one, and drop the `✅` glyph | The identical advisory sentence appeared twice on screen; it now appears once, above the workbench. |
| same file | `/✅ Sleep schedule - Strong Match/i` → `/Sleep schedule - Strong Match/i` | Same emoji removal as above. |

No assertion was removed without a stronger or equal replacement, and nothing was skipped.

## 7. Performance evidence substituted
- **Docs / brief:** "Re-run Lighthouse".
- **What happened:** Lighthouse is not installed and no dependency may be added this pass. Measured instead: production bundle sizes (`npm run build`), LCP/CLS/DOMContentLoaded and transferred bytes via Playwright (`scripts/measure-redesign.mjs`).
- **Why:** an honest measurement that runs beats a gate that cannot run. Adding Lighthouse in CI is proposed in `04-open-questions.md`.

## 8. No theme toggle
- **Docs:** none require one; the homepage has none.
- **What happened:** the app has no light/dark switch.
- **Why:** the app already shows both materials at once (field frame, paper page). A toggle would fork the palette and the paper metaphor. Logged in `decisions.md` §D3.

## 9. Screenshot harness runs with web security disabled
- **Docs:** the brief asks for a private capture port.
- **What happened:** captures run on `127.0.0.1:5175` with Chromium `--disable-web-security`.
- **Why:** the backend CORS allowlist only knows `5173`. The flag applies to the capture browser only; no app code, config or repo setting was changed. Logged in `decisions.md` §D8.
