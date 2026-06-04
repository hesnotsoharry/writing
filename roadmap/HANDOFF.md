---
project: writing
updated: 2026-06-03
---

## Current state
- Branch: master · No git remote (local-only) · Tag: none
- Screen-port batch SHIPPED — waves 7/8/9/10 merged to master. 4 parallel lanes: Binder, Editor/Canvas, Inspector (full expansion + live goal ring), Story Bible. All shed inline styles → design tokens. Live word count wired to StatusBar + goal ring.
- Gates: 155/155 tests, tsc + lint clean. Integrated smoke (2026-06-03) PASS: parchment binder, themed editor w/ custom scrollbar, Story Bible cards, expanded Inspector. **App ~75–85% to design canon — styling DONE; remaining ~15–25% is FEATURE work (by design).**
- Post-batch fixes merged: EditorPane scroll (`.canvas-scroll` custom scrollbar), live word count observer (`useLiveWordCount.ts`).

## Next 3 steps
1. **Feature-waves batch — START HERE. Turnkey runbook: [`parallel-feature-waves-coordination.md`](parallel-feature-waves-coordination.md).** Next session, one lead: (a) author+run the SERIAL **wiring wave (11)** on master via `/wave-plan-lite` — AppView+=`cork`, overlay state + TitleBar triggers, **migration 4** (quick_notes/archive/goals), per-feature stubs, focus mode; merge it. (b) Then fan out the PARALLEL lanes from post-wiring master (worktree cmds + kickoffs in the runbook): Corkboard (+migration 5 scene-status), QuickCapture+Inbox, Goals, Settings, **Spelling (nspell)** → then Archive → Export (last, lib-gated). Per-feature scope: `feature-waves-plan.md`.
2. **Polish/feature follow-ups (7 filed 2026-06-03):** editor-scene-header-chrome, inspector-entity-interactions (add/link/synopsis buttons), binder-chapter-collapse, editor-empty-placeholder, binder-projectswitcher, binder-scene-status-dots, screen-ports-visual-polish.
3. **Grammar (offline) — deferred:** Spelling (`nspell`) is **wave 16 inside the parallel batch above** (toggleable from Settings: `spellCheck` ON / `styleHints` OFF). Grammar (`Harper` Rust/WASM via a Tauri command, `grammar` toggle OFF) is wave S2 — DEFER until `harper.js` API stabilizes; reuses the spelling lane's decoration plugin. Both fully offline/no-AI. See feature-waves-plan.md § Spelling + Grammar.

## Active work
- Open follow-ups: 9 · [inbox](follow-ups/) — top 7 above + `app-detection-wiring-coverage` (wave-3) + `statusbar-live-data-wiring` remainder (manuscript count + goals mini + backup time) + `transparent-window-aesthetic` (wave-5).
- **Migration-safety habit:** Back up `writing.db` BEFORE any future migration wave's live smoke.
- `src-tauri/Cargo.toml` shows EOL-only uncommitted diff (CRLF noise) — harmless, excluded from every commit.

## Reference index
- Project conventions: [CLAUDE.md](../CLAUDE.md) · Feature batch: [feature-waves-plan.md](feature-waves-plan.md)
- Durable decisions: [decisions/](decisions/) — 0001–0006 (local-first, window, tokens, dnd-kit, CSS, SQLite-migration)
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) — tiptap, fontsource, tauri (frameless), tauri-plugin-sql
- Build: `npm run tauri dev` · Test: `npm run test` · Lint: `npm run lint:fix`
