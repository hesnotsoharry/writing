---
status: PLANNED
created: 2026-06-10
---

# Wave 31: relationship-map-overhaul

## Plan

### Status

PLANNED · target v0.3.x (ships with or after v0.3.0 license release) · drafted 2026-06-10

### Goal

The production Relationship Map (`src/storybible/RelationshipMap.tsx`) renders the Claude Design
"Direction B · Cartographer's key" design instead of the current thin-gray d3-force view: six
type-distinct node treatments (clay characters · moss locations · gold items · plum factions ·
sea lore) with type icons in the nodes, italic Literata labels with paper-halo strokes, a ruled
chart frame, a map-key card with a layout exclusion zone, correct hover-focus (neighbours stay
lit), a designed empty state, and a footer hint for unlinked entities — identical in light and
dark themes, verified by CDP smoke against the design fixtures.

### Scope

**In scope:**

- `src/storybible/RelationshipMap.tsx` — full port from `design-reference/relmap.jsx` (design's
  run-once FR layout replaces d3-force *in this component only*)
- `src/components/Icon.tsx` — add missing `ICON_PATHS` glyphs: `box`, `flag`, `globe`, `link`
  (copy path strings from `design-reference/icons.jsx`)
- NEW `src/storybible/entityTypeDefs.ts` — built-in six-type `{label, icon, colorToken}` map +
  merge of store `CustomEntityType` rows (custom types get their stored icon/color, fallback
  `circleOpen`)
- NEW `src/styles/relationships.css` — `.rmap-*` block, `.rel-chip`, `.relgraph` ported verbatim
  from `design-reference/relationships.css` (production currently has NO `.rel-chip` definition —
  the filter chips are unstyled today; this port fixes that too)
- `src/test/relationshipsP4.acceptance.test.ts` — update to the new logic contracts (edge
  derivation, theme exclusion, type-def resolution)

**Out of scope:**

- `src/storybible/fullEntry/EgoGraph.tsx` and the d3-force dependency — EgoGraph still imports
  d3-force; the package stays in package.json. (Deferral path: a future ego-graph restyle wave.)
- Marketing-site screenshots of the new map — sequenced AFTER this wave ships (tracked in the
  Claude Design marketing brief, this session).
- Any Story Bible navigation/store changes — the component's props contract
  (`entities, relations, onOpenEntry, onBack`) is frozen; only the component's internals change.
- Theme entities on the map — excluded by design (tracked by scene appearance, not relations).

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Foundations: icon paths, entityTypeDefs, .rmap-* CSS | sonnet-implementer | pyramid · internal-only · Add 4 glyphs to ICON_PATHS from design icons.jsx; create entityTypeDefs.ts (6 built-ins on --label-* tokens + CustomEntityType merge, circleOpen fallback); port relationships.css into src/styles/ and import it; port ONLY the helper classes relmap.jsx leans on that production lacks (.rel-chip; check .btn-soft/.fe-back equivalents) | Internal — no observation point (consumed by Phase 2) |
| 2 | Port relmap.jsx → RelationshipMap.tsx | sonnet-implementer | trophy · internal-only (component swap behind existing route) · Replace d3-force internals with the design's run-once FR layout; keep props contract; adapter from production Relation[] to design edge shape (dedupe by sorted id pair, exclude themes); ResizeObserver key-card exclusion (LOAD-BEARING), label de-clash pass, hover dims non-neighbours (nodes 0.16 / edges 0.08, adjacent 75%), N≤18 label rule, W=clamp(560,250√N,1500), key card, empty state w/ onBack CTA, footer hint; do NOT touch EgoGraph or remove d3-force | Story Bible → Relationship map shows the Cartographer's-key design: type-tinted icon nodes, italic serif halo labels, chart frame, key card bottom-left — orchestrator CDP smoke screenshot vs design fixture |
| 3 | QA parity + polish | sonnet-implementer (fix loop, dispatched per defect) | trophy · internal-only · Orchestrator seeds a dense cast (all 5 mapped types, ~10+ nodes) in the dev app, runs the smoke matrix, dispatches fixes for surfaced defects | Dense map in BOTH themes matches `Relationship map - dense example.html`; empty state shows ghost graph + "Open the Story Bible" CTA; node click opens its Full Entry; key-card corner stays clear at narrow pane width |

