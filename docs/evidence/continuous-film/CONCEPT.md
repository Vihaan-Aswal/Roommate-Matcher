# Continuous homepage film — phase 1 concept

## What the old film does

The current film is seven composed panels mounted in the same grid cell. Each panel is centred in
the frame; the frame never moves. The page changes the panel with a fade and a small lift, and the
caption lives in a block beneath the image. Under reduced motion it becomes Previous/Next page
controls. It is well drawn, but the viewer sees seven slides of one desk, not one camera in one room.

## Three stronger directions

1. **The long desk.** One ultra-wide desk; the camera trucks left to right past the roster, the
   boundary folders and the pair ledger, with the lamp and ruler as foreground parallax. Literal,
   calm and easy to read. It risks feeling like a horizontal scroll rather than a film.

2. **The lamplight survey.** The camera is the lamp pool: darkness recedes as a warm light travels
   across the desk. Beautiful, but the evidence would spend too long in shadow, and heavy filters
   are the wrong tool for a dense ledger.

3. **The thread pull.** One desk, one red thread tied to the sealed responses. The camera follows
   the thread through the boundary folders to the pair ledger; the thread draws itself as the take
   runs and ends as a knot at the sheet. This is the chosen direction.

## Why the thread pull is stronger

- **It makes the desk one object.** The thread physically crosses every beat, so the roster, cards,
  folders, stamps, ruler and ledger are in the same room rather than in seven compositions.
- **It gives the camera a reason.** The camera is not moving because a timer fired; it is following
  the thread from the raw responses to the pair score.
- **It is already in the product's language.** Wax, thread, folded paper and brass are the world's
  materials. The thread is not a new visual metaphor; it is the fairness thread, pulled earlier.
- **It solves the caption problem.** A thin wax thread is also the progress rail. The timeline and
  the image share one material.

## The 10-second take

- **0.0–2.6 s, cold open.** Wide on the night desk; the lamp warms up. 96 responses, 38 rooms.
- **2.6–5.2 s, boundary.** The camera pushes into the response cards and the four boundary folders.
  The thread draws through the cards; the boundary ledger reads 4,560 → 3,456 → 1,104.
- **5.2–7.8 s, R-12.** The camera trucks right into the ten-factor ledger. The factor bars draw in,
  the R-12 score settles at 0.416, and the blank sleep-schedule answer is visible in the row.
- **7.8–10.0 s, R-15.** The same sheet holds S-035 × S-047 at 0.733. A small pull-back returns the
  folders to the frame, then the take stops with Replay.

## Rules for this phase

- One stage, one camera; no panel swaps and no Previous/Next.
- The camera, thread, factor bars and score marks are written by a `requestAnimationFrame` playhead
  as inline transforms and custom properties. No CSS animation carries the main motion, so the take
  runs even when the OS asks for reduced motion.
- Pause is always visible and keyboard reachable. The progress rail is a slider; chapter markers are
  time buttons. Replay restarts.
- The classic film stays at `/`; this spike is only at `/?continuous=1`.
- The six sections, header, hero copy, CTA and footer are untouched.
