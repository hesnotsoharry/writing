# Creative Writing App — Design

**Date:** 2026-06-02
**Status:** Approved (brainstorming) — ready for implementation planning
**Working name:** writing (using the root folder name for now)

---

## 1. Vision

A calm, modern, fluid creative-writing application for a single primary user (a beginning
novelist). It should feel like a *free, open space to create* — not a control panel. Her words
live safely on her own machine, are automatically backed up off-machine so a dead laptop loses
nothing, and can be exported in one click so she can check her work with Claude or share it.

The product deliberately contains **no built-in AI**, to keep running costs near zero.

Design north star: **Dabble's calm, fluid feel + Scrivener's ownership and safety, minus the
intimidation of either.**

---

## 2. Users & goals

- **Primary user:** the developer's partner. A beginning creative writer. Strong on ideas,
  newer to writing tools — so the app must be approachable, low-friction, and forgiving.
- **Not a goal:** scale, many users, monetization, multi-tenant SaaS. This is a personal tool
  built for one person (later, two devices for that one person).

What success looks like:
1. She trusts the app with her work (it never loses anything; backups are automatic).
2. She enjoys writing in it (calm, fluid, gets out of her way).
3. She can organize a novel *and* a pile of short pieces without friction.
4. She can get any piece of her writing out — to Claude, to a friend, to print — in seconds.

---

## 3. Scope

### Phase 1 — Windows desktop (this spec)

In scope:
- Tauri desktop app for Windows.
- **Workspace layout** (chosen): chapter binder on the left, per-scene notes panel on the right,
  both visible by default. Focus mode hides all chrome for a blank page.
- Projects with a drag-reorderable **binder**: Project → Chapters (folders) → Scenes.
- **Short pieces** collections for standalone work (short stories, poems) — flat lists, light
  nesting.
- Calm **TipTap** rich-text writing canvas (bold, italic, headings, block quotes). Each scene is
  stored as a **Yjs** ("unscramble-proof") document from day one.
- **Story bible:** characters and locations, linkable to scenes, surfaced in the right panel.
- **Corkboard** view: draggable index cards, one per scene, for outlining/reordering.
- **Quick capture:** button + shortcut to jot a stray thought without leaving the current scene;
  notes collect in a per-project "Quick notes" inbox.
- **Goals** — optional (off by default) and customizable to a variety of writer goals (daily/session
  word count, project target, deadline pace, time-based, streaks); progress shown only when enabled.
- **Export:** Markdown/plain text, Word (.docx), PDF, and copy-to-clipboard — at scene, chapter,
  or whole-manuscript granularity.
- **Automatic off-machine backup with version history** (point-in-time restore), backup-only
  (no always-on sync server in Phase 1).

### Deferred (later phases)

- **Phase 2 — Mobile (iOS + Android)** with full two-way editing and live device-to-device sync.
  The Phase-1 foundation is built so this is an addition, not a rewrite.
- Comments / annotations on prose.
- Plot grid / advanced outlining views.
- Theming / deep customization.

### Non-goals

