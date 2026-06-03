# Wave 2 — Research Extract: dnd-kit + React 19, tauri-plugin-sql Transactions

**Date:** 2026-06-02  
**Topics:** Drag-and-drop multi-container UI, atomic database writes for reorder  
**Status:** DRAFT — grounds Phase 2 implementation planning

---

## Topic 1: dnd-kit with React 19 + Multi-Container Drag

### React 19 Compatibility

**Finding:** dnd-kit **fully supports React 19** as of Q2 2026. The library has resolved TypeScript build errors related to React 19 type compatibility (explicit return type annotations, useRef readonly fixes). Current peer dependency declares `react^18.0.0 || ^19.0.0`.

**Sources:**
- [@dnd-kit/react migration guide](https://github.com/clauderic/dnd-kit/blob/main/apps/docs/docs/react/guides/migration.mdx) — React 18/19 peerDependencies confirmed.
- [dnd-kit releases](https://github.com/clauderic/dnd-kit/releases) — v0.4.0 published 2 months ago; v0.5.0-beta available as of May 2026.

### Architecture Shift: Legacy → @dnd-kit/react

**Finding:** The dnd-kit project has **deprecated the old modular pattern** (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`). New projects should use **`@dnd-kit/react`** + **`@dnd-kit/helpers`** instead.

- `@dnd-kit/react` = thin React integration layer on top of the vanilla library.
- `@dnd-kit/helpers` = utility functions like `move()` for cross-list transfers.

**Code shape for multi-container drag (scenes ↔ chapters, etc.):**

```jsx
import { DragDropProvider } from '@dnd-kit/react';
import { move } from '@dnd-kit/helpers';

export default function App() {
  const [items, setItems] = useState({
    Chapter1: ['scene-1', 'scene-2'],
    Chapter2: ['scene-3'],
    ShortPieces: [],
  });

  return (
    <DragDropProvider
      onDragOver={(event) => {
        setItems((items) => move(items, event));
      }}
    >
      {/* Render chapters + scenes */}
    </DragDropProvider>
  );
}
```

The library detects `initialGroup !== group` to handle cross-container transfers; same-group drags are reorders within the list.

**Sources:**
- [@dnd-kit/react quickstart](https://github.com/clauderic/dnd-kit/blob/main/apps/docs/docs/react/quickstart.mdx) — installation + architecture.
- [Multiple sortable lists guide](https://github.com/clauderic/dnd-kit/blob/main/apps/docs/docs/react/guides/multiple-sortable-lists.mdx) — multi-container pattern using `onDragOver` + `move()`.

### Install Command

```bash
npm install @dnd-kit/react @dnd-kit/helpers
```

**Note:** Do NOT install the legacy `@dnd-kit/core` or `@dnd-kit/sortable` — the modern package replaces both.

---

## Topic 2: tauri-plugin-sql 2.x — Transactions & Atomicity

### Transaction Support: Limited, With Caveats

**Finding:** `tauri-plugin-sql` v2.x **does NOT expose built-in transaction methods** in the JavaScript API (no `beginTransaction()`, `commitTransaction()`, `rollback()`). The GitHub feature request (#886) remains open and unresolved.

**What IS documented:**
- Migrations execute atomically (BEGIN/COMMIT wrapping is internal to the migration system).
- No explicit transaction control for application code.

**Workaround for atomic multi-row renumbering (drag reorder):**
Execute multiple `db.execute()` calls in sequence without explicit transaction wrapping. **This is NOT guaranteed atomic** — if a connection drops mid-sequence, the write is partially applied. For the initial Phase 1 scope (single-user, local SQLite), this risk is low, but it's a known limitation.

**Alternative:** Consider the `tauri-plugin-rusqlite2` fork, which exposes `beginTransaction()` / `commitTransaction()` / `rollbackTransaction()` methods. Trade-off: community-maintained, not official Tauri.

**Sources:**
- [Tauri v2 SQL plugin docs](https://v2.tauri.app/plugin/sql/) — states migrations are transactional; silent on user-code transactions.
- [GitHub issue #886](https://github.com/tauri-apps/plugins-workspace/issues/886) — feature request (open, "help wanted").
- [Manual transaction workaround gist](https://gist.github.com/RunasSudo/8d30798e7cd7bbddaaba0348c8ea8f58) — developers attempted BEGIN/COMMIT as raw SQL; reports rollback doesn't work reliably.

### JavaScript API: execute() & select()

**Parameter binding** (per sqlx convention):
- **SQLite/PostgreSQL:** `$1, $2, $3` (positional)
- **MySQL:** `?` (positional, unordered)

**Signatures (v2.x):**

```typescript
const db = await Database.load('sqlite:myapp.db');

// INSERT/UPDATE/DELETE
const result = await db.execute(
  'UPDATE scenes SET position = $1 WHERE id = $2',
  [newPosition, sceneId]
);
// result = { rowsAffected: number; lastInsertId: number }

// SELECT
const rows = await db.select<Scene[]>(
  'SELECT * FROM scenes WHERE chapter_id = $1 ORDER BY position',
  [chapterId]
);
```

**Sources:**
- [Tauri v2 SQL reference](https://v2.tauri.app/reference/javascript/sql/) — Database.execute() / Database.select() signatures.
- [Context7 tauri-plugin-sql docs](https://context7.com/tauri-apps/tauri-plugin-sql/llms.txt) — parameter binding syntax + QueryResult interface.

---

## Recommendations for Phase 2 Scope

1. **dnd-kit:** Use `@dnd-kit/react` + `@dnd-kit/helpers`. The modern API is stable, React 19–compatible, and well-documented. No adoption risk.

2. **Atomicity for reorder:** For Phase 1 (single user, local), sequential `db.execute()` calls are acceptable. **Phase 2 spike risk:** if live two-way sync is added, non-transactional writes will race with remote updates — plan to upgrade to `tauri-plugin-rusqlite2` or file a Tauri plugin PR to expose transactions. Log this as a future ADR decision.

---

**Next:** Use this extract to ground the Phase 2 plan (multi-container UI + reorder state machine).
