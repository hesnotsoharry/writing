# Brainstorm Boards — surface makeover spec

**Status:** Design proposed (Jun 2026). Styling-only phase — slots in after Phase 6
of wave 32 without touching wiring. Exploration canvas:
`brainstorm/Brainstorm Boards - exploration.html`. Source CSS (organized by
component, both themes): `brainstorm/board-explore.css`.

> Port note: drop this folder into `design-reference/` like the relmap bundle;
> the production change is a **CSS swap in `src/styles/app.css`** (lines ~1451–1541)
> plus a handful of small DOM additions in `BoardCanvas.tsx` / `CardNode.tsx`
> listed under **DOM additions**. Everything is token-driven, so both themes and
> the Tweaks accent come for free.

---

## The hole it fills (one-paragraph rationale)

The board works but renders as a default node-graph tool, which fights the whole
psychology of the feature. Scenes and entities are *ink on good paper* — bright
`--paper`, crisp hairlines, `--shadow-card`. A brainstorm card must read as
*pencil on scratch paper*: zero barrier to dumping a half-formed thought. The
makeover earns "less final" structurally, not with gimmicks — **the table recedes
and the cards stay bright**. The canvas steps off `--paper` onto the warm chrome
tone (`--parchment`) and gains a faint dot grid, so it reads as a drafting table,
not a page. Cards sit *above* that dimmer surface on `--paper` with **less
elevation, softer/slightly-irregular corners, a pencil-light hairline, and serif
body ink one step down (`--ink-2`)** — present and legible, but visibly looser
than a scene. Accent never decorates: per the two-tier hover doctrine it touches
**only the content surface** (a soft ring/wash on the card itself), while all
furniture — toolbar, delete, connection handles — hovers neutral parchment.
Entity cards break species entirely (a sans-serif reference token, type-colored,
never writable) and graduated cards dim to a breadcrumb. The result stays fully
inside the Quiet Study palette and token system; it just lowers the stakes.

---

## Recommended direction: **B · Drafting table**

The exploration ships three intensity dials on identical markup, gated by a
board-level class. **Pick B.** A and C are the calibration ends — keep them
documented so the dial can move without a redesign.

| Dial | Canvas | Card corners | Card shadow | Body ink | Reads as |
|---|---|---|---|---|---|
| **A · Margin notes** | near-`--paper` + faint grid | `--r-md` (even) | `--shadow-xs` | `--ink-2` | the same page, gridded — *too close to a scene* |
| **B · Drafting table ✅** | `--parchment` + clear dot grid | `10px 9px 11px 9px` (whisper of hand-cut) | `0 1px 2px` (barely there) | `--ink-2`, `--ink` on hover/edit | a drafting table — **the brief's target** |
| **C · Scratch pad** | `--parchment-deep` + cross-hatch | `12px 9px 13px 10px` + `±0.5°` tilt | none (border only) | `--ink-3` (pencil) | clearly informal — *risks twee at scale* |

B is the calibrated middle: the parchment tone shift does the "not a document"
work so the cards don't have to resort to tilt or dashed borders to feel loose.
C's per-card rotation and pencil-grey ink are there if user testing says B still
feels too composed; A is there if B reads too busy next to the editor.

---

## Per-element visual spec

Semantic tokens already theme themselves, so most "light/dark pairs" are the same
`var(--*)` name resolving differently. Resolved values are listed only where the
recipe mixes or where it helps the porter sanity-check.

### 1 · Canvas background — `.board-canvas` / `.react-flow`

| | Light | Dark |
|---|---|---|
| Surface tone | `--parchment` `#f4eee2` | `--parchment` `#1b1b18` |
| Dot color (`--board-dot`) | `ink-4 @ 42%` → ~`#cdbfa6` | `ink-4 @ 42%` → ~`#3a352d` |
| Dot grid | 22px gap, 1.5px dot | same |

Production: set the **tone** in CSS on `.board-canvas`; render the **dots** with
React Flow's Background so they live in the canvas layer and pan/zoom correctly:

```tsx
<Background variant={BackgroundVariant.Dots} gap={22} size={1.6}
  color="var(--board-dot)" />
```

