---
project: writing
updated: 2026-06-09
---

## Current state
- **Branch:** master · **Latest commit:** 0ec36c4 · **Tag:** v0.2.1 (release NOT bumped — see Next steps) · **pushed to origin/master** (first build was already out to partner for testing)
- **Gates:** 1028 tests pass / 115 files · TypeScript clean · lint clean · Rust builds + app runs · Bugs 1/5/6 CDP-verified at runtime
- **Latest session (2026-06-09, partner-feedback bug-batch — 3 commits 75cf6a6/cc551a4/0ec36c4):** Lane B bug-list mode, 8 partner-reported bugs fixed + 1 adversarial-review pass. **Open items needing your manual confirm:** Bugs 7 & 8 use native OS save dialogs (not CDP-automatable) — do one real "Back up now" + one "Export" to confirm the file lands where you pick it.
  - **The 8 fixes:** (1) Story Bible full-entry name edits no longer visually revert (optimistic in-memory patch + rollback); (2) inspector now lists ALL linked entity types (item/faction/lore/theme/custom), read-path made type-agnostic — `loadSceneEntities` returns `SceneEntityGroup[]`; (3) status PICKER renders canonical glyph icons (was old dots); (4) quick-note→scene populates body only (no title) + refreshes binder instantly; (5) click anywhere on the editor page focuses it (CanvasWrap onClick → `editor.commands.focus('end')`, guarded); (6) inspector camera takes a snapshot silently (snapCapture) — no history modal; (7) Backup settings rewritten local-only — native save dialog → `backup_database` Rust cmd copies whole `writing.db`; (8) Export wired to native save dialog (`write_export_file` Rust cmd) + scene/chapter/manuscript scope picker (defaults to scene, gated on target existence).
  - **New Tauri surface:** 2 std-only Rust commands in `src-tauri/src/lib.rs` (`backup_database`, `write_export_file`); `dialog:allow-save` added to capabilities. NOTE: requires a `tauri dev` rebuild to load (Vite HMR can't reload capability/Rust changes). **Backup uses a plain file copy, NOT `VACUUM INTO`** — tauri-plugin-sql/sqlx can silently drop VACUUM (implicit transaction); DB is DELETE journal mode so no WAL sidecar.
- **Prior post-v0.2.1 session:** Lane B bug-batch (~13 UI/canon clusters, all CDP-verified) + snapshot lifecycle overhaul (4-commit K3 data-loss fix) + auto-updater infrastructure. All committed.
  - **UI/canon bug-batch (all CDP-verified):** cream chrome backgrounds, active title-bar icon accents, drop-cap ProseMirror decoration fix (float model — WebView2 ignores initial-letter on span), snapshot diff direction consistency, compare-view rebuild, scene status symbols canonicalized, focus-mode editor-only + HUD z-order raised, link-character spacing in mentions, Find&Replace modal full CSS recovery (missing fr-* rules), corkboard synopsis edit ↔ inspector sync instant, quick-notes count live + popover click-away, inspector collapsible section groups, Story Bible 4-across card layout + visible detail-remove button + calendar month-nav + goal-add popover
  - **Snapshot lifecycle (4 commits: 584d03c/3bf89cf/bd1128d/84afa90, K3 HIGH data-loss fix-set):** (1) historySceneId synced on snapshot-take (CLOSES follow-up 2026-06-08-snapshots-cross-scene-restore), (2) manual snapshots labeled "Manual" not "Auto-save", (3) boundary auto-snapshots on scene-leave + app-close with text-hash dedup (skip unchanged), (4) user-configurable retention config (Settings ▸ Writing: Keep last N, default 25, key `writing.snapshotAutoLimit`)
  - **Auto-updater (parallel launch agent, commit 62262cb):** Tauri 2 auto-updater + local GitHub-release publish pipeline wired (RELEASING.md / publish.ps1 scripts added)
- **Blocking caveat:** app-close auto-snapshot requires `npm run tauri dev` rebuild to reload `src-tauri/capabilities/default.json` (Vite HMR cannot load capability changes); test project "The Salt Road" has CDP-smoke cruft (throwaway/reversible)

## Next 3 steps
1. **Manually confirm Bugs 7 & 8 (native dialogs)** — run `npm run tauri dev`, then Settings ▸ Backup ▸ "Back up now" (pick a folder, confirm a `writing-backup-YYYY-MM-DD.db` lands) and Export (pick scene/chapter/manuscript, confirm the file saves). These are the only two of the 8 fixes not runtime-verified in-session (native OS modals can't be CDP-driven).
2. **Version/release decision (Cole's call).** This bug-batch was NOT version-bumped or tagged — deliberately, to avoid tripping the auto-updater publish pipeline (publish.ps1 + RELEASING.md). If you want these fixes released to your partner, bump to v0.2.2 (patch — it's a fix wave) and run the publish flow.
3. **Verify app-close auto-snapshot** (carried over) via `tauri dev` rebuild + close/reopen — only piece not CDP-testable; needs real window lifecycle. **OR** continue canon polish, **OR** stage **Phase 2** (mobile + live sync)
   - Phase 2 readiness: TenTap RN editor + Yjs binding spike (spec §10 R1, est. 1–2 days), deferred per ADR 0001
   - Decision on direction: Cole's call per release + next arc priority

## Active work
- **Wave status:** No numbered wave in flight. Latest session was **Lane B bug-list mode** (8 partner-reported bugs) with a wave-end attack-diff adversarial review (cleared the ship gate). Two review FLAGs were fixed in commit 0ec36c4 (silent-empty-export guard + dead `onRenameEntity` cleanup).
- **Follow-ups still open:** `2026-06-08-autolink-find-mentions-integration` (K3) — still pending (confirmed unrelated to the Bug 2 inspector fix; that bug's write-path was already complete).
- **Pre-existing follow-ups:** ~11 items from waves 5–27 remain untouched and active.
- **Tree state:** clean, pushed. Test project "The Salt Road" has CDP-smoke cruft from this session (2 extra Manual snapshots on scene "test1"; a rename round-trip that was restored to "test char 1") — throwaway/reversible. A `tauri dev` server may still be running from the smoke pass (CDP 9222 / Vite 1420) — close its window when convenient.

## Reference index
- **Design canon:** [design-reference/](design-reference/) (FEATURE-WAVE-PLAN + per-feature SPEC cards) · [docs/superpowers/specs/](../../docs/superpowers/specs/) (approved phase designs + TDD implementation plans)
- **Build + test:** `npm run tauri dev` (Vite + WebView2 CDP 9222 + tauri-devtools MCP) · `npm run test` (Vitest) · `npm run lint:fix` (ESLint strict flat config)
- **Project:** [CLAUDE.md](../CLAUDE.md) — local-first Tauri desktop app, zero built-in AI, single user. **How we work:** Lane A (features/build) + Lane B (bugs/fix) per `~/.claude/rules/development-pipeline.md`. **Load-bearing:** CDP smoke (runtime oracle catches rendering, state, callback defects static gates miss)
- **Durable ADRs:** [roadmap/decisions/](decisions/) — keystone: 0001-local-first-architecture (locked stack: Tauri 2 / TipTap 3 / Yjs / SQLite), plus wave-specific decisions
- **Vendor-gotchas + follow-ups:** [.claude/vendor-gotchas/](../../.claude/vendor-gotchas/) (TipTap PM behavior, jsdom oracle limits, auto-updater gotchas) · [roadmap/follow-ups/](follow-ups/) (triage + prioritization)
- **Memory + gotchas:**
  - app-can-be-smoked-via-cdp-port — tauri-devtools MCP now live; replaces prior "no browser smoke" workaround
  - editor-behavior-needs-cdp-smoke-not-jsdom — ProseMirror reverts external DOM mutations; jsdom insufficient for behavior tests
  - binder-drag still needs human interaction — dnd-kit drags not yet MCP-automatable
  - auto-updater in prep — RELEASING.md describes flow; publish.ps1 has version/release automation
- **Infra + environ:** exclude `src-tauri/Cargo.lock` from commits (dev churn) · test project "The Salt Road" is throwaway · Node 20+ / Rust toolchain / Visual Studio Build Tools (C++ desktop development) required for `tauri dev`
