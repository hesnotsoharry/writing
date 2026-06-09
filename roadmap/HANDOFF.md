---
project: writing
updated: 2026-06-09
---

## Current state
- Branch: master · Latest commit: a64c71c · Tag: v0.2.6 (released, pushed)
- **Session (2026-06-09, afternoon):** Lane B bug-list (8 partner-reported bugs) + updater hardening · 9 commits: v0.2.2→v0.2.6 released
- **Updater confirmed working end-to-end:** Cole installed v0.2.4 → auto-updated to v0.2.5 successfully
- **Shipped fixes:**
  - Responsive titlebar: collapses <840px to overflow menu, whole titlebar draggable (data-tauri-drag-region)
  - Editor focus on click: .canvas-scroll + gutters now focus editor (guards interactive UI + selection drags)
  - Wordcount persistence: compute from persisted bytes + lazy backfill repairs `wordCount=0` rows on list load (history deltas now correct, CDP-verified)
  - UpdateModal app-styled: progress bar + install errors via app toast (replaces native ask(); styled modal shipped)
  - `installMode=quiet`: NSIS no longer flashes native window; verified against tauri-plugin-updater 2.10.1 source
  - `getVersion()` in About: live version display (placeholder "Version 1.0 · Phase 1" removed)
  - ask() permission + checkError/installError split fix (permission was blocking update prompts)
  - publish.ps1 version-anchored: was shipping stale v0.2.2 exe under v0.2.3 tag; now anchored to git tag
- **Gates:** 1043 tests pass / TypeScript clean / lint clean. Tree clean, all pushed.
- **v0.2.6 status:** Tagged (git tag a64c71c) · NOT YET PUBLISHED (awaiting `.\publish.ps1` to push release to GitHub)

## Next 3 steps
1. **Publish v0.2.6** via `.\publish.ps1` (interactive key password)
   - Note: v0.2.5→v0.2.6 update shows OLD native ask + NSIS window (baked into v0.2.5); v0.2.6+ use styled modal + quiet install
2. **Partner one-time install ≥v0.2.4** (her v0.2.2 has ask() permission bug baked in, cannot self-update); after 0.2.4 she's on auto-update train
3. **Verify app-close auto-snapshot** via real `tauri dev` lifecycle; confirm Bugs 7 & 8 (backup/export native dialogs); direction call — canon polish vs Phase 2

## Active work
- **Wave in flight:** None (Lane B bug-list complete; no numbered wave)
- **Session:** Lane B bug-list mode (8 partner-reported bugs) + updater hardening with adversarial reviews on logic fixes
  - Snapshot fix: compute-from-persisted-bytes + backfill strategy (hypothesis review upgraded fix shape)
- **Open follow-ups:** 2
  - Top: [2026-06-08-autolink-find-mentions-integration](follow-ups/2026-06-08-autolink-find-mentions-integration.md) (K3, snapshot history deltas pending)
  - ~11 prior items from waves 5–27 remain open
- **Known mislead:** UpdateModal doesn't distinguish restart vs install failure; currently reports both as "Update found, but it couldn't be installed"

## Reference index
- **Project:** [CLAUDE.md](../CLAUDE.md) — local-first Tauri desktop app, zero built-in AI, single user
- **Process:** Lane A (features) + Lane B (bugs) per `~/.claude/rules/development-pipeline.md`
- **Durable ADRs:** [decisions/](decisions/) — keystone: [0001-local-first-architecture.md](decisions/0001-local-first-architecture.md) (Tauri 2 / TipTap 3 / Yjs / SQLite)
- **Updater pipeline:** [RELEASING.md](../../RELEASING.md) + `publish.ps1` (version-anchored GitHub-release automation) · UI: [UpdateModal.tsx](../../src/features/updater/UpdateModal.tsx) · Config: `plugins.updater.windows.installMode=quiet`
- **Build & test:** `npm run tauri dev` (WebView2 CDP 9222 + tauri-devtools MCP) · `npm run test` (Vitest 1043 tests) · `npm run lint:fix` (ESLint strict flat config)
- **Vendor-gotchas:** [.claude/vendor-gotchas/](../../.claude/vendor-gotchas/) · app-can-be-smoked-via-cdp-port (tauri-devtools MCP live, replaces no-browser-smoke) · editor-behavior-needs-cdp-smoke-not-jsdom (ProseMirror reverts external mutations) · binder-drag needs human (dnd-kit drags not MCP-automatable)
- **Environment:** Node 20+ / Rust / Visual Studio Build Tools C++ required for `tauri dev` · Cargo.lock IS committed (version tracking for reproducibility)
