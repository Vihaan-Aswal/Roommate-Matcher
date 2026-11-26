# Homepage refinement — concept

## Brief

The approved 50-second film is the spine. The page below it must deepen the same argument, not
repeat the film frame by frame. The thesis stays “A room list you can sign.” The film stays the
default; `?classic=1` is comparison only.

## What the audit found

- The hero and the paper/desk visual language are already strong. The film is the best thing on the
  page; it should not be redesigned.
- Every section below the film opens with the same split heading. Six identical openings make the
  page read as six landing-page blocks rather than one allocation run.
- The page order contradicts the film: Artifacts (station 07) comes before Fairness (station 06).
- The page Fairness chart repeats the film’s bar chart in a less legible form. At 375 the four
  panels are 2 × 2, the marks cluster at the top, and the weakest-room table repeats the same
  facts again.
- The thin fixed rail at the left edge is decorative: it has no station labels and sits outside the
  content.
- The classic film is imported on the default path, so the bundle carries both films.

## Directions considered

### A. One run file — chosen

The page becomes the sample run’s working file. A station index under the film turns the eight
stations into the page’s argument map; each section below carries its real station number and a
continuous route line. Fairness moves before Documents so the page follows the film. The page
speaks in the same materials — paper, rule, wax, mono labels — but its artifacts deepen the film:
the boundary ledger, the pair sheet, the floor register, the run pack, the signature slip.

Bold move: the page is no longer a sequence of marketing sections. It is one signed document with
numbered stations. Nothing decorative is added; every new rule or number points to a station.

### B. Desk drawer

Each section becomes an artifact pulled from a single drawer, with a fixed artifact index. More
skeuomorphic and more motion, but risks turning the argument into a prop show and makes the mobile
page very long. Rejected.

### C. Five cuts

An editorial essay that drops most panels and keeps only the boundary, one pair, the floor and the
signature. Stronger reading rhythm, but it would hide the working detail that makes the product
credible: the ten factors, the room strategies, the four documents and the audit trail. Rejected.

## Chosen concept

**One run file.** The film is the run; the page is the file a warden keeps.

- A full-width station path under the hero names all eight stations and links 03–08 to their
  sections. Stations 01–02 point back to the film.
- Each section gets a small station mark (`03 / Boundaries`, `04–05 / Score & Match`, …) and a
  continuous route rule in the left margin on desktop. On mobile the mark becomes a horizontal
  kicker; no fixed rail, no overflow.
- Fairness (06) moves before Documents (07). The page now reads in the film’s order.
- The four-panel fairness chart and the weakest-room table collapse into one floor register: four
  segment rows, each with 24 sorted marks, a 0.55 floor line, mean, weakest room and at-risk count.
  It is more compact, more legible at 375, and does not repeat the film’s chart.
- A small header station indicator names the section in view on wide screens. It is hidden where
  the header is tight.
- The classic film is lazy-loaded behind `?classic=1`, so the default page does not ship two films.

## What stays

- Hero copy, thesis, CTA and sample-data note.
- The approved film and its eight stations.
- Boundary ledger, pair sheet, run pack and sign-off slip; their content and data.
- Limits as the edge notes after the signature.
- All anchors and routes.

## Constraints

- No backend, API, database or data changes.
- No new dependencies, no WebGL.
- Motion stays on transform/opacity; reduced motion keeps the film playing and removes only the
  section entrances.
- 1440, 1280, 912 × 672 and 375 must have no horizontal overflow and no clipped evidence.
