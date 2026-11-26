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
- **2.6–8.4 s, the evidence frame.** The camera settles into one medium frame that holds the
  boundary ledger, the four folders and the pair ledger fully inside it; the roster and envelope are
  fully outside it. The thread draws through the cards, the boundary ledger reads
  4,560 → 3,456 → 1,104, and the factor bars and pair scores settle as the captions move from the
  boundary to R-12 (0.416) and R-15 (0.733). Nothing is half-cut at a paused beat.
- **8.4–10.0 s, the close.** The camera pulls back to the whole desk, where every object is inside
  the frame again, and stops with Replay.

## Rules for this phase

- One stage, one camera; no panel swaps and no Previous/Next.
- The camera, thread, factor bars and score marks are written by a `requestAnimationFrame` playhead
  as inline transforms and custom properties. No CSS animation carries the main motion, so the take
  runs even when the OS asks for reduced motion.
- Pause is always visible and keyboard reachable. The progress rail is a slider; chapter markers are
  time buttons. Replay restarts.
- The classic film stays at `/`; this spike is only at `/?continuous=1`.
- The six sections, header, hero copy, CTA and footer are untouched.
