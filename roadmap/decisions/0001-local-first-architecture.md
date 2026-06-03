---
id: 0001
title: Local-first stack — Tauri + TipTap + Yjs + SQLite + cloud backup
status: accepted
decided-in: brainstorming-2026-06-02
date: 2026-06-02
durable: true
---

# Decision 0001: Local-first architecture (Approach A)

**Context:** Choosing the foundational stack for a single-user creative-writing app that must work
offline, store her work safely on her own machine, back up off-machine automatically, export in
several formats, and — critically — later gain a mobile app with **full two-way editing** that never
scrambles prose when two devices edit at once. Cost-sensitive (the reason there is no AI). Built by a
~2-person, partly-learning team, so operational burden and maintainability matter.

**Pick:** "Approach A — local-first, sync-ready":
- **Desktop shell:** Tauri 2 (Rust + system WebView2 on Windows).
- **Editor:** TipTap 3 / ProseMirror.
- **Document substrate:** Yjs (CRDT), **one `Y.Doc` per scene**, adopted from day one.
- **Local storage:** SQLite via `tauri-plugin-sql`; serialized Yjs doc stored as **base64 TEXT**
  (binary BLOBs don't round-trip reliably — tauri-apps/plugins-workspace#105). SQL owns structure
  (binder, cards, story-bible, goals); Yjs owns prose; SQLite caches a plaintext projection for
  search/word-counts.
- **Backup (Phase 1):** app-driven versioned snapshots to Cloudflare R2 / Backblaze B2 (object
  versioning on). No always-on server in Phase 1.
- **Sync (Phase 2):** self-hosted y-sweet (Rust, MIT) persisting to the **same** bucket — sync server
  and backup converge into one system.
- **Mobile (Phase 2):** React Native + TenTap (WebView wrapping the same TipTap/Yjs core).

**Rationale:** Yjs is (as of 2026) the only CRDT with production-grade TipTap/ProseMirror bindings,
which collapses the editor and sync decisions into one coherent choice; y-sweet makes the sync
backend and the durable backup a single S3 bucket (lowest operational burden); Yjs's large-doc
weakness is neutralized by per-scene documents, which the Scrivener-style binder implies anyway.
Adopting Yjs from day one (even single-device) is the corner-avoidance move that makes Phase-2 sync a
deployment, not a rewrite. Alternatives rejected: file + row-sync engines (PowerSync/ElectricSQL) sync
records not collaborative text — two sync models, the exact seam where prose gets clobbered; and
"cheapest, defer sync" paints into the rewrite corner on the firmest future requirement.

**Consequences:** Commits us to Yjs-as-substrate, one-doc-per-scene, an editor authored as a
self-contained web bundle (decoupled from Tauri-native APIs so mobile reuses it), and "Yjs updates
over WebSocket" as the future sync contract. Phase 1 must not violate these. Medium risk to retire in
Phase 2: TenTap + Yjs binding (1–2 day spike at Phase-2 start).

**Enforcement:** advisory-only — recorded here and in `CLAUDE.md` Gotchas; no mechanical gate. Plans
and reviews must check phase-1 work against the four load-bearing constraints above (spec §11).

**Sources (as of 2026):** Yjs vs Automerge vs Loro (pkgpulse); y-sweet (github.com/jamsocket/y-sweet);
TipTap/Lexical/Slate/Quill comparison (pkgpulse); Electric vs PowerSync vs Zero (trybuildpilot);
Tauri vs Electron (pkgpulse); TenTap (github.com/10play/10tap-editor). Full citations in the spec.