Drop the default `<Background />` (lines/cross look like a spreadsheet). The
exploration fakes the grid with a CSS `radial-gradient` — fine as a fallback, but
the component is the canonical path in app.

### 2 · Text card — `.card-node` (`.card-node--readonly` / `--editing`)

Base: `background: --paper`, `padding: 11px 13px`, `color: --ink-2`, body text
`font-family: --font-prose` (Literata) at `--text-base`/1.55, `text-wrap: pretty`.
Min/max width `168–264px` (unchanged from current).

| State | Border | Shadow | Notes |
|---|---|---|---|
| **Resting** | `1px` `color-mix(--line 78%, --paper)` | `0 1px 2px rgba(58,46,28,.05)` | corners `10px 9px 11px 9px` |
| **Hover** (content → accent) | `--accent-ring` | `0 0 0 3px --accent-wash` + soft lift | `translateY(-1px)` |
| **Selected** | `--accent` | `0 0 0 3px --accent-ring` + `--shadow` | React Flow adds `.selected`; alias to `.is-selected` |
| **Editing** | `--accent` | `0 0 0 3px --accent-wash` + `--shadow-md` | bg stays `--paper`, body ink → `--ink`, lift reset to 0 |

Hover/selected/editing all key off the **card** (content surface) — that is the
sanctioned accent use. First line may carry `.ttl` (medium weight, `--ink`) for a
self-titled card; optional, never required.

### 3 · Delete affordance — `.card-node-delete` (FURNITURE)

Unchanged behavior, neutral hover: `opacity 0 → 1` on `.card-node:hover`,
`18×18`, `--ink-4`, hover `background: --parchment-deep; color: --ink`. No accent.

### 4 · Entity card — `.card-node--entity` (NEW — a different species)

A reference token, never a text card. Sans-serif (`--font-ui`), tinted body so it
never invites typing. Type color injected per node as `--etype` /`--etype-tint`
from the six-type system (`--label-{clay|sea|moss|plum|gold|slate}` + `-tint`).

- **Default — spine (E2):** tint body `--etype-tint`, `1px` border
  `color-mix(--etype 45%, --line)`, a 3px type-color left bar (`.ent-spine`), an
  italic-serif initial in a tinted disc (`.ent-glyph`), the live name
  (`.ent-name`, `--font-ui` 600, `--ink`), and an uppercase type label
  (`.ent-type`, `--text-2xs`, `--etype`). Hover: border → solid `--etype`.
- **E1 · pill** (`.ent--pill`): dot + name only, fully rounded — densest.
- **E3 · ring** (`.ent--ring`): `--paper` body, 1.6px `--etype` outline, no tint —
  lightest touch.

Recommend **spine** on the board (clearly a card-shaped *token*); pill/ring are
alternates for denser boards.

### 5 · Graduated card — `.card-node--graduated` (NEW)

Promoted into a real scene/entity → legible but spent. `opacity: .62`,
`filter: saturate(.8)`, body ink `--ink-3`; hover recovers to `.78` for re-reading.
The delete is replaced by a quiet **destination link** `.card-grad-link`
(`→ Chapter 5` / `→ Maren Vald`): `--accent-wash` pill, `--accent-deep` text,
`--text-2xs` 600. Optional G2 variant adds `.card-grad-seal` — a faint diagonal
"moved" stripe (`ink-4 @ 8%`) — if the dim alone doesn't sell "retired."

### 6 · Connections — `.react-flow__edge path` + handles `.react-flow__handle`

Plain, calm, no labels/arrowheads. **Curved** (committed) — React Flow's default
bezier edge (`type:"default"`), stroke `color-mix(--ink-4 85%, transparent)`,
`1.5px`, `stroke-linecap: round`. Selected/hovered edge → `--accent`. (A straight
variant exists but curved is the chosen, calmer read.)

**Four connection points per card** — a `<Handle>` on each side
(top/right/bottom/left). With `ConnectionMode.Loose` every handle is **both
source and target**, so a writer can start a link from any side and cards wire
**many-to-many** (any number of edges in and out of a card — the connections map
already supports this, no model change). Handles are FURNITURE: `9px` dots,
`--ink-4` with a `--paper` ring, `opacity 0` until `.react-flow__node:hover`,
hover → `--ink-2` + a slight scale. No accent.

