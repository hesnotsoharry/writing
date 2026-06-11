---
status: PLANNED
created: 2026-06-10
---

# Wave 32 — Brainstorm Boards (staging-area canvas)

## Plan

### Status

DRAFT · target v0.4.0 · drafted 2026-06-10.

### Goal

The app gains a "Brainstorm" binder section holding multiple topic-clustered boards — pan/zoom canvases of rich-text cards (one-liner to a few paragraphs, TipTap) — giving pre-commitment material (ideas, what-ifs, lore drafts, prose fragments) a home inside the app instead of Google Drive. Cards graduate into the real manuscript: entity cards reference live Story Bible entities, a card can be promoted to a new entity or scene, card text can be sent (appended) to any scene — including one currently open in the editor, without data loss — and graduated cards dim with a link to their destination, preserving the thinking record.

### Scope

**In scope:**

- Migration 015: `boards` + `board_docs(board_id TEXT PK, state_base64 TEXT)` tables (base64 TEXT, never BLOB).
- `src/db/boardDocStore.ts` + `src/db/sqliteBoardDocStore.ts` mirroring the scene-doc store pair; persistence via existing `src/yjs/bindPersistence.ts` unchanged.
- New dependency `@xyflow/react` ^12 (React Flow, MIT); new feature directory `src/features/brainstorm/` (`BoardCanvas.tsx`, `CardNode.tsx`, `BoardView.tsx`, board store).
- Binder "Brainstorm" section: board list, create/rename/delete boards.
- Cards: add/delete, drag-position (written on drag end), read-only display by default, lazy TipTap mount on click (Collaboration `field:` against top-level `card-<id>` fragment).
- Connection lines between cards: plain lines, no labels; stored in `doc.getMap('connections')` keyed by connection id.
- Entity cards: card variant storing `entityRef` id; renders live entity name/type; missing-entity placeholder on deletion.
- Graduation pipeline: promote card → new entity or new scene; send-to-scene append with hot/cold target resolution; graduated dim state with "→ destination" navigation link.

**Out of scope:**

