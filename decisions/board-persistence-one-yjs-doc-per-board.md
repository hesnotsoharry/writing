---
status: ACTIVE
decided-in: wave-32-brainstorm-boards
promoted-during: wave-32-brainstorm-boards
---

## Context
Boards must be Phase-2 sync-ready without inventing a second sync mechanism; tauri-plugin-sql can't round-trip BLOBs.

## Pick
One Y.Doc per board, stored base64 TEXT in `board_docs` via `BoardDocStore`/`SqliteBoardDocStore` mirroring the scene pair, bound with the existing `bindPersistence`. **Schema (corrected by adversarial review):** card metadata as plain JSON values in top-level `doc.getMap('cards')` (x, y, w, entityRef, graduated, destination); card text as **top-level** `doc.getXmlFragment('card-<id>')` reached via TipTap Collaboration `field:` — never a Y.XmlFragment nested inside a Y.Map (TipTap cannot reach nested fragments). Connections in top-level `doc.getMap('connections')` keyed by connection id (CRDT-safe deletes for Phase 2). Rejected: plain SQLite rows (two sync mechanisms in Phase 2 — the exact failure mode ADR 0001 exists to avoid).

## Consequences
Migration 015; full-suite run mandatory after (migration-test gotcha); per-card `UndoManager` scoped to the focused card's fragment; board docs report wordCount 0 through `extractPlainText` (accepted — no consumer).

## Enforcement
Seam test in acceptance criteria asserts the schema shape; migration gate.
