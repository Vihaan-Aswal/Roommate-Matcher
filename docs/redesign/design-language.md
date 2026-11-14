# Design language — extracted from the homepage (`9c491bf`)

The homepage is the source of truth. This is the language read out of it, before anything in the app
was changed. The app's implementation of it is in `02-design-system.md`.

## The idea in one sentence

A document being made under a lamp: a near-black forest-green room, one pool of warm light, aged cream
sheets laid on it, oxblood wax as the mark layer, amber only as an alarm.

## Materials

| Material | Where it is | What it means |
|---|---|---|
| Field (near-black green, `#060f0a` → `#182b1d`) | The room, header, footer, page ground | The working environment; everything else sits above it |
| Paper (cream, `#ece0c6` → `#f5ebd7`) | Sheets, registers, slips, the run stage | A document a person can act on or file |
| Wax (oxblood, `#6f1e22` / `#8a2a2e` / `#471013`) | Seal, underline, primary action, the current-section tick, poor marks | The evidence a person leaves behind |
| Amber (`#e0aa55`) | At-risk marks, the fairness floor rule, below-floor ids, the flagged room | Attention. Nothing else. |

Depth is physical and one-directional: paper sits *above* the field on layered shadows with a
vertical offset; there is no glass, no blur, and no zero-offset halo.

## Type

| Face | Job | Sizes on the homepage |
|---|---|---|
| Besley (variable serif, 400–900) | Judgement: the claim, section arguments, document names | Display 2.9–4.4rem / 800 / 0.92; Headline 2.1–3.5rem / 800 / 0.99; Title 20–34px / 700 |
| Public Sans (variable, 100–900) | Explanation: ledes and body | Lede 18–22px / 1.45; Body 16px / 1.7, max 66ch |
| IBM Plex Mono (400/500) | Evidence: labels, measurements, ids, table heads | 10px / 0.14em uppercase |

Rules the homepage keeps: the product name never becomes the largest type; mono is never the body
voice; no eyebrow or kicker above a heading (the only line above the hero claim is the masthead
carrying the product name and role).

## Layout and spacing

- 1200px measure, 24px side margins (16px under 768).
- 8px base; 16/24/32/48/64 inside components; 96–128px between sections; more space above a heading
  than below it.
- Sections never use equal-size card grids; each object is shaped by what it holds (a run stage, a
  folder of documents, a sticky heading beside a ledger).
- One persistent chrome element only: a 66px header plus a 1px wax progress rule; above 1320px a
  hairline margin rail with a wax tick.

## Interaction

- Pill controls (999px), 44px+ touch height, 1px inset highlight, visible focus (2px amber, 3px offset).
- Chips are mono caps inside a pill; risk chips are amber fill with paper-ink text *on paper only*.
- Everything rests in a complete, legible state when motion is unavailable.

## Voice

Plain, concrete, documentary. Short declaratives. Numbers with their unit and their scope. No
adjective stacking, no SaaS vocabulary, no manufactured urgency. Examples: "A room list you can sign."
/ "A run proposes. A person signs. Keys follow." / "Illustrative sample data. No account is needed to
watch the run."

## What the app keeps, and what it changes

| Kept identical | Changed for the operating surface |
|---|---|
| Palette, materials, typefaces, their jobs | Type scale reduced (page title ≤ 2.1rem) |
| Paper as the data surface, wax as the mark, amber as alarm | One continuous paper page per route instead of many floating sheets |
| Pill controls, small paper radii, offset shadows | 36px desktop / 42px touch controls; 24px minimum target |
| The plain voice | Copy rewritten for tasks, not for persuasion |
| Ruled registers, mono data, no decorative kickers | Dense tables, drawers, filters, and a dark rail for navigation |
