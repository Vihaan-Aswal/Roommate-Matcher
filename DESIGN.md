---
name: Roommate Matcher
description: A room-allocation desk for hostel offices, set as a lit document in a dark room.
colors:
  field-abyss: "#060f0a"
  field-deep: "#0a1710"
  field: "#0e1f15"
  field-warm: "#182b1d"
  ink: "#ece2cd"
  ink-dim: "#bdb29d"
  ink-faint: "#a19781"
  paper: "#ece0c6"
  paper-high: "#f5ebd7"
  paper-shade: "#e2d3b2"
  paper-ink: "#1d2519"
  paper-mid: "#5b523e"
  wax: "#6f1e22"
  wax-bright: "#8a2a2e"
  wax-deep: "#471013"
  amber: "#e0aa55"
typography:
  display:
    fontFamily: "Besley MM, Georgia, Times New Roman, serif"
    fontSize: "clamp(2.9rem, 4.6vw, 4.4rem)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Besley MM, Georgia, Times New Roman, serif"
    fontSize: "clamp(2.1rem, 3.9vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 0.99
    letterSpacing: "-0.02em"
  lede:
    fontFamily: "Public Sans MM, Segoe UI, sans-serif"
    fontSize: "clamp(18px, 1.65vw, 22px)"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0em"
  body:
    fontFamily: "Public Sans MM, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "0em"
  label:
    fontFamily: "IBM Plex Mono MM, Courier New, monospace"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.14em"
rounded:
  control: "999px"
  stage: "18px"
  paper: "12px"
  folder: "13px"
  file: "8px"
  room: "5px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "32px"
  xl: "48px"
  xxl: "64px"
  section: "128px"
components:
  button-primary:
    backgroundColor: "{colors.wax}"
    textColor: "{colors.paper-high}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "49px"
  button-ghost:
    backgroundColor: "{colors.field-deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "49px"
  paper-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.paper}"
    padding: "44px"
  chip-risk:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.control}"
    padding: "4px 10px"
---

# Design System: Roommate Matcher

## Overview

**Creative North Star: "The Lit Desk"**

The public homepage is a document being made under a lamp. A near-black forest-green field holds one pool of warm light. On it sit aged cream sheets: a run sheet that fills itself, a pair report, a folder of four documents, a sign-off slip. Oxblood wax is the mark layer — the stamp, the underline, the piece of evidence a person leaves behind. Amber is not a brand accent; it is an alarm.

This world is deliberately an office at night, not a dashboard at noon. The audience is the person who runs hostel allocation, so the page behaves like the paperwork they already trust: ruled registers, numbered room cells, a signature line, a floor that is reported rather than averaged. The product name is always Roommate Matcher; no institute, hall or term is invented.

Motion is physical and one-directional. Marks arrive, shelves form, pair edges draw, papers rise. Nothing loops and nothing floats decoratively. The same page rests in a complete, legible state when motion is unavailable.

**Key Characteristics:**
- Near-black green field with one warm light pool and fine engraved horizontal texture.
- Aged cream paper as the object layer; oxblood wax as the mark layer; amber only for at-risk or attention.
- Besley variable serif for display, Public Sans for body, IBM Plex Mono for data and labels.
- Pill controls and small-radius paper; shadows carry a vertical offset and soft blur.
- One deterministic sample run (96 students, 38 rooms, 1,104 pair scores) drives every figure.

## Colors

A committed field palette with three material roles: dark green light, cream paper, oxblood wax. The page is drenched in the field; paper objects are the only large light surfaces.