> **Wiring fix:** `docToEdges()` currently sets `style={{ stroke: "var(--ink-4)",
> strokeWidth: 1.5 }}` inline, which beats any stylesheet rule. **Remove the
> inline `style`** so `.react-flow__edge path` in CSS wins without `!important`,
> and switch `type:"straight"` → `type:"default"` (bezier) for the curved look.

**Routing around cards + other lines (optional, demoed in the harness).** React
Flow draws edges point-to-point, so lines can cross a third card *and* overlap
each other. The harness ships a custom `routed` edge plus a **multi-edge planner**
that fixes both: `planEdges()` walks the edges in order, accumulating an
occupancy set; for each edge, if the straight line is clear of cards and isn't
grazing an already-placed line it stays a calm bezier, otherwise it runs a coarse
grid **A\*** that treats cards as hard obstacles and previously-routed lines as a
soft cost, then smooths the result with rounded corners. Net effect: lines bend
around cards, and around each other — they only ever meet where they legitimately
share a card. **Attachment is continuous + handle-free:** there are no visible
handle dots — each line attaches at the exact point where the center-to-center
line exits a card's border (`_borderPoint()`), so it connects anywhere around the
card at the most direct spot and slides along as you move it. (The "Floating
ends" toggle switches between this continuous attach and snapping to the facing
side's midpoint; four invisible handles remain in the DOM purely so drag-to-link
still works.) It's the "Around cards / No overlap / Floating ends" toggle in the harness. To port: add an
`edges/RoutedEdge.tsx` + a `planEdges()` pass (lift `routeAround()` /
`roundedPath()` / `planEdges()` from `Brainstorm Boards - interactive.html`),
compute paths in the board from the store's `nodeLookup` (positions + measured +
`handleBounds`), and feed each edge its path via `data.d`. Trade-offs to weigh
before committing: detoured lines read a touch more "diagram" than "loose
pencil," planning re-runs as a card is dragged (fine at this board's scale —
memoize on rounded positions for very large boards), and lines that share a card
still converge at that card (intrinsic). Recommend shipping it **on**, since
"never through a card, never overlapping" is the behavior you asked for.

### 7 · Toolbar — `.board-toolbar`, `.board-add-card`, `.board-add-entity` (NEW button)

Translucent parchment bar (`color-mix(--parchment 80%, --paper)` + `blur(6px)`),
`1px --parchment-edge` bottom. Buttons are furniture: `--ink-3`, hover
`--parchment-deep` / `--ink`. **Add entity card** is a new sibling button with a
small type-dot cue (`.ic-ent`). A right-aligned italic-serif `.board-title` names
the current board.

### 8 · Empty board state — `.board-empty`

Invite, don't look broken. A faint **dashed ghost card** ("Click to write…",
`--font-prose` italic, dashed `ink-4 @ 55%`, the same loose corners) over one
quiet line of guidance (`.board-empty-hint`, "A blank table for half-formed
ideas. **Add a card**, or just start typing."). `board-empty--line` drops the
ghost for a text-only variant.

---

## New tokens to add to `tokens.css`

Semantic aliases so the board's *intent* is named (map to existing values; both
themes):

```css
:root {
  --board-surface: var(--parchment);                              /* the table */
  --board-dot: color-mix(in srgb, var(--ink-4) 42%, transparent); /* grid dots */
  --card-surface: var(--paper);                                   /* cards stay bright */
  --card-line: color-mix(in srgb, var(--line) 78%, var(--paper)); /* pencil hairline */
}
/* dark inherits via the mixes; override --board-surface only if you want a
   different night table tone (e.g. var(--parchment-deep)). */
```

(Direction A uses `color-mix(--paper 92%, --parchment)` for `--board-surface`;
C uses `--parchment-deep` + a second finer dot layer — see `board-explore.css`.)

---

## DOM additions (what the coding agent adds, not just styles)

These don't exist in `CardNode.tsx` / `BoardCanvas.tsx` on `master` yet:

1. **Entity card** — a new node `type` (e.g. `"entity"`) + `EntityNode` rendering
   `.card-node--entity` with `.ent-spine` / `.ent-glyph` / `.ent-name` /`.ent-type`,
   reading the referenced entity's live name + `color` from the Story Bible. Inject
   `--etype`/`--etype-tint` as inline style from the entity's label color.
2. **Graduated state** — a `graduated` flag on card meta → adds
   `card-node--graduated` and renders `.card-grad-link` (to the destination
   scene/entity) in place of `.card-node-delete`.
3. **Add entity card button** — `.board-add-entity` in `.board-toolbar`, wired to
   the entity-picker flow.
4. **Background props** — swap bare `<Background />` for the dots config above.
5. **Edge inline style + curve** — remove the inline `style` from `docToEdges()`
   and set `type:"default"` (bezier/curved) instead of `"straight"` (see §6).
6. **Four handles per card** — render a `<Handle>` on each side
   (`Position.Top/Right/Bottom/Left`), each `type="source"`, with
   `connectionMode={ConnectionMode.Loose}` on `<ReactFlow>` so links start from
   any side and cards connect many-to-many. (Today only Left/Right exist.)
7. **Board title** — optional `.board-title` in the toolbar from the active board's
   name.

Selection styling assumes React Flow's `.selected` class on the node wrapper; in
the exploration it's mirrored as `.is-selected` on `.card-node` — alias whichever
your RF version emits.

---

## Class map

| Class | Role | New? |
|---|---|---|
| `.board-canvas` / `.react-flow` | canvas tone + dot grid | restyle |
| `.card-node`, `--readonly`, `--editing` | text card + states | restyle |
| `.card-node-text`, `.ttl`, `.card-node-empty` | card body | restyle (+`.ttl` opt) |
| `.card-node-delete` | delete (furniture) | restyle |
| `.card-node--entity` + `.ent-spine/-glyph/-name/-type/-dot` | entity token | **new** |
| `.card-node--graduated` + `.card-grad-link` / `.card-grad-seal` | spent card | **new** |
| `.react-flow__edge path` | connections | restyle (+ remove inline) |
| `.react-flow__handle` | handles (furniture) | restyle |
| `.board-toolbar`, `.board-add-card` | toolbar | restyle |
| `.board-add-entity`, `.ic-ent`, `.board-title` | toolbar additions | **new** |
| `.board-empty` + `-ghost` / `-hint` | empty state | **new** |

---

## Try it — interactive harness

`brainstorm/Brainstorm Boards - interactive.html` is a **real `@xyflow/react`
board** wearing Direction B: drag cards, hover to reveal the four handles, drag
from any side to link, build many-to-many webs, double-click to edit, delete, add
cards/entities, toggle day/night. It seeds a small many-to-many graph + a
graduated card. This is the closest thing to the shipped surface and the best way
to feel the makeover before porting.

> Harness-only caveat (not for production): the file installs a tiny
> `setInterval`-driven `ResizeObserver` polyfill and a timer-backed
> `requestAnimationFrame` shim **because this design sandbox freezes both**, and
> React Flow measures nodes/handles exclusively through them. Real browsers and
> the Tauri webview deliver these natively — do **not** copy the shim into the
> app; it's belt-and-suspenders for the preview only.

---

## Changelog

- **Jun 2026 — Makeover proposed.** Three intensity directions (A · Margin notes /
  **B · Drafting table, recommended** / C · Scratch pad) on identical markup;
  full per-element states (resting/hover/selected/editing); entity-card species
  (spine default + pill/ring); graduated state (dim + destination link, optional
  seal); **curved (bezier) connections with four-side handles + many-to-many**;
  inviting empty state. Both themes, all values from `tokens.css`. Exploration:
  `Brainstorm Boards - exploration.html`; **interactive harness:**
  `Brainstorm Boards - interactive.html`; CSS by component: `board-explore.css`.
  Confirmed with the user: dial **B**, **curved** edges, **four-side handles**,
  **many-to-many** linking. Open: entity species (spine/pill/ring), graduated
  G1 vs G2.