**Wave verification strategy (Site 4, declared once):** jsdom cannot observe SVG/map rendering
(project memory: CDP smoke is the only valid oracle for editor/canvas surfaces — green vitest ≠
working). Unit/acceptance tests cover pure logic only (edge derivation, type-def resolution,
de-clash math). Rendering verification is orchestrator-driven CDP smoke via the tauri-devtools
MCP on the already-running dev app (port 9222) after Phases 2 and 3 — `smoke:false` in run-phase
briefs because the workflow's smoke runner doesn't carry the tauri-devtools toolset; the
orchestrator smokes directly instead, same turn as the phase verdict.

### Acceptance criteria

- [ ] All five mapped types (character/location/item/faction/lore) render with distinct
      `--label-*` colors and type icons — zero gray-fallback nodes for built-in types
- [ ] Theme-type entities never appear on the map (logic-test + smoke)
- [ ] Hover dims non-neighbours only; the hovered node's neighbours and edges stay legible
- [ ] Key card lists only the types present; at a narrowed pane no node sits under the card
- [ ] Empty state renders the ghost mini-graph + guidance + working "Open the Story Bible" action
- [ ] Footer hint appears exactly when linked entities exist alongside unlinked ones
- [ ] Both themes correct via tokens only; node/edge labels render italic Literata 500
- [ ] Filter chips styled (`.rel-chip`) and functional; node click opens the Full Entry
- [ ] `npm run test` (incl. updated relationshipsP4 acceptance test), `tsc`, `npm run lint` green
- [ ] EgoGraph.tsx untouched; `d3-force` still in package.json
- [ ] CDP smoke screenshots captured: light-dense, dark-dense, empty, narrow-pane

### Files the next agent should read first

1. `design-reference/RELATIONSHIPS-SPEC.md` (lines 6–80) — the design delta + porting checklist; the wave's contract
2. `design-reference/relmap.jsx` — the source being ported
3. `design-reference/relationships.css` — the `.rmap-*` skin to port verbatim
4. `src/storybible/RelationshipMap.tsx` — the component being replaced (note its props contract)
5. `src/components/Icon.tsx` — ICON_PATHS export to extend
6. `src/db/storyBibleStore.ts` — Entity/Relation/CustomEntityType shapes (lines ~24, 105–118)
7. `src/styles/tokens.css` — `--label-*` palette (lines 67–84 light, 165–182 dark); already complete
8. `src/test/relationshipsP4.acceptance.test.ts` — existing acceptance contract to update

### Note to the implementer

This is a faithful port, not a reinterpretation: where `relmap.jsx` and the spec's porting
checklist disagree with your instincts, the design wins. Resist simplifying the "fussy" parts —
the ResizeObserver-driven key-card exclusion, the label de-clash pass, and the sparse-canvas
minimum are each load-bearing (the spec says why). Resist touching EgoGraph, the store, or the
props contract. The four `window.*` globals become imports: `ENTITY_DETAILS` → derive from the
`relations` prop, `ENTITY_TYPE_DEFS` → the new `entityTypeDefs.ts`, `ICON_PATHS`/`Icon` →
`src/components/Icon.tsx`. First step: verify the ## Locked decisions section has decisions
filled in.

Before declaring a phase complete, restate the observation point from the Phases table
Observation column in your own words and describe what you actually observed there. If you could
not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so
explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit
boundary is necessary but not sufficient.

**Known gap (data adapter):** the design derives edges from authored `people` links on
`window.ENTITY_DETAILS`; production passes `relations: Relation[]` rows. Phase 2 writes the
adapter (dedupe by sorted id pair, label from the relation row, themes excluded) — the updated
acceptance test pins this derivation; don't infer it from the design file alone.

**Known gap (custom-type icons):** production `CustomEntityType.icon` strings may not match any
`ICON_PATHS` key — resolve through `entityTypeDefs.ts` with `circleOpen` fallback, never a crash.

## Locked decisions

*(none yet — design-level decisions (Direction B, FR layout, six-type palette, themes excluded)
were made and recorded upstream in `design-reference/RELATIONSHIPS-SPEC.md` and are inherited as
the wave's contract, not re-decided here. In-wave decisions will be appended after passing the
decision-review cell.)*

> Before any decision is written here it must pass the decision-review cell
> (`~/.claude/rules/best-practice-spectrum.md`, M-42 P2): `sonnet-architect` produces it, a
> `sonnet-adversarial-reviewer` with `Posture: attack-decision` clears it, the orchestrator
> adjudicates — THEN it is appended. The `adversarial_review_enforce.mjs` hook denies the edit
> otherwise; trivial decisions skip via the `review-tier-{session_id}.json` sidecar.

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|

## Follow-up candidates

*(empty — default; mid-wave friction is fixed inline per scope-creep tiers)*

## Result

*(filled at ship by wrap team)*
