---
project: writing
updated: 2026-06-09
---

## Current state
- **Branch:** master · **Latest commit:** 84afa90 · **Tag:** v0.2.1 (prior release; 41 commits ahead of origin/master, unpushed per user coordination)
- **Gates:** 1022 tests pass / 115 files · TypeScript clean · lint clean · all work CDP-verified
- **No numbered wave in flight.** Post-v0.2.1 session executed as: Lane B bug-batch (~13 UI/canon clusters, all CDP-verified) + snapshot lifecycle overhaul (4-commit K3 data-loss fix) + auto-updater infrastructure. All work committed.
  - **UI/canon bug-batch (all CDP-verified):** cream chrome backgrounds, active title-bar icon accents, drop-cap ProseMirror decoration fix (float model — WebView2 ignores initial-letter on span), snapshot diff direction consistency, compare-view rebuild, scene status symbols canonicalized, focus-mode editor-only + HUD z-order raised, link-character spacing in mentions, Find&Replace modal full CSS recovery (missing fr-* rules), corkboard synopsis edit ↔ inspector sync instant, quick-notes count live + popover click-away, inspector collapsible section groups, Story Bible 4-across card layout + visible detail-remove button + calendar month-nav + goal-add popover
  - **Snapshot lifecycle (4 commits: 584d03c/3bf89cf/bd1128d/84afa90, K3 HIGH data-loss fix-set):** (1) historySceneId synced on snapshot-take (CLOSES follow-up 2026-06-08-snapshots-cross-scene-restore), (2) manual snapshots labeled "Manual" not "Auto-save", (3) boundary auto-snapshots on scene-leave + app-close with text-hash dedup (skip unchanged), (4) user-configurable retention config (Settings ▸ Writing: Keep last N, default 25, key `writing.snapshotAutoLimit`)
  - **Auto-updater (parallel launch agent, commit 62262cb):** Tauri 2 auto-updater + local GitHub-release publish pipeline wired (RELEASING.md / publish.ps1 scripts added)
- **Blocking caveat:** app-close auto-snapshot requires `npm run tauri dev` rebuild to reload `src-tauri/capabilities/default.json` (Vite HMR cannot load capability changes); test project "The Salt Road" has CDP-smoke cruft (throwaway/reversible)

## Next 3 steps
1. **Push to origin** when user signals go (41 commits queued for merge)
   - Release coordination appears in progress (RELEASING.md describes publish flow; publish.ps1 has version bump + GitHub release automation)
   - Verify release strategy before push; coordinate with auto-updater work if version bump is pending
2. **Verify app-close auto-snapshot** via `npm run tauri dev` rebuild + close/reopen test
   - Requires fresh Tauri build (Vite HMR cannot reload `src-tauri/capabilities/default.json` changes)
   - Only piece not CDP-testable in-session; needs real window lifecycle verification
3. **Continue canon polish** to close remaining wave 26–28 defects, **OR** stage **Phase 2** (mobile + live sync)
   - Phase 2 readiness: TenTap RN editor + Yjs binding spike (spec §10 R1, est. 1–2 days), deferred per ADR 0001
   - Decision on direction: Cole's call per release + next arc priority

## Active work
- **Wave status:** No numbered wave in flight. Post-v0.2.1 session executed as **Lane B bug-list mode** (UI defects) + targeted snapshot lifecycle fixes + parallel auto-updater infrastructure work
- **Follow-ups resolved this session:** `2026-06-08-snapshots-cross-scene-restore` (K3, data-loss HIGH) → **fixed by snapshot-lifecycle commit 584d03c** (Fix 1: historySceneId sync) (recommend archiving)
- **Follow-ups still open:** `2026-06-08-autolink-find-mentions-integration` (K3) — status unknown; likely still pending integration work
- **Pre-existing follow-ups:** ~11 items from waves 5–27 remain untouched and active
- **Tree state:** `src-tauri/src/grammar.rs` uncommitted (belongs to parallel auto-updater work, not snapshot fixes) — leave as-is; test project "The Salt Road" has CDP-smoke cruft (stray edits, extra snapshots) — throwaway/reversible

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
