# Cohort pipeline explainer — phase 1 concept

## What this is

A 10-second, one-camera explainer for a first-time hostel warden, dean or housing officer. It is
not a mood piece and it is not the old R-12 film made dynamic. One cohort of paper moves through
labelled stations; each station teaches one step of the allocation pipeline. The R-12 case appears
only as evidence at the boundary/open-folder beat and in the score ledger preview.

## Three treatments considered

1. **Ruled assembly line (chosen).** A long desk ruled with brass station bays. The cohort pack
   rides the rule; the camera trucks from bay to bay. Each bay owns the full frame when it is
   active. Previous bays leave the frame; the persistent eight-step rail carries continuity.
   Literal, calm and legible. It uses the existing desk/paper/brass world without adding a new
   metaphor.
2. **Conveyor of paper trays.** A belt with rollers carries trays between stations. It reads as a
   factory line and adds rollers, belts and motion that teach nothing about the allocation.
3. **Exploded desk.** Documents float in exploded layers and the camera drifts between them. It is
   atmospheric and suggests relationships, but it hides the order of the process. The camera would
   wander rather than follow a route.

The ruled assembly line wins because process is the subject. Each station is a place, each paper
object is an input or an output, and the camera movement is the hand-off between steps.

## Chosen treatment

- One long desk, four station bays in this phase (Inputs, Form, Boundaries, Score).
- A kraft cohort pack sits on the rule and is the only object that stays with the camera. It gains a
  seal at Form and four boundary marks at Boundaries.
- Station content fades out **before** the camera leaves and fades in **after** it arrives. The stage
  rail is the continuity, not a half-visible previous station. No number is ever cut by the frame.
- The active station owns the frame. The scoring ledger is composed at full station width: large
  score, ten readable factor rows, no 273 px compromise.
- The stage rail always shows all eight steps. Steps 5–8 are marked as the rest of the pipeline and
  are disabled in this 10-second spike.

## Beat sheet

| Time | Station | What moves | Caption |
|---|---|---|---|
| 0.0–2.5 | 01 Inputs | Cohort pack rises; intake sheet shows roster 96 and rooms 38; private 12-question form slip. | A roster, a room list, a private form. |
| 2.5–5.5 | 02 Form | 96 response cards fill the board; raw-answer envelope seals; a normalised-preference slip with ten factor names moves out. | Students answer once. Raw answers stay sealed. |
| 5.5–9.0 | 03 Boundaries | Four hard stamps land on the pack; four segment folders rise; 4,560 → 3,456 → 1,104; the R-12 folder opens. | Four boundaries decide who can be compared. |
| 9.0–10.0 | 04 Score hand-off | Camera trucks to the pair ledger; the ledger fades in fully framed; Replay appears. | Every eligible pair is scored on ten weighted factors. |

## Camera path

Station units: 0 Inputs, 1 Form, 2 Boundaries, 3 Score.

- 0.00–1.85 hold on Inputs.
- 1.85–2.50 truck to Form.
- 2.50–4.85 hold on Form.
- 4.85–5.50 truck to Boundaries.
- 5.50–8.80 hold on Boundaries.
- 8.80–9.40 truck to Score.
- 9.40–10.00 hold on Score, fully framed for review.

All camera motion is an inline `translate3d` written by a `requestAnimationFrame` playhead. Station
fades are inline opacity. There are no panel swaps, no CSS transitions carrying main motion and no
intersection gate.

## Data used

Real sample-run data only: 96 students, 38 rooms, 4 segments of 24, 4,560 possible pairs, 3,456
never compared, 1,104 scored, R-12 · S-009 × S-021 · 0.416, ten weighted factors. No raw answers,
no invented institutions, no testimonials.

## Phase 1 scope

Only the 10-second slice at `?pipeline=1`. The classic film stays the default at `/`. The six
sections, hero copy and footer are untouched. The full 45–50 second film and stations 5–8 are not
built yet.
