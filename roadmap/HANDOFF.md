---
project: writing
updated: 2026-06-03
---

## Current state
- Branch: master · No git remote (local-only) · Tag: none
- Wave 5 (app shell + custom window frame) + Wave 6 (SQLite migration) both SHIPPED and merged

## What just shipped
**Wave 5:** Frameless square window + custom min/max/close controls (Tauri caps). `AppShell` three-pane layout (titleBar + binder|center>view-stage|inspector + statusBar) with named slots. `useTheme()` at root. Smoke-confirmed.

**Wave 6:** `PRAGMA user_version` migration framework (`src/db/migrations.ts`, runs from `getDb()`). Migration baseline + 2 built (plaintext fold, scene_links rebuild w/ dedup). Live smoke PASSED on Cole's real writing.db 2026-06-03 — binder tree + Story Bible links intact, no data loss. Promoted: ADR 0006.

**Gates:** 144/144 tests + tsc + eslint GREEN on merged tree.

**Known cosmetic issue (NOT a defect, fixes in screen-port waves):** reparented screens wear inline styles → Binder shows white pane + doubled right border. Each screen sheds these when ported.

## Next 3 steps
1. **Screen-port waves** (now unblocked) — parallel: Binder (regrip @dnd-kit, shed inline styles → tokens), Canvas+Editor, Inspector, Story Bible. Each fills its named slot + adopts design tokens.
2. **Net-new feature waves:** Corkboard, Quick Capture, Inbox, Archive, Goals, Export, Settings (wires `useTheme` persistence + StatusBar live-data).
3. **Polish:** Re-enable `.win` `@media(min-width:1180px)` block + Tauri `transparent:true` for floating-window aesthetic (blocked in wave-5 before transparency was ready).

## Active work
- Open follow-ups: 4 · [inbox](follow-ups/) — `2026-06-03-app-detection-wiring-coverage` (wave-3); `2026-06-03-transparent-window-aesthetic`, `2026-06-03-screen-inline-style-shedding`, `2026-06-03-statusbar-live-data-wiring` (wave-5).
- **Migration-safety habit:** Back up `writing.db` BEFORE any future migration wave's live smoke (wave-6 ran without one — works, but no restore point).

## Reference index
- Project conventions: [CLAUDE.md](../CLAUDE.md)
- Durable decisions: [decisions/](decisions/) — 0001 (local-first) · 0002 (window frame, wave-5) · 0003–0005 (tokens, dnd-kit, CSS) · **NEW 0006** (SQLite migration framework)
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) — tiptap, fontsource, tauri, **NEW tauri-plugin-sql** (one-stmt-per-execute, no transactions, user_version cursor)
- Build: `npm run tauri dev` · Test: `npm run test` · Lint: `npm run lint:fix`