- Built-in AI of any kind.
- Real-time human-to-human collaboration (this is a single author's tool).
- Web/browser-hosted version.

---

## 4. Functional requirements

| # | Requirement |
|---|---|
| F1 | Create/rename/delete/reorder projects, chapters, scenes, and short-piece collections. |
| F2 | Drag-to-reorder anything in the binder; reordering is reflected in compiled exports. |
| F3 | Rich-text editing suited to prose; handles novel-length projects (100k+ words) smoothly. |
| F4 | Each scene is an independent document (bounds size, enables scene-level sync/export). |
| F5 | Story-bible entries (characters, locations) creatable, editable, linkable to scenes; the right panel shows entities present in the current scene. |
| F6 | Corkboard view: each scene shows as a card (title + synopsis); drag to reorder; reorder syncs with the binder. |
| F7 | Goals are **optional** (off by default; she enables them only if she wants the pressure) and **customizable** to the kinds of goals writers set: daily word count, per-session word count, whole-project word target, deadline-based pace (words/day to hit a date), time-based (write N minutes), and writing streaks. When disabled, no goal/progress UI is shown anywhere. |
| F8 | Export at scene / chapter / manuscript level to: Markdown, plain text, .docx, PDF, clipboard. |
| F13 | **Quick capture:** a always-available button + keyboard shortcut pops a small note field over the current view; she types a stray thought and dismisses it without losing her place. Quick notes collect in a per-project "Quick notes" inbox she can revisit and optionally promote into a scene/story-bible entry. |
| F9 | Works fully offline. No network required to write. |
| F10 | Automatic, scheduled, versioned off-machine backup; user can restore a prior version of any document or the whole project. |
| F11 | Focus mode toggles all chrome away for a distraction-free page. |
| F12 | All data is local-first and user-owned; no lock-in (export of everything is always possible). |

---

## 5. Architecture (Approach A — local-first, sync-ready)

Chosen after research (see `roadmap/` decisions). Confidence: high. Spectrum tier: emerging best
practice (correct lifecycle fit for an offline-first, conflict-free, single-user, cost-sensitive
product).

### Stack

| Layer | Choice | Plain-English role |
|---|---|---|
| Desktop shell | **Tauri 2** (Rust core + system WebView2 on Windows) | The lightweight, fast app container. |
| Editor engine | **TipTap 3 / ProseMirror** | The actual writing canvas. Most mature option, and the only one that binds cleanly to Yjs. |
| Document substrate | **Yjs** (one `Y.Doc` per scene) | The "unscramble-proof" (CRDT) format that lets two devices merge edits cleanly. Adopted from day one even though Phase 1 is single-device — this is the load-bearing decision that keeps Phase 2 from being a rewrite. |
| Local storage | **SQLite** via `tauri-plugin-sql` (libSQL) | A local DB file holding structure (binder tree, cards, story-bible, goals) + each scene's Yjs update-log as base64 text + a plaintext projection for search/word-counts. |
| Backup (Phase 1) | App-driven snapshot → **Cloudflare R2** or **Backblaze B2** object storage, with object versioning ON | Off-machine, versioned, restorable backup the user owns. No server to run. |
| Sync (Phase 2) | **Self-hosted y-sweet** (Rust, MIT) persisting to the same R2/B2 bucket | When mobile arrives: the sync server *and* the backup are the same bucket. |
| Mobile (Phase 2) | **React Native + TenTap** (RN WebView wrapping the same TipTap/ProseMirror core) | Reuses the identical editor; binder/corkboard/bible UI re-implemented natively. |

### Design rules that make this hold together

- **One Yjs doc per scene** (not per manuscript). Bounds the CRDT op-log size, keeps a
  novel-length project fast (no single editor instance ever holds the whole manuscript), and makes
  scene-granular export and (future) sync natural.
- **SQL owns structure; Yjs owns prose.** Binder tree, drag-reorder positions, corkboard cards,
  story-bible entries, and goals are cheap-to-query SQL rows. The *text* of each scene is its Yjs
  doc. SQLite also caches a **plaintext projection** of each scene for full-text search and word
  counts (never compute counts by replaying CRDT ops).
- **Keep all editor logic inside a self-contained web bundle**, even on desktop. Because mobile
  must run TipTap in a WebView anyway, authoring the editor as a standalone web app (not coupled to
  Tauri-native APIs) means Phase 2 reuses that exact bundle. Editor logic must not leak into the
  Rust/Tauri layer.
- **Export reads the SQLite projection + ProseMirror serializers** — a pure desktop-side concern,
  no coupling to backup or sync.

### Integration shape (Phase 1)

```
┌──────────────── Desktop (Tauri 2, Windows) ────────────────┐
│  React UI — binder · corkboard · story-bible · goals        │
│      │                                                      │
│      ▼                                                      │
│  TipTap (ProseMirror)  ←→  Y.Doc (one per scene)            │
│      │                          │                           │
│      │ structured data          │ Yjs update-log (binary)   │
│      ▼                          ▼                           │
│  SQLite (tauri-plugin-sql)                                  │
│   • tables: projects, folders, scenes, cards,               │
│     characters, locations, scene_links, goals               │
│   • per-scene Yjs update-log (base64 TEXT)                  │
│   • plaintext projection per scene (search + word counts)   │
└───────────────────────────┬────────────────────────────────┘
                            │ scheduled snapshot (versioned)
                            ▼
              Cloudflare R2 / Backblaze B2 bucket
            (object versioning ON = point-in-time restore)
```

In Phase 2, a y-sweet sync server is inserted between the desktop and the bucket, and the React
Native + TenTap mobile app connects to the same server over the Yjs-updates-over-WebSocket
protocol. No change to the document model.

---

## 6. UX / layout

**Workspace by default** (chosen direction B):

- **Left — Binder:** the project tree (Project → Chapters → Scenes) plus a "Short pieces" section.
  Drag-to-reorder. Click a scene to open it.
- **Center — Canvas:** the calm TipTap editor. Generous margins, quiet serif typography, plenty of
  whitespace. This is the visual heart of the app.
- **Right — Scene notes (inspector):** entities in the current scene (characters/locations from the
  story bible) and — *only if goals are enabled* — the active goal's progress.
- **Top bar:** project name, export, a corkboard toggle, and a **quick-capture** button (also bound
  to a keyboard shortcut) that pops a small note field over the current view.
- **Quick notes inbox:** a lightweight per-project list of captured notes, openable from the binder;
  a note can be promoted into a scene or a story-bible entry.
- **Corkboard:** a full-screen view (toggled from the top bar) showing scenes as draggable index
  cards (title + synopsis); reordering here reorders the binder.
- **Focus mode (⌘.):** hides binder, inspector, and chrome — just the page.

Feel: modern, fluid, unintimidating. Everything in reach, but nothing shouting.

---

## 7. Data model (initial sketch)

SQLite tables (structure + metadata):

- `projects` — id, title, type (novel | collection), created/updated, project word goal.
- `folders` — id, project_id, parent_id (nullable), title, sort_order. (Chapters are folders.)
- `scenes` — id, project_id, folder_id (nullable), title, synopsis, sort_order, word_count
  (cached), session_goal.
- `scene_docs` — scene_id, state_base64 (TEXT — the serialized Yjs doc; base64 text rather than a
  raw BLOB because `tauri-plugin-sql` does not reliably round-trip binary columns,
  tauri-apps/plugins-workspace#105), plaintext_projection (TEXT, for FTS/counts).
- `characters` — id, project_id, name, notes.
- `locations` — id, project_id, name, notes.
- `scene_links` — scene_id, entity_type (character | location), entity_id. (Drives the inspector.)
- `quick_notes` — id, project_id, body, created_at, status (open | promoted | archived). (The
  quick-capture inbox; F13.)
- `goals` — id, project_id, enabled (bool), type (daily_words | session_words | project_words |
  deadline_pace | time_minutes | streak), target, deadline (nullable), progress, period. Multiple
  goal rows allowed; all hidden from UI when `enabled` is false. (F7.)

Prose text lives in the per-scene Yjs doc (stored as `scene_docs.state_base64`). The plaintext
projection is regenerated on save for search and word counts.

---

## 8. Export

- **Granularity:** single scene, a chapter (folder), or the whole manuscript (compiled in binder
  order).
- **Formats:** Markdown, plain text, .docx, PDF, and copy-to-clipboard.
- **Implementation:** read the structured tree + plaintext/ProseMirror projection from SQLite;
  serialize via ProseMirror's serializers (Markdown/HTML) and format-specific generators (.docx,
  PDF). Clipboard copy is the fastest path to pasting into Claude — no file created.

---

## 9. Backup & safety

- **Local-first:** all writing is on her machine and works offline. She owns the data.
- **Automatic off-machine backup (Phase 1):** the app snapshots the SQLite DB (which contains the
  Yjs logs) to a Cloudflare R2 / Backblaze B2 bucket on a schedule, with **object versioning on**
  for point-in-time restore ("give me this chapter as it was last Tuesday").
- **Cost:** under ~$1/month for a single writer's corpus.
- **Restore:** the user can restore a prior version of a document or the whole project from backup.
- **No data lock-in:** full export of everything is always available (F12).

---

## 10. Risks & open questions

- **R1 (medium) — Phase-2 mobile editor binding.** TenTap (the RN editor wrapper) does not advertise
  built-in Yjs/collaboration support. Mitigation: a 1–2 day proof-of-concept at the *start* of
  Phase 2 to prove TenTap + the Yjs collaboration extension end-to-end. Worst case is a thin custom
  RN WebView around our own editor bundle — more work, same architecture, not a rewrite.
- **R2 (low/medium) — large-scene rendering.** ProseMirror renders synchronously; a single very
  large scene could stutter on low-end hardware. Mitigation: the per-scene document design already
  prevents any editor instance from holding the whole manuscript; profile a worst-case scene early.
  If one scene is ever too big, the lever is ProseMirror node-decoration virtualization — not a
  different editor.
- **Open — product name.** TBD.
- **Open — backup schedule/trigger details** (on-save debounce vs interval vs on-close) — to be
  settled in implementation planning.

---

## 11. Phase plan

**Phase 1 (this spec) — Desktop:** the full feature set above, single-device, with Yjs in the
documents from day one and backup-only off-machine safety.

**Phase 2 — Mobile + live sync:** stand up the y-sweet sync server (same bucket becomes sync +
backup), build the React Native + TenTap mobile app against the same document model, and run the
TenTap+Yjs spike first to retire R1.

**Load-bearing Phase-1 decisions that protect Phase 2 (do not compromise):**
1. Yjs as the document substrate from day one.
2. One Yjs doc per scene.
3. Editor authored as a self-contained web bundle, decoupled from Tauri-native APIs.
4. The future sync contract is "Yjs updates over WebSocket" — nothing in Phase 1 should violate it.

---

## Amendment — 2026-06-09 (LS compliance: server-side storage removed)

The following sections of this spec describe a Phase-1 backup and Phase-2 sync design that is
**superseded** by LS merchant-of-record compliance requirements. Do not implement the superseded
design. See `roadmap/decisions/0001-local-first-architecture.md` §Amendment for the full record.

**Superseded spec sections (affected text, do not implement):**
- §5 Architecture table: "Backup (Phase 1) — App-driven snapshot → Cloudflare R2 / Backblaze B2"
- §5 Architecture table: "Sync (Phase 2) — Self-hosted y-sweet persisting to the same R2/B2 bucket"
- §9 Backup & safety: automatic off-machine backup to R2/B2, versioned snapshots, point-in-time restore
- §11 Phase plan: "backup-only off-machine safety" (Phase 1) and "same bucket becomes sync + backup" (Phase 2)
- F10 (Feature table): "Automatic, scheduled, versioned off-machine backup; user can restore a prior version"

**Current design:**
- Phase-2 sync is a stateless, end-to-end-encrypted **relay** — no document content is persisted
  server-side. We forward Yjs update messages between devices and store nothing.
- Off-machine backup = free bring-your-own-folder (Dropbox/OneDrive). This is the only backup path.
