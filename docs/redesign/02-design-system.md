# 02 — Design system

> Everything here lives in `frontend/src/app/desk.css` (scoped to `.desk`) plus the shared
> components listed at the end. It is an extension of `DESIGN.md`, not a second system: same
> palette values, same typefaces, same material logic. Prefix `desk-` avoids touching the frozen
> `.mm-*` homepage classes.

## 1. Tokens

Declared on `.desk` so they cannot leak into the homepage. Values copied verbatim from `DESIGN.md`.

| Token | Value | Role in the app |
|---|---|---|
| `--field-abyss` | `#060f0a` | rail top, mobile top bar |
| `--field-deep` | `#0a1710` | rail body |
| `--field` | `#0e1f15` | page background behind the paper |
| `--field-warm` | `#182b1d` | active nav row |
| `--ink` / `--ink-dim` / `--ink-faint` | `#ece2cd` / `#bdb29d` / `#a19781` | text on the field |
| `--paper` / `--paper-high` / `--paper-shade` | `#ece0c6` / `#f5ebd7` / `#e2d3b2` | the ledger page, sheets, inputs |
| `--paper-ink` / `--paper-mid` | `#1d2519` / `#5b523e` | text and rules on paper |
| `--wax` / `--wax-bright` / `--wax-deep` | `#6f1e22` / `#8a2a2e` / `#471013` | primary actions, marks, "settled" |
| `--amber` | `#e0aa55` | attention only |

Measured contrast (the numbers this system is built on):

| Pair | Ratio | Use |
|---|---|---|
| `paper-ink` on `paper` | 12.6:1 | body and data |
| `paper-mid` on `paper` | 5.9:1 | labels, hints, table heads |
| `wax` on `paper` | 8.5:1 | links, marks, chip text |
| `paper-high` on `wax` | 9.8:1 | primary button text |
| `paper-ink` on `amber` | 7.5:1 | attention chip text |
| `ink` on `field` | 13.0:1 | rail text |
| `ink-faint` on `field` | 5.9:1 | rail labels |
| `amber` on `field` | 9.0:1 | focus ring in the rail |
| `amber` on `paper` | **1.6:1 — banned as text** | never used as type on paper |

## 2. The shell

```
.desk (field)
└── .desk-shell (grid: 248px | 1fr)
    ├── aside.desk-rail          sticky, full height, field gradient
    ├── div.desk-topbar          mobile only (<1024px): wordmark, workspace, <details> menu
    └── main.desk-paper          one cream ledger page, 20px gutter, 12px radius, offset shadow
        └── div.desk-page        max 1180px, 34/40px padding
```

Rules:
- The rail is the only persistent chrome. It carries the wordmark, the workspace (name + switch),
  the work sequence, and the account. Nothing else is sticky.
- Navigation is grouped **Setup → Run → Review**, with Dashboard above the groups. Group labels are
  mono 9px caps. Active row = `--field-warm` fill, `--ink` text, a 2px amber tick on the left
  (amber is the mark on the field; wax is unreadable there at 1.5:1).
- Mobile: the rail becomes a sticky top bar with a native `<details>` menu (keyboard operable, no
  focus trap needed, no JS state). Targets grow to 42px.
- The paper is the page. It is the only large light surface; there is exactly one per route.

## 3. Type

| Role | Recipe | Where |
|---|---|---|
| Page title | Besley 800, `clamp(1.6rem, 2.2vw, 2.1rem)`, 1.02 | every page h1 |
| Section title | Besley 700, 1.15rem | `h2` inside a page |
| Dateline | Plex Mono 400, 11px | workspace · run · segment, under the h1 |
| Lede | Public Sans 14.5px, 1.55, `paper-mid` | mast description |
| Body | Public Sans 15px, 1.6 | prose |
| Data | Plex Mono 400, 13px, tabular numerals | every figure, id, score |
| Label | Plex Mono 500, 9.5–10px, 0.13em caps | table heads, figure labels, group labels |

Rules kept from `DESIGN.md`: the heading stands alone (nothing above an `h1` or `h2`); the dateline
sits *under* the title, never above it; mono is for evidence only; no display type above 2.1rem in
the app.

## 4. Components

### Masthead (`.desk-mast`)
Title, mono dateline (workspace · run · segment), one lede sentence, actions right. A 1px rule
closes it. Actions are secondary; the page's primary action lives where its task is (directive strip,
run bar, link slip), so a page never has two competing primaries.

### Directive (`.desk-directive`)
The page's next action: one sentence in 15.5px plus one wax button between two hairlines. Used on the
dashboard (derived from real state). Distinct from `.desk-note` so an instruction never looks like a
warning.

### Figures (`.desk-figures` + `StatCard`)
A ruled instrument row, not a card grid: no boxes, 1px separators, mono value at 26px, label above,
hint below. `StatCard` keeps its `stat-*` test id.

### Stage strip (`.desk-stages` / `.desk-stage`)
Four stages in one row (2×2 under 1180px, stacked under 768). Each stage: step number, state chip,
serif name, mono value, and a 2px **state rule** at the bottom (paper-mid = pending, ink = settled,
amber = attention). No fake progress bars: the rule reports state, and only real ratios get a meter
elsewhere.