### Primary
- **Wax Oxblood** (#6f1e22): the mark layer. Primary actions, the seal, poor marks, underscorings, the current section tick. Its brightness is low so it reads as ink and wax, not as a UI alert.
- **Wax Bright** (#8a2a2e): hover and focus emphasis on wax controls; the wax seal's lit face.
- **Wax Deep** (#471013): border shadows, seal rim, dark ink on paper when an outline is needed.

### Secondary
- **Desk Amber** (#e0aa55): attention and risk only. At-risk marks, the fairness floor rule, the below-floor student ids, the at-risk room outline, the 1,104-pair figure. Never a general accent, never text on cream paper without a dark backing.

### Neutral
- **Field Abyss** (#060f0a): page top, header, the deepest quiet.
- **Field Deep** (#0a1710): upper field, button ghost fill.
- **Field** (#0e1f15): mid-page field.
- **Field Warm** (#182b1d): lower field, the warmer end of the gradient.
- **Ink** (#ece2cd): primary text on the field.
- **Ink Dim** (#bdb29d): body secondary on the field.
- **Ink Faint** (#a19781): labels and captions on the field; tested at 5.18:1 against the lightest field stop.
- **Paper** (#ece0c6): the object layer.
- **Paper High** (#f5ebd7): slip and card highlights.
- **Paper Shade** (#e2d3b2): the darkest paper stop, used as the contrast test surface.
- **Paper Ink** (#1d2519): primary text on paper.
- **Paper Mid** (#5b523e): labels and rules on paper; 5.22:1 against the darkest paper stop.

### Named Rules
**The Amber Rarity Rule.** Amber is reserved for at-risk or attention. If it appears on a healthy room, a decorative glow or a generic CTA, the page has misused it.

**The Two Pennies Rule.** Paper is an object, not a card grid. A paper surface must contain information a warden could act on or file; four identical empty cards are not paper.

## Typography

**Display Font:** Besley MM (variable 400–900; Georgia fallback)
**Body Font:** Public Sans MM (variable 100–900; Segoe UI fallback)
**Label / Mono Font:** IBM Plex Mono MM (400/500; Courier New fallback)

**Character:** A confident book serif with a slightly old-fashioned, institutional warmth, paired with a plain humanist sans and a court-record mono. The serif carries judgement; the sans carries explanation; the mono carries evidence.

### Hierarchy
- **Display** (800, clamp 2.9–4.4rem, 0.92): the hero claim and closing line only. The product name lives in the mono masthead line, the header wordmark, the footer and the seal, never as the largest type. Letter spacing no tighter than -0.025em.
- **Headline** (800, clamp 2.1–3.5rem, 0.99): section arguments, max 20ch, one sentence with a deliberate line break.
- **Lede** (400, clamp 18–22px, 1.45): the audience sentence under the product name.
- **Body** (400, 16px, 1.7): explanatory prose, max 66ch; secondary body in Ink Dim.
- **Title** (700, 20–34px, 1.1–1.2): document names, room-slip statements, limit claims.
- **Label** (500, 10px, 0.14em, uppercase): mono labels for data contexts only: SAMPLE PAIR, THE NOTE A WARDEN SEES, SIGN-OFF SLIP, table heads. No eyebrow labels above headings.

### Named Rules
**The Data Gets Mono Rule.** Mono is for measurements, identifiers, table values and document labels. It is never the body voice or a decorative "technical" texture.

**The Heading Stands Alone Rule.** No kicker, eyebrow or micro-label sits above an h1 or h2. The heading carries its own weight.

## Layout

The page is one continuous document with a 1200px maximum measure and 24px side margins (16px under 768px). Content alternates between the dark field and paper objects; the only persistent chrome is a 66px sticky header with the wordmark and one "Open the desk" control, a 1px wax scroll-progress rule under it, and (above 1320px) a fixed hairline margin rail with a wax tick.

The hero is a two-column argument at 1440: copy at 0.88fr, the run sheet at 1.12fr, stacked under 1024px. Section headers use a two-column split (heading left, 54ch explanation right) except the fairness section, which centres its statement as the page's conscience. The boundary section uses four segment lanes that become 2×2 under 1024px. The compatibility sheet and the sign-off slip are full-width paper objects; the artifact folder is a stack of four offset sheets. The limits section is a sticky heading beside a five-row ledger.

Spacing is generous and consistent: 8px base, 16/24/32/48/64px inside components, 96–128px section padding, more space above a heading than below it. Page sections never use equal-size card grids.

## Elevation & Depth

Depth is physical, not glassy. The field is flat with a light gradient; paper objects sit above it on layered shadows with a vertical offset and a soft, wide blur. Controls carry a 1px inset highlight and a compact drop shadow. There is no blur, no glass and no zero-offset halo.

### Shadow Vocabulary
- **Sheet at rest** (`0 2px 3px rgba(0,0,0,0.3), 0 34px 70px -24px rgba(0,0,0,0.65)`): large paper objects.
- **Stage** (`0 2px 3px rgba(0,0,0,0.35), 0 34px 64px -20px rgba(0,0,0,0.62), 0 70px 120px -50px rgba(0,0,0,0.55)`): the hero run sheet.
- **File in folder** (`0 14px 28px -20px rgba(0,0,0,0.55)`): stacked documents.
- **Wax seal** (`inset 0 2px 3px rgba(255,255,255,0.24), inset 0 -4px 10px rgba(0,0,0,0.55), 0 12px 20px -12px rgba(0,0,0,0.75)`): pressed wax.

## Shapes

Controls are soft and human: 999px pill radii on every button, chip and CTA, because the brief earned that roundness. Paper objects keep small, believable radii (12px sheets, 13px folder, 8px files, 5px room cells) and real edges; nothing is a 90° rectangle, and nothing is a rounded rectangle used as a generic card. Hairlines are 1px; the only decorative rule over 1px is the 2px wax tick in the margin rail. The wax seal is an irregular blob, not a perfect circle.

## Components

### Buttons
- **Shape:** pill (999px), 49px minimum height, 24px horizontal padding; 56px for the closing action.
- **Primary (wax):** oxblood gradient with cream text, inset top highlight, offset drop shadow. Hover lifts 1px and brightens; focus adds a 2px amber outline with 3px offset.
- **Ghost:** transparent field with a 1px cream hairline; hover fills with a 6% cream wash.
- **Replay:** small pill on the field below the run sheet, 11px label with a 13px rotate icon.

### Chips
- **Style:** mono uppercase text inside 999px, 1px border. `Sample run` uses a wax hairline and wax text on paper; `Good pair` uses a 10% paper-ink wash.
- **Risk:** amber fill with paper ink text only on paper; on the field, amber text on the field.

### Cards / Containers
- **Paper sheet:** 12px radius, cream gradient with a diagonal fibre, 1px paper-edge border, layered offset shadow. Internal padding 22–44px.
- **Folder:** 13px radius, darker cream, a raised tab above the top edge, holding four offset sheets.
- **Run stage:** 18px radius, cream, 1px edge, a quiet rotation of -0.28deg on desktop; 694px tall at 1440, 620px at tablet, 700px at mobile. Four register shelves; five room boxes across on desktop, four on mobile. Lane labels 10px at desktop and 11px at mobile; room ids 10px and 11px. Ghost shelves and room outlines are visible before the marks resolve.

### Inputs / Fields
No form fields appear on the homepage. The sign-off slip uses ruled blank fields: a 1px paper-ink rule with a mono caption, never a boxed input.

### Eyebrow
- **Style:** mono 11px, 0.14em, uppercase, ink-faint, sitting above a 1px rule. It carries the product name and role ("Roommate Matcher · Room allocation desk"), so the display line stays a product claim rather than a second wordmark.
- **Rule:** it is a masthead line, not a decorative kicker; it only appears above the hero claim.

### Navigation
The header is a single row: serif wordmark on the left, a ghost pill "Open the desk" on the right. There is no nav wall and no mobile menu. The skip link is the first tab stop and becomes a cream pill at the top-left when focused.

### Run Stage (signature)
A cream register sheet where 96 answer marks arrive over ghost shelves and room outlines, settle into four labelled segment shelves, gain room boxes and pair edges, and end under four fanned documents. Marks are driven by a deterministic fixture, not hard-coded positions; the stage announces each beat through a polite live region and rests in a complete state. A replay control reruns the sequence from arrival.

### Fairness chart
Four segment panels, 24 students each, sorted within the segment. Marks are 6px wide at 1440 and 4px at 390, with a labelled amber floor rule per panel. The two below-floor students are labelled at their marks, not in a footnote. The chart is 297px tall at 1440 and 418px at 390.

## Do's and Don'ts

### Do:
- **Do** keep the field palette scoped to `.mm-home`; the signed-in admin app keeps its own tokens.
- **Do** put every displayed figure on the page through `simulate.ts` so the pair count, rooms, labels, floor and weakest rooms agree.
- **Do** label every sample figure as illustrative and keep the seeded fixture deterministic.
- **Do** keep the product name in the header wordmark, the mono masthead line, the footer and the seal; the display line is a claim, not a second wordmark.
- **Do** use the margin rail and header progress rule as the persistent thread; they are the only continuous decoration.
- **Do** give controls 999px radii, visible focus and at least 44px touch height.
- **Do** let paper carry real content: a table, a reason, a floor, an audit row. Paper with one sentence on it is a card.
- **Do** keep amber for at-risk only.
- **Do** keep all meaningful text at 10px or larger; lane labels and room ids reach 11px on mobile.

### Don't:
- **Don't** invent an institute, hall, term, date or academic calendar.
- **Don't** put amber text directly on cream paper; use wax or back it with a dark/amber fill.
- **Don't** add a decorative kicker; the only line above the hero claim is the mono masthead carrying the product name and role.
- **Don't** number sections or repeat a card of icon + heading + text as the page structure.
- **Don't** use a repeating grid as texture; the field texture is fine horizontal engraving, and the stage's grid is structural.
- **Don't** use blur, glass or a zero-offset coloured halo as decoration.
- **Don't** make the homepage depend on auth, the API, a CDN, Google Fonts or any network request.
