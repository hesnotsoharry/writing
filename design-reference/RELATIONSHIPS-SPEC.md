# Relationships — feature spec

**Status:** partially built into the canon prototype (`index.html`). Wave
feature 3. Exploration: `Relationships - explorations.html`.

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
