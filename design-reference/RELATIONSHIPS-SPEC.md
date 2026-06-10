# Relationships — feature spec

**Status:** partially built into the canon prototype (`index.html`). Wave
feature 3. Exploration: `Relationships - explorations.html`.

## Update (Jun 2026) — Relationship Map visual overhaul (Direction B committed)

The map got a full restyle, explored in **`Relationship map - explorations.html`**
(three directions; the user picked **B · "Cartographer's key"**) and committed
into `relmap.jsx` + `relationships.css` (`.rmap-*` block). Mechanics unchanged
(static FR layout, degree sizing, type filter, hover-focus, click-to-open).
What changed visually + structurally:

- **Six-type color system** from the existing `--label-*` palette: clay
  characters · moss locations · gold items · plum factions · sea lore (themes
  stay off the map). No more flat-gray non-character types.
- **Nodes:** 15% type-tint body on paper, 1.6px type ring + a faint outer
  double ring (chart voice), **type icon** in the node (single-person glyph for
  characters; `ENTITY_TYPE_DEFS[t].icon` for the rest — custom types carry
  their own icon). Hover: ring thickens to 2.5px, +7% scale, warm drop-shadow.
  Dim state 0.16 opacity. `icons.jsx` now exports `window.ICON_PATHS` (the raw
  path strings) so SVG nodes can embed glyphs via nested `<svg>`.
- **Name labels:** italic Literata 12.5px with a paper-halo stroke
  (`paint-order: stroke`) — legible over edges, place-name-on-a-chart feel.
- **Edges:** 1.8px `color-mix(ink-2 42%)` quiet strokes (75% when adjacent to
  the hovered node); labels are italic serif with the same halo, shown for
  ≤18-node casts or on hover.
- **Canvas:** ruled double-line chart frame on paper; the canvas now also
  **shrinks around sparse casts** (min 560×420 instead of 760+) so 2–3 nodes
  sit in a considered frame.
- **Map key card** (`.rmap-key`) bottom-left inside the canvas — lists the
  types present with color/shape swatches. The layout reserves that corner
  (exclusion zone in `frLayout`) and a **label de-clash pass** separates name
  labels that share a band.
- **Footer hint** when linked entities exist but others don't: "N more
  entities aren't on the map yet — add ties from their entries…".
- **Empty state** (`.rmap-empty`): ghost dashed mini-graph, "No relationships
  yet", one line of guidance, and an "Open the Story Bible" action (`onBack`).
- **Both themes** via tokens only; dark gets its own drop-shadow values.
- Fixture: `Relationship map - dense example.html` now seeds all five types and
  supports `?theme=dark`, `?empty=1`, `?zoom=0.6` for quick visual checks.

### Porting checklist (map overhaul → production)

