# Handoff: Brainstorm Canvas feature — discovery session brief

**Status:** NOT STARTED — this is the entry brief for a brainstorm/spec session (Lane A Stage 0–1).
**Origin:** Cole, 2026-06-10 — "do any writing apps have a brainstorm area in the app? One that kind of combines sticky notes, nodes, etc?"

## The idea

A brainstorm surface inside WritersNook: freeform canvas combining sticky notes, draggable
nodes, and connections — for plotting, worldbuilding, and pre-writing thought work.

## Market research (done 2026-06-10, web survey)

Two camps exist; almost nobody bridges them:

- **Integrated but rigid:** Scrivener (corkboard — cards ARE scenes), Plottr (timeline grid of
  sticky-note cards, color-coded by plotline), Campfire (17 linked modules), World Anvil
  (whiteboard with world articles pinned).
- **Freeform but disconnected:** Scapple (pure freeform mind-map, by Scrivener's makers),
  Milanote (mixed boards), Obsidian Canvas (2D whiteboard over vault notes).

**The gap:** a freeform canvas (Scapple-style sticky notes + nodes + connection lines) whose
items can LINK INTO the manuscript's real scenes and entities. Integrated tools are grids/
timelines; freeform tools have no manuscript wiring.

## Assets WritersNook already has (verify in session, but confirmed as of v0.2.6)

- **Entity system with mentions** — `.al-link` entity mentions in the editor with their own
  context menu (`src/editor/Editor.tsx`), relation picker, "find mentions". Canvas notes could
  reuse entity references directly.
- **One Yjs doc per scene** (load-bearing ADR — do not collapse). A canvas would likely be its
  own doc/table; persistence is SQLite via tauri-plugin-sql, Yjs state stored as base64 TEXT.
- **dnd-kit** is in the app (binder drag-and-drop). Note: dnd-kit drags can't be automated via
  CDP — human smoke needed for drag UX.
- **No built-in AI** is a deliberate product constraint — canvas must not depend on AI features.

## Constraints to honor

- Local-first, single-user, Windows now / mobile later (Phase 2 sync exists as foundation only).
- Calm/modern design language; hover doctrine: neutral hovers = furniture, accent = content
  surfaces (see memory `hover-two-tier-design-doctrine`).
- This is wave-sized-or-bigger: canvas library choice (e.g. react-flow vs tldraw vs custom
  SVG/dnd-kit) is an architectural decision → `sonnet-architect` + decision-review cell.

## Open questions for the brainstorm

1. Per-manuscript canvas, per-scene canvas, or global canvases-as-binder-items?
2. What links: entities only, or scenes/chapters too? One-way pins or backlinks ("appears on
   canvas X" from the entity panel)?
3. Node types for v1: sticky note, entity card, connection line — what else (images? regions/
   groups? colors)?
4. Does canvas content export/print? (Probably no for v1.)
5. Persistence: Yjs doc (sync-ready, consistent with scenes) vs plain SQLite rows (simpler)?

## Suggested entry

Run the `brainstorm` skill (default collaborative mode) with this file as context, then
`/wave-plan-lite` (or `/wave-plan` if it grows) for the spec.