- Drag card → editor text (deferred — v1.5 candidate per discovery; send-to-scene covers ~90% of the value).
- Board open in a side panel beside the editor (deferred — highest-value v1.5 candidate, separate wave).
- Images on boards (deferred — touches persistence + backup design; demonstrated need is textual).
- Quick-note → board injection (deferred — promote later if wanted).
- Timelines (will-not-fix in this product shape — Plottr's domain).
- Export/print of boards (will-not-fix for v1 per original brief).
- Any sync infrastructure (Phase 2 of the product, per ADR 0001 — boards are sync-READY via Yjs, not synced).

### Phases

Wave verification strategy (declared once per Site 4): every UI-rendering phase runs agent-driven CDP smoke via `run-phase` `smoke: true` (dev build, CDP port 9222, tauri-devtools MCP). Card/board state is verifiable via `evaluate_script` against real DOM; React Flow renders DOM nodes, not a bitmap canvas. The first phase's smoke is the wave's capability probe.

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Walking skeleton: board end-to-end | sonnet-implementer | **Walking skeleton — thinnest end-to-end slice** through every layer of the new surface: migration 015 → `BoardDocStore`/`SqliteBoardDocStore` (mirror scene stores) → binder "Brainstorm" section with one default board → `BoardCanvas.tsx` (React Flow ^12; import dist CSS, verify no app-shell style clash) → one card: read-only div, lazy TipTap mount on click writing top-level `doc.getXmlFragment('card-<id>')` via Collaboration `field:` (hydrate before mount, no `content` prop, `undoRedo: false`) → persists via `bindPersistence` → **end-to-end smoke run**: type into card, restart app, text persists. Honeycomb · cross-boundary (persistent storage). Run FULL test suite (migration gotcha). | Cole opens the app, sees a "Brainstorm" section in the binder, opens the board, clicks the card and types — after an app restart the typed text is still on the card. |
| 2 | Boards + cards CRUD, drag | sonnet-implementer | Create/rename/delete boards in binder; add/delete cards; drag positioning — position written to the card's `cards` Y.Map entry on drag END only (Decision 5, tombstone mitigation); `nodrag` boundary so editing never pans/drags. Trophy · internal-only (extends P1 schema, no new tables). smoke: true. | Cole creates a second board, adds three cards, drags one to a new spot, reopens the board and sees the card where he left it. |
| 3 | Connection lines | sonnet-implementer | React Flow edges, plain lines, no labels; stored in top-level `doc.getMap('connections')` keyed by connection id (Decision 2); create by handle-drag, delete by select + Delete. Trophy · internal-only. smoke: true. | Cole drags from one card's edge handle to another card and sees a plain line connecting them; the line is still there after closing and reopening the board. |
| 4 | Entity cards | sonnet-implementer | Card variant storing `entityRef` (entity id only, no copied name); renders live entity name + type color from the entity store at render time (Decision 4 — renames propagate for free); deleted entity → "missing entity" placeholder state; added via entity picker. Trophy · internal-only. smoke: true. | Cole adds a character card to a board, renames that character in the Story Bible, returns to the board and sees the card showing the new name. |
| 5 | Send-to-scene (hot/cold safe) | sonnet-implementer | Append card text to a chosen scene as a Yjs update. MUST route through a hot/cold target resolver (Decision 3): target scene open in editor → apply update to the LIVE doc (mirror `App.snapshots.ts` `resolveTargetBytes` pattern); closed → cold load/apply/save (mirror `promoteNoteToScene.ts`). Orchestrator authors the failing acceptance test (hot-target case) BEFORE dispatch; implementer may not modify it. Honeycomb · cross-boundary (writes scene persistence). reviewTier: panel. smoke: true. | Cole sends a card to the chapter he currently has open in the editor and sees its text appear at the end of the open scene — and his next keystrokes in that scene don't erase it. |
| 6 | Promote + graduated state | sonnet-implementer | Promote card → new entity (text → description) or new scene (text → scene content, via existing creation paths); graduated cards dim and show a "→ destination" link that navigates to the created entity/scene; card content kept (provenance, no delete). Trophy · cross-boundary (creates entities/scenes through existing stores). smoke: true. | Cole promotes a matured card to a new scene, sees the card dim with a "→ Scene" link, clicks the link and lands in the new scene holding the card's text. |

### Acceptance criteria

- [ ] Migration 015 exists in `src/db/migrations2.ts` creating `boards` and `board_docs(state_base64 TEXT)`; the FULL test suite (`npm run test`) exits 0 after it lands (per `adding-migration-breaks-prior-migration-tests`).
- [ ] `@xyflow/react` ^12 is in `package.json` dependencies; `npm run lint`, `npx tsc --noEmit`, and `npm run test` all exit 0 at wave end.
- [ ] A seam test asserts the board Y.Doc schema: card text lives in top-level `doc.getXmlFragment('card-<id>')`; `doc.getMap('cards')` values contain only plain JSON metadata (no nested Y types); connections live in `doc.getMap('connections')` keyed by id.
- [ ] Orchestrator-authored acceptance test for send-to-scene HOT path passes: with the target scene's doc live, sending a card appends the text AND a subsequent live-doc edit + save does not lose the appended content.
- [ ] Send-to-scene COLD path test passes: target scene not open; card text appended via load/apply/save and visible on next scene open.
- [ ] A test or recorded CDP smoke shows an entity card rendering the entity's CURRENT name after a rename, and a "missing entity" placeholder after the entity is deleted.
- [ ] A test asserts graduated cards persist `graduated: true` + destination reference in the `cards` Y.Map; CDP smoke shows the dimmed state and the "→ destination" link navigating.
- [ ] No per-pointer-move Y.Map position writes: position `set` calls occur only on drag end (code review check on Phase 2 diff; a drag during smoke produces exactly one position update per card per drag).
- [ ] Each UI phase's `run-phase` smoke returned PASS or FLAGGED-with-flags-addressed (capability probe: Phase 1).

### Files the next agent should read first

1. `roadmap/wave-32-brainstorm-boards-research.md` — current API/contract extract (React Flow v12, TipTap multi-fragment `field:`, Yjs shapes, licensing) — phase briefs are grounded in this, not training data.
2. `## Locked decisions` section of this file — the adjudicated architectural contract (schema shape, hot/cold seam, drag-end writes).
3. `roadmap/discovery/2026-06-10-brainstorm-canvas-handoff.md` — the ratified product shape; do not re-litigate scope.
4. `src/db/sceneDocStore.ts` + `src/db/sqliteSceneDocStore.ts` — the reference shape the board stores mirror.
5. `src/yjs/bindPersistence.ts` + `src/yjs/serialize.ts` — persistence plumbing reused unchanged (note: `extractPlainText` reads the `content` fragment, absent on board docs — board saves report wordCount 0; that's accepted, nothing consumes board word counts).
6. `src/App.snapshots.ts` (`resolveTargetBytes`) — the existing hot/cold target discrimination pattern Phase 5 mirrors.
7. `src/features/quickcapture/promoteNoteToScene.ts` — the existing cold-path append + promote precedent.
8. `src/db/migrations2.ts` — migration numbering (next is 015) and shape.
9. `CLAUDE.md` — base64-TEXT gotcha, TipTap/Yjs wiring order, one-doc-per-scene rationale.

### Note to the implementer

The spirit of this wave: give half-formed material a calm, visibly-less-final home, and make the path from "staged" to "real manuscript object" one action. Resist: touching the scene editor beyond the Phase 5 seam, adding sync infrastructure (Phase 2 of the product, not this wave), images/timelines/export (explicitly out), and "improving" the corkboard or binder beyond adding the Brainstorm section. The board surface must feel less final than entities/scenes — calm design language still applies; hover behavior per the two-tier hover doctrine (neutral for furniture, accent for content). First step: verify the `## Locked decisions` section below has decisions filled in and read them before any code.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

> Decisions 1–5 passed the decision-review cell on 2026-06-10: `sonnet-architect` (agent a7684d9a8ba816d7f) → `sonnet-adversarial-reviewer`, `Posture: attack-decision` (agent ae6b0210e5bafb9b0, verdict FLAG) → orchestrator adjudication (items 1–2 adopted as fixes, item 3 justified-and-held).

### Decision 1: Canvas library — `@xyflow/react` v12 (React Flow) · durable: candidate

**Context:** First canvas surface in the app; cards embed TipTap; commercial paid app; agent smokeability matters.
**Pick:** `@xyflow/react` ^12 (MIT). Rejected: tldraw (watermark or paid commercial license — hard kill for a paid app); full custom canvas (3–4 weeks of viewport/coordinate/edge infrastructure); plain scroll-container without pan/zoom (surfaced by adversarial review, evaluated and rejected — pan/zoom is the established interaction model in every product the discovery cites as the user's mental-model sources (Scapple, Milanote, Obsidian Canvas), paragraph-sized cards exceed a viewport quickly, and retrofitting pan/zoom later rewrites the coordinate space).
**Rationale:** Custom nodes are plain React components (TipTap embeds behind a `nodrag` boundary); default edges are exactly the spec's plain lines; real-DOM output keeps CDP smoke viable; React 19 supported as of v12.
**Consequences:** One new dependency + its dist CSS (Phase 1 verifies no app-shell clash); cards render read-only by default with lazy TipTap mount on click — a Phase 1 constraint, not an optimization to defer.
**Enforcement:** Phase 1 walking skeleton + per-phase CDP smoke; lint/tsc gates on the dependency's types.

### Decision 2: Board persistence — one Yjs doc per board, corrected schema · durable: candidate

**Context:** Boards must be Phase-2 sync-ready without inventing a second sync mechanism; tauri-plugin-sql can't round-trip BLOBs.
**Pick:** One Y.Doc per board, stored base64 TEXT in `board_docs` via `BoardDocStore`/`SqliteBoardDocStore` mirroring the scene pair, bound with the existing `bindPersistence`. **Schema (corrected by adversarial review):** card metadata as plain JSON values in top-level `doc.getMap('cards')` (x, y, w, entityRef, graduated, destination); card text as **top-level** `doc.getXmlFragment('card-<id>')` reached via TipTap Collaboration `field:` — never a Y.XmlFragment nested inside a Y.Map (TipTap cannot reach nested fragments). Connections in top-level `doc.getMap('connections')` keyed by connection id (CRDT-safe deletes for Phase 2). Rejected: plain SQLite rows (two sync mechanisms in Phase 2 — the exact failure mode ADR 0001 exists to avoid).
**Consequences:** Migration 015; full-suite run mandatory after (migration-test gotcha); per-card `UndoManager` scoped to the focused card's fragment; board docs report wordCount 0 through `extractPlainText` (accepted — no consumer).
**Enforcement:** Seam test in acceptance criteria asserts the schema shape; migration gate.

### Decision 3: Send-to-scene hot/cold target contract

**Context:** Appending to a scene that is OPEN in the editor via the cold path silently loses the append on the next keystroke (live doc overwrites SQLite — seam already bit once, commit f47b0f6).
**Pick:** Send-to-scene routes through a hot/cold resolver mirroring `App.snapshots.ts` `resolveTargetBytes`: target open → apply the update to the live in-memory Y.Doc (its `bindPersistence` saves it); target closed → cold load/apply/save per `promoteNoteToScene.ts`.
**Consequences:** Board feature needs access to the open-scene identity + live doc reference at App level; Phase 5 is panel-tier with an orchestrator-authored hot-path acceptance test.
**Enforcement:** Orchestrator-authored acceptance test (Phase 5, pre-dispatch); panel review.

### Decision 4: Entity cards hold a reference, not a copy

**Context:** Entity renames/deletes must not strand stale names on boards.  **Pick:** Cards store `entityRef` (id) only; name/type resolved live from the entity store at render; deleted entity renders a "missing entity" placeholder.  **Rationale:** Renames propagate for free; no cascade machinery.  **Enforcement:** Acceptance criterion (rename + delete cases); Phase 4 smoke.

### Decision 5: Card positions written on drag end only

**Context:** Y.Map overwrites tombstone-accumulate; per-pointer-move writes bloat `state_base64` monotonically (adversarial review, failure-at-scale).  **Pick:** React Flow's local node state carries in-flight drag; the Y.Map `set` fires once on drag end.  **Enforcement:** Acceptance criterion — one position update per card per drag, checked on Phase 2 diff + smoke.

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | 2026-06-10 (run-phase `wf_922aadda-401`, panel tier, smoke=probe; prior SHA f47b0f6; oracle tests pre-authored at `src/test/db/boardDocStore.test.ts` + `src/test/features/brainstorm/boardDoc.test.ts`) | — | — | — |

## Follow-up candidates

<!-- DEFAULT: empty. Tier-3 TRIPLE gate (VALUE with present-harm: + STRUCTURAL + CLEARABILITY) required. Format: - [item]: [why not in-wave] | present-harm: [K1/K2/K3 with verifiable pointer]. -->

## Result

<!-- Filled at ship by wrap team. -->