1. **Copy `relmap.jsx` → TSX.** It's self-contained except four globals to swap
   for imports/store reads: `window.ENTITY_DETAILS` (authored `people` links),
   `window.ENTITY_TYPE_DEFS` (`{label, icon, color}` per type, incl. custom
   types), `window.ICON_PATHS` (raw SVG path strings — see #3), `window.Icon`.
2. **Copy `relationships.css` verbatim** (the `.rmap-*` block is the new skin;
   keep the old `.relgraph` rules — the Full-Entry ego graph still uses them).
   External classes it leans on: `.corkboard`/`.corkboard-inner`, `.btn`/
   `.btn-soft` (app.css), `.fe-back` (full-entry.css), `.relmap-bar`/`.rel-chip`
   (same file). All colors/motion come from `tokens.css` — copy unmodified.
3. **Expose raw icon paths.** `icons.jsx` now exports `ICON_PATHS` because the
   node glyphs are nested `<svg>` with `dangerouslySetInnerHTML` — production
   needs the same raw-path access (or render Lucide components into the nested
   svg). Glyphs used: `user`, `mapPin`, `box`, `flag`, `globe`, `circleOpen`
   (fallback), plus `chevLeft`, `link`, `book` in the chrome.
4. **Data contract unchanged:** entities `{id, name, initial, type, color}`;
   undirected edges derived from `people: [{id, relation}]`, deduped by sorted
   id pair; **themes excluded**. Custom types appear automatically (icon +
   palette color from their type def).
5. **Behaviors to keep exactly:**
   - layout runs ONCE in `useMemo` (sig = node ids + edge count + W + rscale);
     no continuous simulation;
   - degree sizing `r = 15 + min(11, deg*2)`;
   - canvas `W = clamp(560, 250√N, 1500)`, `H = max(420, 0.64W)` — the small
     minimum is the sparse-cast framing, don't raise it;
   - edge labels at rest only when N ≤ 18, otherwise hover-only;
   - hover dims non-neighbours (nodes 0.16, edges 0.08), adjacent edges go 75%;
   - **the ResizeObserver on `.rmap-wrap` is load-bearing**: the key card is a
     fixed-px overlay, so the layout's corner exclusion is sized from the card's
     px size ÷ the measured render scale (`clientWidth / W`). Drop it and nodes
     land behind the card on narrow panes;
   - label de-clash pass after layout (est. width `name.length * 6.8 + 12`).
6. **Fonts:** the name/edge labels are *italic* Literata 500 — make sure the
   italic axis ships in the self-hosted Tauri fonts (see HANDOFF.md).
7. **QA parity:** reproduce the fixture checks — ~30 nodes default zoom (key
   card corner clear), `?theme=dark`, `?empty=1` (empty state + CTA), filter
   chips, click-to-open, footer hint when unlinked entities exist.

## Built into canon now

The Full Entry (`entry.jsx`) already had a working relationship list
(`people: [{id, relation}]`, add via `LivePicker`, unlink, relabel). This commit
upgraded it:

- **Curated relationship vocabulary.** The relation label is no longer free
  text by default — clicking it opens a preset menu (`RelationMenu`):
  Sibling / Parent / Child / Spouse / Friend / Ally / Rival / Mentor /
  Grandparent / Confidant, plus **Custom…** (falls back to the inline `Editable`).
- **Local ego-graph** (`FeEgoGraph`) on the entry: the character centred, its
  linked people around it, each edge labelled with the relation; click a node to
  open that entry. Characters render round, locations squared, palette-coloured.
  Shown for characters with ≥1 link.

Reuses `.relgraph` / `.rel-chip` / `.lbl-menu` styles (relationships.css +
outliner.css) and the `--character` / `--location` tokens.

## Deferred (documented follow-ups, NOT built)

*(All previously-deferred items are now built — see "Update" below.)*

## Update (Jun 2026) — reciprocal + map shipped

- **Auto-reciprocal edges built.** Picking a curated preset now writes the
  inverse edge on the other entity too (`relateReciprocal(fromId, toId, label,
  inv)` in app.jsx; presets carry `{label, inv}` in `entry.jsx`). Custom labels
  stay one-directional. Parent⇄Child, Mentor⇄Apprentice, Sibling⇄Sibling, etc.
- **Project relationship map built** as its own view (`view === "map"`,
  `relmap.jsx`): a **force-directed layout** (Fruchterman–Reingold-ish, run once
  in `useMemo`) so it stays readable at scale — verified clean at ~30 nodes
  (20 characters + 10 locations). Node size scales with degree; the canvas grows
  with the cast; **hover-focuses** a node's neighbourhood (dims the rest); edge
  labels show for small graphs or on hover. Reachable from the Story Bible
  "Relationship map" button; click a node opens that entry.
- **What appears:** any **relational** entity (characters, locations, items,
  factions, lore — anything with `people` links). **Themes are excluded** by
  design (tracked by scene appearance, not related). Currently only characters +
  locations have seeded links, so only they show until others are linked.

## Integration contract (for the port)

```ts
interface Relation {
  id: string; fromEntity: string; toEntity: string;
  label: string; reciprocalId?: string | null; createdAt: number;
}
// RELATION_PRESETS gains inverse labels for the auto-reciprocal:
type Preset = { label: string; inv: string };
const RELATION_PRESETS: Record<EntityType, Preset[]>;
```

### Store (extend `storyBibleStore`)
```ts
addRelation(from, to, label, opts?: { reciprocalLabel?: string }): Relation
listRelations(entityId): Relation[]
editRelation(id, label): void
deleteRelation(id): void          // cascades the reciprocal
allRelations(): Relation[]        // for the map view
```
### New table
```sql
entity_relations(id TEXT PRIMARY KEY, project_id TEXT, from_entity TEXT,
  to_entity TEXT, relation_label TEXT, reciprocal_id TEXT NULL, created_at INTEGER);
```
- In the **prototype**, relations are still the per-entity `people` array on
  `ENTITY_DETAILS` / `entryEdits` (via `onPatch`). The port replaces that with
  `entity_relations` rows; `listRelations(entityId)` returns both directions.

### Component map (prototype)
| Piece | Where | Notes |
|---|---|---|
| `FePersonCard` | `entry.jsx` | relation shown as a preset-trigger button; Custom → `Editable` |
| `RelationMenu` | `entry.jsx` | preset chips popover + Custom; closes on outside mousedown |
| `FeEgoGraph` | `entry.jsx` | SVG ego graph (character-centred) |
| `REL_PRESETS` | `entry.jsx` | curated labels (add `inv` for reciprocal at port) |
| `ProjectMap` | `relationships-explore.jsx` | the deferred map view (exploration only) |

### View states
no relations (quiet "Link a character") · picker open · relation menu open ·
graph shown only when ≥1 link · (deferred) map empty/loading.

### Constraints honored
No `setState` in `useEffect` (menu closes via a window mousedown listener; graph
derives from props). No `any`. Reuses `LivePicker`, `Editable`, theme tokens.

## Port recommendation — the map at scale

The prototype's `frLayout` (in `relmap.jsx`) is a hand-rolled
Fruchterman–Reingold force layout + a final `forceCollide`-style separation pass
(dependency-free, good to ~50 nodes). **For production, replace `frLayout` with
`d3-force`** and keep the existing SVG node/edge rendering:

- `d3-force` is pure JS (no framework/DOM assumptions) → works as-is under
  **Tauri 2 + React 19** (Tauri is just a system webview).
- Drive `forceSimulation(nodes)` with `forceManyBody()` (charge),
  `forceLink(edges)` (springs), `forceCenter()`, and **`forceCollide(r)`** (the
  real no-overlap force). Read `node.x/node.y` and render the *same* parchment
  SVG circles/squares + palette accents + hover/click this file already has.
- `react-force-graph` is a faster drop-in but renders to canvas (harder to match
  the parchment styling). `cytoscape.js` only if you want graph analysis.

Only `frLayout` is swapped; the component shape
(`RelationshipMap({entities, edits, onOpen, onBack})`, edges deduped from
`people`, degree-sized nodes, type filter, hover-focus) stays.

## Known follow-ups
- The two deferred items above (auto-reciprocal, map view).
- Relationship types per entity-type (faction "member of", etc.) — presets are
  currently the character set; widen with `RELATION_PRESETS[entityType]`.
