# Placeholders

Nothing on these pages is invented: no institution, hall, term, person, statistic, testimonial, logo,
certification or price appears anywhere in the app. Every figure is read from the API for the
workspace being viewed, and every scale (labels, thresholds, factor counts, boundary fields) comes
from `PRODUCT.md` or the backend contract.

This file lists the small number of *example strings* and *copy you may want in your own words*. None
of them is a claim, and none blocks the build.

## Example strings (safe to keep or replace)

| Where | String | What it is |
|---|---|---|
| `/login` | `you@example.com` | Email field placeholder |
| `/login` | `••••••••` | Password field placeholder |
| `/app` chooser | `e.g. Hostel office 2026` | New-workspace name placeholder |
| `/f/:token` | `e.g. ADM0241` | Admission-number placeholder (format illustration) |
| `/f/:token` | `e.g. 1234` | Phone-last-4 placeholder |
| `/platform` | `Name or slug` | Filter placeholder |

## Copy worth a second opinion (product voice)

These are the sentences that carry the most voice. They are accurate today; replace them if you want
the desk to sound more like your own office.

| Where | Current line |
|---|---|
| Dashboard | "Four stages stand between this workspace and a proposal. Each one opens the page that moves it." |
| Dashboard (derived) | "A proposal exists for this workspace. Read the rooms, then the students who scored lowest." — generated from real state, changes with the workspace |
| Students & Data | "Two files make a workspace runnable. Both are read into a preview first, so you can see every insert, update and removal before anything is written." |
| Form & Collection | "One link per workspace. Students verify themselves against the roster, answer twelve questions once, and only their latest valid response is counted." |
| Matching Runs | "A run reads the responses and the room list and writes a proposal. It is append-only: an earlier run is never edited, and a new run is a new artifact." |
| Fairness | "A room list can look fine and still leave one student below the floor. This page reports the floor, not the average." + the label thresholds |
| At-Risk Review | "These students scored under 0.55. Read the reasons, then decide whether the pairing needs a second look before keys are issued. Nothing here changes an assignment." |
| Manual Checker | "A second opinion on a group you are considering. It reads compatibility and explains it; it never edits a run, a room or an assignment." |
| Student form | "Twelve questions, one sitting. You verify yourself against the roster first." / "The hostel office reads the reasons for a placement, never your raw answers." |
| Platform console | "Every tenant on the platform and how many workspaces each one keeps. Opening a workspace enters it as that tenant; the amber strip stays until you exit." |

## Content the product cannot show yet (needs your decision, not a placeholder)

These are absent because the feature does not exist. They are **not** placeholders and must not be
faked — see `04-open-questions.md`.

- A signed/approved state on a run (the homepage's sign-off slip has no counterpart in the app).
- Email delivery of the form link (the app only copies a URL).
- Notifications, activity feeds or "who changed what" audit rows beyond a run's own record.
- Any price, plan or subscription surface.
- Customer logos, testimonials or reference institutes.

## Illustrative data

The demo workspace created by `POST /api/auth/demo` is labelled as demo everywhere it appears (rail
foot "OWNER · DEMO", the `Demo` chip in the chooser, the `demo` chip in the platform console), and the
generated-data warning banner appears whenever Magic Fill has written synthetic profiles. No real
student data is shipped in the repo.
