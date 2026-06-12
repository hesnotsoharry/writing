# wave-35 — Research Extract

Research compiled 2026-06-12 for three technical surfaces: TipTap v3 selection handling, Anthropic token counting API, tauri-plugin-sql migrations.

---

## 1. TipTap v3 / ProseMirror Selection Handling

**Source:** TipTap Documentation (Context7: `/llmstxt/tiptap_dev_llms_txt`), ProseMirror Reference, TipTap Node Positions docs

### Reading Selected Text

**API:** `editor.state.selection` + `editor.state.doc.textBetween(from, to)`

```typescript
// Get selection boundaries and extract plain text
const { from, to } = editor.state.selection
const selectedText = editor.state.doc.textBetween(from, to)
const wordCount = selectedText.trim().split(/\s+/).length
```

- **`editor.state.selection`**: Selection object with `.from` and `.to` position properties (unresolved positions, type: `Selection`). Also exposes `.anchor` and `.head` for directional selection.
- **`editor.state.doc.textBetween(from, to, separator?, leafText?)`**: Returns plain text between two document positions, automatically handling node boundaries. Returns a string (no markup).

**Source:** [ProseMirror documentation](https://prosemirror.net/docs/ref/), [TipTap Editor Class docs](https://tiptap.dev/docs/editor/api/editor)

### Reading Selection Screen Coordinates

**API:** `editor.view.coordsAtPos(pos)` → `{ left: number, right: number, top: number, bottom: number }`

```typescript
// Get screen coordinates of the selection start position
const pos = editor.state.selection.from
const coords = editor.view.coordsAtPos(pos)
// coords = { left: 150, right: 160, top: 200, bottom: 218 }
```

- **`coordsAtPos(pos)`**: Returns a bounding box-like rect with `left`, `right`, `top`, `bottom` in pixels (viewport-relative). Useful for positioning floating menus above/beside selection.
- **Limitation (noted in GitHub #1313):** `coordsAtPos` may return unusual positions when dealing with atomic nodes or alignment; positioning logic should account for fallback coords if needed.

**Source:** [TipTap Node Positions docs](https://tiptap.dev/docs/editor/api/node-positions), [GitHub issue #1313](https://github.com/ueberdosis/tiptap/issues/1313)

### Selection Events & Collaboration

**For listening to selection changes with Yjs Collaboration extension:**

- Use the editor's `update` event (fires on every transaction, including remote updates).
- In TipTap, hook into transaction listeners via the editor's `update` event:
  ```typescript
  editor.on('update', ({ editor, transaction }) => {
    if (transaction.selectionSet) {
      const { from, to } = editor.state.selection
      // Handle selection change
    }
  })
  ```
- **Caution:** During streaming updates from Yjs (remote collaborators), selection events will fire; guard against rapid re-renders by debouncing or checking `transaction.selectionSet`.
- **Project gotcha (from `MEMORY.md`):** Editor effects must be ProseMirror-native (extensions/decorations) — external DOM mutations get reverted. Use a Decoration or extension to render the floating pill, not direct DOM updates.

**Source:** [TipTap FloatingMenu extension](https://tiptap.dev/docs/editor/extensions/functionality/floatingmenu), project memory `editor-behavior-needs-cdp-smoke-not-jsdom.md`

---

## 2. Anthropic Messages API — Token Counting

**Source:** Anthropic SDK TypeScript (Context7: `/anthropics/anthropic-sdk-typescript`), Token Counting docs

### Endpoint Shape

**Endpoint:** `POST /v1/messages/count_tokens`

```typescript
// Request body — same shape as messages.create()
const response = await client.messages.countTokens({
  model: "claude-opus-4-8",
  system: "You are a helpful assistant.",
  messages: [
    { role: "user", content: "Hello!" }
  ]
})

// Response
// {
//   input_tokens: 18,
//   cache_creation_input_tokens?: 0,   // if cache write occurred
//   cache_read_input_tokens?: 0         // if cache read occurred
// }
```

**Request Body:**
- Accepts the **exact same parameters as `messages.create()`**: `model`, `system`, `messages` (with full tool definitions, images, PDFs), `max_tokens` (optional), `temperature`, etc.
- No actual message generation occurs — purely a token count estimate.

**Response:**
- Returns `{ input_tokens: number }` — the token count for the provided input.
- May also include `cache_creation_input_tokens` and `cache_read_input_tokens` if prompt caching is in use.

### Cost & Rate Limits

**Pricing:** **FREE** — `count_tokens` requests are not billed. No charge for the endpoint itself. (As of June 2026.)

**Rate Limits:** Subject to standard API rate limits (per Anthropic's usage tier). As of 2026, rate limits increase based on spend tier (up to 50K requests/min for high-volume customers).

**Fallback for client-side estimation:** A naive `chars / 4` heuristic is still used in some libraries for rough estimates before calling `count_tokens`, but it is **not recommended for production**. The official endpoint is free and more accurate (especially for structured data, images, tool definitions).

**Source:** [Token Counting documentation](https://platform.claude.com/docs/en/build-with-claude/token-counting), [Anthropic API Pricing 2026](https://www.finout.io/blog/anthropic-api-pricing), pricing guides confirm `count_tokens` is free

---

## 3. tauri-plugin-sql Migrations (Tauri 2)

**Source:** tauri-plugin-sql v2 (Context7: `/tauri-apps/tauri-plugin-sql`), tauri-plugin-sql README

### Migration API Shape

**Registration:** Rust builder pattern in `src-tauri/src/main.rs`:

```rust
use tauri_plugin_sql::{Builder, Migration, MigrationKind};

let migrations = vec![
    Migration {
        version: 1,
        description: "create_initial_schema",
        sql: "CREATE TABLE manuscripts (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT
        );",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 2,
        description: "add_created_at_column",
        sql: "ALTER TABLE manuscripts ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;",
        kind: MigrationKind::Up,
    },
];

tauri::Builder::default()
    .plugin(
        tauri_plugin_sql::Builder::default()
            .add_migrations("sqlite:writing.db", migrations)
            .build(),
    )
    // ... rest of builder
```

**Struct fields:**
- `version: u32` — Unique version number; migrations applied in ascending order.
- `description: &str` — Human-readable name (informational only).
- `sql: &str` — The SQL statement(s) to execute.
- `kind: MigrationKind` — Either `MigrationKind::Up` (forward) or `MigrationKind::Down` (rollback).

**Method:** `Builder::add_migrations(db_url: &str, migrations: Vec<Migration>) -> Self`

**Source:** [tauri-plugin-sql migration docs](https://github.com/tauri-apps/tauri-plugin-sql/blob/v1/README.md), [Tauri SQL plugin builder source](https://github.com/tauri-apps/tauri-plugin-sql/blob/v1/tauri-plugin-sql/src/plugin.rs)

### ALTER TABLE ADD COLUMN Support

**Status:** Supported. `ALTER TABLE ... ADD COLUMN` works as standard SQLite syntax within migrations.

**Example:**
```sql
ALTER TABLE manuscripts ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
```

The plugin executes migrations in sequence; no known limitations on `ALTER TABLE` syntax compared to raw SQLite.

**Source:** tauri-plugin-sql README examples, standard SQLite documentation

### Foreign Key Constraints & PRAGMA

**PRAGMA foreign_keys:** Must be enabled explicitly in SQLite. Not enabled by default in most SQLite drivers.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE scenes (
    id INTEGER PRIMARY KEY,
    manuscript_id INTEGER NOT NULL,
    FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);
```

**Status in tauri-plugin-sql:** The plugin does **not automatically enable `PRAGMA foreign_keys = ON`** by default. **Recommended action:** Include the PRAGMA in your initial migration (version 1) to ensure cascade deletes work:

```rust
Migration {
    version: 1,
    description: "enable_foreign_keys_and_create_schema",
    sql: "PRAGMA foreign_keys = ON; CREATE TABLE ...",
    kind: MigrationKind::Up,
}
```

**ON DELETE CASCADE support:** Fully supported by SQLite (and thus by the plugin) once `PRAGMA foreign_keys = ON` is active. The cascade deletion will trigger on referenced row deletion.

**Caution:** Running `PRAGMA foreign_keys = ON` in a later migration (after data is already in tables without the pragma) can cause constraint violations if existing data violates the constraints. Set it early or ensure data is compliant.

**Source:** SQLite official documentation, tauri-plugin-sql usage patterns; note that the project's memory `dev-and-installed-share-writing-db.md` flags that dev and installed builds share the same DB at `%APPDATA%\com.coles.writing\writing.db` — migrations must be idempotent or reconciled carefully during development.

---

## Summary Table

| Surface | Key API | Notes |
|---------|---------|-------|
| **TipTap v3 Selection** | `editor.state.selection.{from,to}` + `editor.state.doc.textBetween()` | Returns plain text; use `coordsAtPos(pos)` for menu positioning. Fires on every transaction (including Yjs remote updates). |
| **Anthropic count_tokens** | `POST /v1/messages/count_tokens` (accepts full message params) | **FREE**. Response: `{input_tokens: number, cache_*_tokens?}`. Preferred over chars/4 heuristic. |
| **tauri-plugin-sql migrations** | `Migration { version, description, sql, kind }` + `Builder::add_migrations()` | Executed in version order. `ALTER TABLE` fully supported. **Must enable `PRAGMA foreign_keys = ON` in migration 1** for cascade deletes. |

