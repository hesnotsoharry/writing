# Wave 24 — research grounding (Full Entry)

Distilled from the `sonnet-architect` decision pass (ctx7 + npm-registry + tauri.app, June 2026) and the
`sonnet-adversarial-reviewer` attack-decision pass. Grounding, not gospel — verify versions against the
lockfile when implementing.

## Tauri 2 portrait pipeline (version-pinned)

| Package | Pinned | Notes |
|---|---|---|
| `@tauri-apps/plugin-fs` | `^2.5.1` | requires `@tauri-apps/api ^2.11.x`; project pins `@tauri-apps/api: ^2` (compatible) |
| `@tauri-apps/plugin-dialog` | `^2.7.1` | file-open picker |
| Rust `tauri-plugin-fs` | `"2"` | matches existing `tauri-plugin-sql = { version = "2" }` pin style |
| Rust `tauri-plugin-dialog` | `"2"` | |
| `convertFileSrc` | `@tauri-apps/api/core` | NOT a separate package — in core api |

### lib.rs registration (add to the existing builder chain)
```rust
.plugin(tauri_plugin_fs::Builder::new().build())
.plugin(tauri_plugin_dialog::init())
```

### tauri.conf.json — asset-protocol scope
```json
"app": { "security": { "assetProtocol": { "enable": true, "scope": ["$APPDATA/portraits/**"] } } }
```

### capabilities/default.json — additive permissions
```
"fs:default",
{ "identifier": "fs:allow-write-file",  "allow": [{ "path": "$APPDATA/portraits/**" }] },
{ "identifier": "fs:allow-remove-file", "allow": [{ "path": "$APPDATA/portraits/**" }] },
"dialog:allow-open"
```

### Service flow (src/storybible/fullEntry/portraitService.ts)
- `open({ multiple:false, filters:[{name:'Images',extensions:['png','jpg','jpeg','webp','gif']}] })` → path or null.
- `mkdir('portraits', { baseDir: BaseDirectory.AppData, recursive: true })`.
- `readFile(selected)` → bytes; `writeFile('portraits/{id}.{ext}', bytes, { baseDir: BaseDirectory.AppData })`.
- Store `${appDataDir()}portraits/{id}.{ext}` (absolute) in `portrait_path`; render via `convertFileSrc(path)`.
- **Windows gotcha (architect known-gap):** if asset URL 404s, normalise `appDataDir()` trailing-slash:
  `dir.replace(/\\/g,'/').replace(/\/$/,'')`. Confirm on first real Windows run (post-merge, Cole).
- Reject base64-in-row: `listCharacters/listLocations` batch-load all rows; embedded bytes bloat every list read.

## SQLite / migrations (project canon — re-confirmed against src/db/migrations.ts)
- Migrations are **append-only**, each `up()` individually **idempotent**, **one statement per `db.execute()`**.
- `LATEST` is derived (`MIGRATIONS[MIGRATIONS.length-1].version`) in ALL migration tests — **no numeric edit needed**
  when appending 6/7/8 (verified by reviewer across runMigrations.test.ts:42, runMigrations.acceptance.test.ts:24,
  migration003.test.ts:24, migration004.test.ts:20). `migration003.test.ts:52` hardcodes `user_version = 2` as a
  seed fixture — semantically stable, do NOT touch.
- ⚠ **Run the FULL test suite after adding migrations** (project memory: appending a migration can break prior
  migration tests via partial seed fixtures + the runner re-running idempotent steps).

## Dedup correctness (the attack-decision BLOCK — load-bearing)
- `INSERT OR IGNORE` fires on the **PK** (`crypto.randomUUID()` — always unique), so OR IGNORE on a UUID PK is
  **inert for dedup**. The existing `replaceSceneLinks` (sqliteStoryBibleStore.ts:119) only works because migration 3
  added `UNIQUE(scene_id, entity_id)`.
- THEREFORE: `entity_fields` MUST carry `UNIQUE(entity_id, kind, key)` and `entity_links` MUST carry
  `UNIQUE(from_id, to_id)` at DDL. The OR-IGNORE-then-UPDATE upsert is correct ONLY against those constraints.

## Codebase machinery (from haiku-explorer)
- `STATUS_META` — `src/lib/status.ts:21` — `Record<SceneStatus,{id,label,dot,isFinal}>`.
- Binder — `src/db/binderStore.ts`: `Scene {id,project_id,folder_id,title,synopsis,sort_order,word_count,status}`,
  `Folder {id,project_id,title,sort_order}`; `loadProject()` → `{folders,scenes}`. **No flatten helper** — build
  Appears-in by mapping `findScenesForEntity(id)` → scene_ids → look up in the loaded tree; chapter = folder title.
- Inline-edit pattern — `StoryBibleView.tsx:107` `EntityRowNotes`: `textarea`, commit on blur, persists via
  `store.updateEntityNotes(type,id,val||null)` then `onMutated()`. Match this for the new Editable.
- `RenameInput` — `src/components/menu/RenameInput.tsx` — props `{value, onCommit, onCancel}`.
- `AppView = "editor"|"bible"|"cork"` — `src/App.state.ts:16`; view switch `buildViewStage()` `App.content.tsx:177`.
  **LEAD wires** the new entry view branch + nav stack — my lane does NOT touch App.*.
- Icons — `src/components/Icon.tsx` — all 19 needed names present.
- Contract test — `src/test/storyBibleCrud.contract.test.ts` runs `InMemoryStoryBibleStore` ONLY. New methods get
  InMemory contract tests; keep `portraitPath` OUT of base `Entity`/`Character`/`Location` types (only `getEntity`'s
  return carries it) so the existing `.toEqual` entity-shape assertions stay green.
- Avatar monogram — `StoryBibleView.tsx:159` — `name.trim()[0]?.toUpperCase()`, class `avatar character|location`.
