# Open questions and proposals

Things this pass could not do within Hard Rule 2 (no backend, auth, permissions, data-model or
pricing changes). Each one is a proposal only; the shipped design works without it.

## 1. A run has no signed state
- **Now:** the product proposes, a person signs — but nothing in the app records that signature. The
  dashboard's "Latest run" block and the fairness page present a proposal, and the only proof of
  sign-off is the exported CSV.
- **Proposal:** add `signed_by`, `signed_at` and a note to a run (or a `run_signoff` table), then show
  a signature strip on the run header and a "Signed" chip in the history. Needs a schema + API change,
  which is out of scope for this pass.
- **Until then:** copy never claims a signature has happened.

## 2. Form link returns a token, not a URL
- **Now:** `GET /workspaces/:id/form-link` returns `{ token }`. The frontend composes
  `${origin}/f/${token}`. `expires_at` is not returned either, so the page cannot show an expiry.
- **Proposal:** return `form_url` and `expires_at` (the backend already knows `frontend_url` and the
  token's TTL). The frontend type now marks both optional, so this is a non-breaking change.

## 3. Performance gate
- **Now:** no Lighthouse in the toolchain, and no dependency may be added this pass. Performance was
  measured with Playwright (LCP/CLS/transferred bytes) and by bundle size.
- **Proposal:** add `lighthouse-ci` with budgets (LCP < 2.0 s on a production preview, CLS < 0.05, JS
  < 800 kB) so the homepage and app are guarded together.

## 4. `segments_status.at_risk` has no drill-through
- **Now:** the dashboard reports how many segments are in "Risk" (more than 20% of students without
  responses) and "Impossible" (not enough beds), and links to Matching Runs. There is no per-segment
  reason text in the dashboard payload, so the page states the rule instead of the reason.
- **Proposal:** include the segment's `reason` string (already computed in
  `services/segments/status.py`) in the dashboard payload and show it as a row note.

## 5. Platform console list has no pagination
- **Now:** `/api/platform/tenants` returns every tenant (`total: 36` in the dev database, mostly demo
  sandboxes). The page filters client-side.
- **Proposal:** server-side pagination + a default "hide demo tenants with no workspaces".

## 6. At-risk review is a filter, not page state
- **Now:** `/app/:ws/at-risk-review` redirects into the student register with `atRisk=1`; the page
  changes its title, adds the review note and the amber marks. Nothing is lost, but the URL after the
  redirect is the student results URL.
- **Proposal:** keep the redirect (unchanged) but add a `mode=review` parameter so the URL still says
  what the user is doing after the redirect. Cosmetic; needs a route-contract test update.

## 7. Student form validation summary
- **Now:** each unanswered question shows "Please select one option." and a summary line appears at
  the bottom. The first invalid question is not focused or scrolled to.
- **Proposal:** focus the first invalid fieldset on submit (needs a small scroll behaviour, which is
  motion work deferred to the animation pass).

## 8. Dev-only double `/api/auth/me`
- **Now:** React 18 StrictMode mounts the bootstrap effect twice in development, so `/api/auth/me` is
  called twice on load. Production builds call it once.
- **Proposal:** none required; recorded so it is not mistaken for a regression when reading the
  network log.

## 9. Magic Fill wording
- **Now:** "Magic Fill" is the existing feature name, kept because renaming a capability is a product
  decision. It is demoted into a disclosure and labelled "(generated data)".
- **Proposal:** rename to "Fill with sample answers" if the office ever uses it in front of a dean.
