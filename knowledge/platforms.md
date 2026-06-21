---
class: knowledge
category: platforms
lastVerified: 2026-06-21
verifyEvery: 90d
---

Platform/runtime facts for the `writing` (WritersNook) desktop app. Each entry's
`assert` is machine-re-checked at write-time and at wave-wrap (M-64 knowledge
oracle, `knowledge_doc_gate.mjs`) — a fresh `lastVerified` is earned by a passing
assert, never by editing the date.

## tauri
value: Desktop shell is Tauri 2 (Rust host + WebView2 frontend). The Rust side owns native IPC, SQLite, the keyring, and the BYOK Anthropic call path. WebView2 ships with Windows 11.
lastVerified: 2026-06-21
evidence: dep @tauri-apps/api in package.json; src-tauri/Cargo.toml present
assert: dep:@tauri-apps/api

## react
value: Frontend is React 19 + Vite + TypeScript.
lastVerified: 2026-06-21
evidence: dep react in package.json
assert: dep:react

## tiptap-prosemirror
value: The editor is TipTap v3 (built on ProseMirror). ProseMirror owns its content DOM and reverts external mutations — editor effects MUST be PM extensions/decorations, never external DOM writes. Disable StarterKit undo/redo (Yjs brings its own).
lastVerified: 2026-06-21
evidence: dep @tiptap/core in package.json
assert: dep:@tiptap/core

## yjs
value: Each scene is ONE Yjs doc (CRDT) — not one per manuscript. Load-bearing for performance and future two-way sync. Scene prose lives in a Y.XmlFragment. Hydrate the Y.Doc before mounting the editor.
lastVerified: 2026-06-21
evidence: dep yjs in package.json
assert: dep:yjs

## sqlite-plugin
value: Local persistence is tauri-plugin-sql (SQLite). The Yjs doc is stored as base64 TEXT, NOT a BLOB — the plugin does not round-trip binary columns reliably (plugins-workspace#105). The scene_docs column is state_base64 TEXT.
lastVerified: 2026-06-21
evidence: dep @tauri-apps/plugin-sql in package.json
assert: dep:@tauri-apps/plugin-sql
