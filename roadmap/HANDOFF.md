---
project: writing
updated: 2026-06-07
---

## Current state
- Branch: orchestrator-test-fixes (not merged to master) · Latest commit: 6097a73 · Tag: none
- Active wave: [wave-28-story-planning-salvage](wave-28-story-planning-salvage.md) — **IN-PROGRESS, 6 of 8 phases shipped**
- Phases delivered + CDP smoke–verified:
  - P1 Find&Replace `7741080`, P2 Snapshots `d75bb19`, P3 Entity types `b76ea08`
  - P4 Relationships+FullEntry `335b6df`, P5 Outliner+Labels `d81ed68`, P6 Goals `73c2c86`
- Master branch clean (design-reference/ canon); merge deferred until wave ships + smoke-PASS + Cole approval
- **BLOCKER:** Decision 7 (Q-FROZEN: editor frozen — additive only) requires Cole's explicit lock before P7/P8
- Full suite NOT yet run wave-wide (per-phase touched tests + lint + tsc green each phase) — wave-end full suite + /review + wrap scheduled after P8

## Next 3 steps
1. **P7 — Focus mode** (blocked on Q-FROZEN): resolve Q-HUDOPACITY (0.15→0.6, decide-and-explain); fix cold-start all-paragraphs-dimmed; move settings cog; apply Q-FROZEN on useFocusEditorEffects placement. [Wave P7 + audit Feature 7]
2. **P8 — Auto-link** (blocked on Q-FROZEN): make Editor.tsx linksVersion optional+guarded; type store as StoryBibleStore; build autolink settings + toggle; right-click context menu + Find-mentions; underline 1px→1.5px.
3. **Immediate:** Get Cole's lock on Decision 7 (Q-FROZEN, recommendation in wave file) before P7 starts → P7 → P8 → full suite + /review + wrap-team audit.

## Active work
- Wave in flight: [wave-28-story-planning-salvage](wave-28-story-planning-salvage.md) — **Phase 7 of 8** (P7 Focus → P8 Auto-link → wrap)
- Per-phase loop: recon (sonnet-explorer) → **acceptance test** (orchestrator, DO NOT EDIT) → fix (sonnet-implementer) → gates (tsc + lint + touched tests) → adversarial review → **CDP smoke verify** → commit + SHA log
- **CDP smoke is load-bearing gate:** runtime oracle caught P3 eyebrow palette leak, P6 right-click callback dead, P6 goal rendering corruption — all static gates passed
- Bake-off paused (Cole hit Codex limit 2026-06-07); running Lane A (Claude-only); MODEL-BAKEOFF.md unchanged since P2
- Decisions locked this session: Q-PEOPLEGROUP, Q-PRESETS, Q-LABELCAP, Q-STATUSDOT, plus P3 decide-and-explains
- Open follow-ups: 4 wave-file candidates for wrap-team audit — F&R embed-offset, F&R open-scene-no-refresh, snapshots cross-scene corruption, snapshots binder-menu rail-refresh
- Next action on resolve Q-FROZEN lock: then complete P7 + P8, run full suite, invoke /review, wrap-team files follow-ups at wave-end

## Reference index
- Wave + audit: [wave-28-story-planning-salvage](wave-28-story-planning-salvage.md) · [discovery/2026-06-07-sonnet-salvage-audit](discovery/2026-06-07-sonnet-salvage-audit.md)
- Design canon: [design-reference/](design-reference/) — FEATURE-WAVE-PLAN.md + per-feature SPECs · decisions locked in wave file `## Locked decisions`
- Build: `npm run tauri dev` (WebView2 CDP port 9222 + tauri-devtools MCP) · Test: `npm run test` · Lint: `npm run lint:fix`
- Project: [CLAUDE.md](CLAUDE.md) · Durable decisions: [roadmap/decisions/](decisions/) · Process: Lane A (build) + Lane B (fix)
- Infra: exclude `src-tauri/Cargo.lock` (churns from dev server) · test project "The Salt Road" is throwaway/reversible · UI UX: right-click story entities for Full Entry menus (not left-click)
- Memory: app-can-be-smoked-via-cdp-port (agent-driven smoke via WebView2 + tauri-devtools MCP) · gate-cwd discipline for parallel worktrees
- Docs: `docs/superpowers/specs/` (approved designs) · `docs/superpowers/plans/` (detailed TDD plans)
- Conventions: CDP smoke after every phase before commit; test project "Salt Road" is throwaway; bake-off paused (Cole's directive 2026-06-07)