### Table (`.desk-table`)
A register: 1px top rule, mono caps heads, 9px cell padding, 1px row rules, hover wash at 3.5% ink,
`data-selected` row gets a 3% amber wash and a 2px wax left mark, `data-tone="attention"` row gets an
amber left mark. Under 768px, `data-stack="true"` turns each row into a labelled block
(`td::before { content: attr(data-label) }`) so nothing scrolls sideways.

### Chips (`.desk-chip`)
Pill, mono 10px caps, 1px border. `data-tone`: `mark` (wax border + wax text) for settled/ready/
excellent; `attention` (amber fill, paper-ink text, leading dot) for poor/at-risk/needs-review/failed;
`solid` (ink fill) for a hard label; default (paper-mid) for everything in between. `quiet` removes
the border for inline use.

### Notes (`.desk-note`)
3px left rule + tinted wash + title/body/actions. Tones: default (info), `attention` (amber),
`error` (wax), `success` (ink). Used for errors, empty warnings, generated-data caveats — **never for
loading** (loading has its own vocabulary).

### Empty / loading
- `.desk-empty`: dashed hairline, serif title, one line of guidance, optional action. `tone="good"`
  for a settled state (e.g. "every student has answered").
- `.desk-skel`: static blocks in paper-shade at the real content's height + `.desk-loading-note`
  ("READING THE WORKSPACE" in mono). No spinners, no pulse: the brief bans motion, and a paragraph is
  not a loading state.

### Buttons (`.desk-btn`)
Pill, 36px default / 30px compact / 46px large / 42px minimum on touch. Wax gradient primary with
inset highlight; `ghost` = 1px ink hairline; `quiet` = text only; `danger` = wax hairline that fills
on hover; `field` = cream hairline for the rail. Focus: 2px ink ring on paper, amber on the field.
Disabled: 45% opacity, no transform.

### Fields
`.desk-label` mono caps above the control; `.desk-input` / `.desk-select` = 1px paper-mid rule, 5px
radius, paper-high fill, 38px (44px on mobile). Errors set `aria-invalid` → wax border + 6% wax wash,
message in `.desk-error`. Radix Select/Checkbox are restyled through `.desk-select-radix`,
`.desk-popover*`, `.desk-checkbox-radix`.

### Drawer (`.desk-drawer`)
Right sheet on paper, 560px, scrim at 62% field-abyss, `role="dialog"` + `aria-modal`, Escape closes,
focus moves to the panel on open, scroll locked while open. Used for student detail on both results
pages.

### Disclosure / segmented control / slip / key-value
- `.desk-disclosure` — native `<details>` for reference material (questionnaire, Magic Fill).
- `.desk-seg` — pill segmented control for short enumerations (label filter).
- `.desk-slip` — the form link: mono URL on paper-high with a 3px wax left rule and the copy actions.
- `.desk-kv` — mono term / value grid for run records and student summaries.

## 5. State and density rules

1. **Every page has**: loading (skeleton + mono note), error (note + retry), empty (empty state with
   the reason and the way out), and success. No page may show a blank region with no explanation.
2. **Amber** appears only for at-risk, needs-review, impossible, failed, generated data. Never for a
   convenience action, never as a general accent, never as text on paper.
3. **One primary action per page.** Secondary actions are ghost or quiet.
4. **Numbers are mono and tabular**, right-aligned in tables, with their unit in the label.
5. **Density**: dashboard 24–28px section rhythm; registers 36–40px row height; forms 10px gaps
   inside a field group, 20px between groups; the public student form is the loosest surface (48px
   option rows).

## 6. Accessibility baseline

- Landmarks: `aside` (nav) + `main` + page `h1`; one `h1` per route.
- Skip link is the first tab stop on authenticated pages.
- Focus is always visible (2px, offset 2px, ink on paper / amber on field).
- Chips are decorative text; status is never colour-only — every chip carries its word.
- Tables use `th scope="col"`; stacked mobile cells keep their label.
- Drawer: labelled dialog, Escape, scrim close, focus on open.
- Contrast: every pair in §1 passes AA at its used size; amber is never used as paper text.
- Touch: 42px minimum on controls under 768px; 36px permitted for compact desktop controls.

## 7. Shared component inventory

| Component | File | Notes |
|---|---|---|
| Shell | `layouts/AdminLayout.tsx` | rail, mobile bar, paper, skip link |
| Masthead | `components/AdminPageHeader.tsx` | title / dateline / lede / actions |
| Figures | `components/StatCard.tsx` | keeps `stat-*` test ids |
| Status chip | `components/StatusBadge.tsx` | maps domain words → tones |
| Register table | `components/DataTable.tsx` | `align`, `stackOnMobile`, `caption` |
| Note | `components/InlineAlert.tsx` | info / success / error |
| Generated-data note | `components/DataWarningBanner.tsx` | amber note |
| Empty state | `components/EmptyState.tsx` | with optional action |
| Buttons / inputs | `components/ui/button.tsx`, `ui/input.tsx` | desk classes, Radix `asChild` kept |
| Select / checkbox / toast | `ui/select.tsx`, `ui/checkbox.tsx`, `ui/toast.tsx` | portaled styles in `desk.css` |

Removed (became unused once every page moved to the register/note vocabulary): `ui/card.tsx`,
`ui/badge.tsx`, `ui/table.tsx`, `ui/alert.tsx`, `ui/skeleton.tsx`, `ui/sheet.tsx`.
