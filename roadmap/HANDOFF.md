---
project: writing
updated: 2026-06-08
---

## Current state
- **Branch:** master (wave 28 merged + pushed to origin) · **Latest commit:** 60f6273 · **Tag:** v0.2.1 (pushed)
- **Wave 28 — Story-planning salvage (wave-27 feature fix-sweep): SHIPPED as v0.2.1.** All 8 phases.
  - P1 Find&Replace (format-preserving + self-undo fix), P2 Snapshots (CSS port + rail fix), P3 Entity types
  - P4 Relationships (de-dup + per-type presets), P5 Outliner + color labels, P6 Goals (right-click + word count)
  - P7 Focus mode (ProseMirror extension rewrite killed infinite dim loop), P8 Auto-link (live settings + context menu)
  - All phases delivered + CDP smoke–verified; no manual failures
- **Stage-5 review: PASS.** Mechanical `/review` green. Attack-diff flagged goal-delete UI-refresh gap — fixed in bc12a7c plus two adjacent goal-mutation defects (create/edit refresh missing + overlay trash never persisted) via the new GOALS_CHANGED_EVENT mechanism.
- **Two K3 wrap bugs fixed + CDP-smoke-verified (745c0e8):** Find&Replace open-scene live-refresh (forward replace + undo, via `handleSelectScene` scene-reload — avoided the Yjs append-only trap) + Snapshots binder-menu rail refresh.
- **Gates:** 956 pass / 105 files · tsc clean · lint clean · full suite green. CDP smoke: replace→"section" live, Undo→reverted live, console clean.
- **Blocking next action:** none — wave 28 fully shipped.

## Next 3 steps
1. **Pick the next arc (Cole's call).** Phase 1 feature set is complete across waves 26–28. The next major arc is **Phase 2 — mobile + live two-way sync**, which starts with the TenTap (RN editor) + Yjs binding spike (spec §10 R1, 1–2 days). Currently deferred per ADR `0001`.
2. **Or burn down open follow-ups first** — notably the 2 new K3 items: snapshots cross-scene restore corruption (**data-loss, HIGH**) and autolink "Find mentions" integration. A short fix-sweep wave could clear several pre-existing follow-ups.
3. **Bake-off analysis (optional):** wave 28 ran as a Claude-vs-Codex model bake-off; `bakeoff/p1-claude` + `bakeoff/p1-codex` branches remain for reference if you want to review the comparison (see `MODEL-BAKEOFF.md`).

## Active work
- **Wave in flight:** none — wave 28 shipped (v0.2.1). [wave-28-story-planning-salvage](wave-28-story-planning-salvage.md) preserved as historical detail.
- **Between waves:** Phase 1 complete (waves 26–28). Phase 2 (mobile + sync) is the next major arc — deferred per ADR `0001`.
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
