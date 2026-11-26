# Cohort pipeline explainer — full film

## What this is

A 50-second, one-camera, whole-cohort explainer for a first-time hostel warden, dean or housing
officer. One cohort of paper moves through eight labelled stations. Each station owns the frame and
teaches one step; the eight-step rail carries continuity. R-12 is the review case, not the spine.
R-15 is not used.

The approved 10-second spike established the ruled assembly line, the paper cohort pack and the
station-owned framing. This full film extends it to all eight stations and gives each station time
to read its one or two lines.

## Three treatments considered

1. **Ruled assembly line (chosen).** A long desk ruled with brass station bays. The cohort pack rides
   the rule; the camera trucks from bay to bay. Each bay owns the full frame when active. Previous
   bays leave the frame; the persistent rail carries continuity. Literal, calm and legible.
2. **Conveyor of paper trays.** A belt with rollers. It reads as a factory line and adds motion that
   teaches nothing about the allocation.
3. **Exploded desk.** Documents float in exploded layers. Atmospheric, but hides process order and
   lets the camera wander.

The ruled assembly line wins because process is the subject. Every object is an input or an output,
and every camera move is a hand-off between steps.

## Beat sheet

| Time | Station | What moves | Caption |
|---|---|---|---|
| 0.0–4.5 | 01 Inputs | Cohort pack enters; roster 96, rooms 38; private 12-question form. | A roster, a room list, a private form. |
| 4.5–10.0 | 02 Form | 96 response cards arrive; raw-answer envelope seals; normalised preferences move out. | Students answer once. Raw answers stay sealed. |
| 10.0–16.5 | 03 Boundaries | Four stamps; four segment folders with 12/8/12/6 rooms; 4,560 → 3,456 → 1,104; R-12 opens. | Four boundaries decide who can be compared. |
| 16.5–23.5 | 04 Score | Pair ledger; 0.416; ten raw scores, effective weights and bars; three zeros and one blank. | Every eligible pair is scored on ten weighted factors. Three zeros and one blank answer. The remaining weights renormalise. |
| 23.5–31.0 | 05 Match | Twelve chosen pair lines; 24/8/6 strategy counts; 38 rooms proposed. | The matcher chooses rooms from all pairs. |
| 31.0–38.5 | 06 Fairness | Twelve room bars; mean 0.827; R-12 0.416; red thread to two at-risk cards; 3/3/0 swap. | The average hides the room. The fairness statement puts it first. |
| 38.5–44.0 | 07 Documents | Assignments, reasons, fairness and audit cards; 96 notes; sealed raw answers. | Reasons, never raw answers. |
| 44.0–50.0 | 08 Sign-off | Signed slip, wax seal, keys held until the signature. Final composed frame. | A person signs before keys are issued. |

## Camera path

Station units: 0 Inputs, 1 Form, 2 Boundaries, 3 Score, 4 Match, 5 Fairness, 6 Documents,
7 Sign-off.

- 0.00–4.10 hold on Inputs; 4.10–4.50 truck to Form.
- 4.50–9.60 hold on Form; 9.60–10.00 truck to Boundaries.
- 10.00–16.10 hold on Boundaries; 16.10–16.50 truck to Score.
- 16.50–23.10 hold on Score; 23.10–23.50 truck to Match.
- 23.50–30.60 hold on Match; 30.60–31.00 truck to Fairness.
- 31.00–38.10 hold on Fairness; 38.10–38.50 truck to Documents.
- 38.50–43.60 hold on Documents; 43.60–44.00 truck to Sign-off.
- 44.00–50.00 hold on Sign-off; final frame with Replay.

Station content fades fully out before the truck and fully in after arrival. No half-cut numbers.

## Station notes

- **Inputs:** roster 96, rooms 38, private 12-question form.
- **Form:** 96 cards; raw answers sealed; ten factor names move on.
- **Boundaries:** four hard stamps; four segments of 24; rooms per segment 12/8/12/6; 4,560 possible
  pairs, 3,456 never compared, 1,104 scored; R-12 opens with “12 rooms”.
- **Score:** 0.416 for S-009 × S-021. Raw scores sit beside effective weights; bars encode raw
  scores. Three zero rows and one blank are explicit. The ledger holds for 6.3 s.
- **Match:** chosen pair lines for the 2-bed segment; 2-bed maximum weight (24 rooms across two
  segments), 3-bed seed and grow (8 rooms), 4-bed pair then merge (6 rooms); 38 rooms proposed.
- **Fairness:** room scores sorted; mean 0.827; R-12 0.416; two at risk below 0.55; swap pass 3
  passes, 3 accepted, 0 new Poor; fairness statement reports the floor. The red thread is the only
  one in the film and marks the review case.
- **Documents:** assignments (38 rooms, 96 beds), reasons (96 notes), fairness (floor 0.416, 2 at
  risk), audit (RM-D1C916, digest D1C9167C, 1,104 pairs, 3/3/0); raw answers remain sealed.
- **Sign-off:** proposal 38 rooms · 96 beds; at-risk 2 · R-12; floor 0.416; signature stroke and wax
  seal; keys labelled “After the signature / not issued by the desk / held”.

## Rules

- One stage, one camera; no panel swaps and no Previous/Next pages.
- Camera, fades, graph lines, bars, thread, signature and wax are written by a
  `requestAnimationFrame` playhead as inline transforms, opacity and custom properties.
- No CSS transitions carry main motion.
- The animation runs even when the OS reports reduced motion; no static fallback.
- Autoplay once on mount when visible; pause on tab hide and resume on visible; end with Replay.
- The rail seeks every station; keyboard controls are Pause, Replay, slider arrows and stage Space.
- Classic film is at `/?classic=1`; the full film is the default at `/`.

## Data

Real sample-run data only: 96 students, 38 rooms, four segments of 24, 4,560 possible pairs, 3,456
never compared, 1,104 scored, R-12 · S-009 × S-021 · 0.416, ten weighted factors, 2 at risk, 3 swap
passes / 3 accepted / 0 new Poor, 96 notes, run RM-D1C916, digest D1C9167C. No invented
institutions, testimonials or figures; no raw student answers.
