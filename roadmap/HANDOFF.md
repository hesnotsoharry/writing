---
project: writing
updated: 2026-06-08
---

## Current state
- **Branch:** orchestrator-test-fixes (not yet merged to master) · **Latest commit:** bc12a7c · **Tag:** none
- **Wave 28 — Story-planning salvage (wave-27 feature fix-sweep): COMPLETE — all 8 phases shipped.**
  - P1 Find&Replace (format-preserving + self-undo fix), P2 Snapshots (CSS port + rail fix), P3 Entity types
  - P4 Relationships (de-dup + per-type presets), P5 Outliner + color labels, P6 Goals (right-click + word count)
  - P7 Focus mode (ProseMirror extension rewrite killed infinite dim loop), P8 Auto-link (live settings + context menu)
  - All phases delivered + CDP smoke–verified; no manual failures
- **Stage-5 review: PASS.** Mechanical `/review` green. Attack-diff flagged goal-delete UI-refresh gap — fixed in bc12a7c plus two adjacent goal-mutation defects (create/edit refresh missing + overlay trash never persisted). New GOALS_CHANGED_EVENT mechanism wires the refresh.
- **Gates:** 948 pass / 103 files · tsc clean · lint clean · full suite + per-phase gates all green
- **Blocking next action:** merge to master (Cole's explicit approval required per wave plan + ADR lock protocol)

## Next 3 steps
1. **MERGE orchestrator-test-fixes → master** — pending Cole's explicit sign-off (gated by wave plan + ADR lock; separate Cole-approved step).
2. **Post-merge:** bump version to **v0.2.1** (patch for fix-sweep wave), update CHANGELOG, cut tag.
3. **Triage 2 K3 bugs flagged at wrap** (Cole decides: fix-before-merge OR defer to next wave):
   - Find&Replace — live-open scene's editor doesn't refresh after replace-all (DB state correct; manual reopen fixes)
   - Snapshots — binder context-menu "Take snapshot" no rail-refresh until next scene switch (one-line `bumpRailKey` wire)

## Active work
- **Wave in flight:** [wave-28-story-planning-salvage](wave-28-story-planning-salvage.md) — Status: SHIPPED (8 of 8 phases complete)
- **Between waves:** no active feature work. Pending master merge before Phase 2 can start.
- **Open follow-ups:** 13 total
  - Pre-existing: 11 from waves 5–27 (all untouched; remain active)
  - Wrap audit new: [2026-06-08-snapshots-cross-scene-restore](follow-ups/2026-06-08-snapshots-cross-scene-restore.md) — K3 data corruption; [2026-06-08-autolink-find-mentions-integration](follow-ups/2026-06-08-autolink-find-mentions-integration.md) — K3 affordance gap
- **Wrap artifacts:** durable decisions promoted (roadmap/decisions/0008 + 0009); vendor-gotchas updated (TipTap PM behavior + jsdom oracle rules); wave file preserved for merge review (not collapsed)

## Reference index
- **Wave detail + all locked ADRs:** [wave-28-story-planning-salvage](wave-28-story-planning-salvage.md)
- **Design canon:** [design-reference/](design-reference/) (FEATURE-WAVE-PLAN + per-feature SPECs) · [docs/superpowers/specs/](../../docs/superpowers/specs/) (approved phase designs + TDD plans)
- **Build commands:** `npm run tauri dev` (WebView2 CDP 9222 + tauri-devtools MCP) · `npm run test` · `npm run lint:fix`
- **Project:** [CLAUDE.md](../CLAUDE.md) — local-first Tauri app, no built-in AI, single user. **How we work:** Lane A (build/features) + Lane B (fix/bugs). **CDP smoke is load-bearing gate** (runtime oracle catches rendering, state, callback defects static gates miss).
- **Durable references:** [roadmap/decisions/](decisions/) (ADRs: 0008 + 0009 this wave) · [.claude/vendor-gotchas/](../../.claude/vendor-gotchas/) · [roadmap/follow-ups/](follow-ups/) · process per `~/.claude/rules/development-pipeline.md`
- **Infra/environ:** exclude `src-tauri/Cargo.lock` (dev churn) · test project "The Salt Road" is throwaway/reversible · Node 20+ / Rust / VS Build Tools required for Tauri dev
- **Memory + gotchas:** app-can-be-smoked-via-cdp-port (tauri-devtools MCP) · editor PM reverts external DOM mutations (jsdom can't test) · binder rail drag still needs human interaction
