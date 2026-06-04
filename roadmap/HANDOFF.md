---
project: writing
updated: 2026-06-04
---

## Current state
- Branch: master · No git remote · Tag: none
- Wave 11 (feature-shell-wiring) SHIPPED — 6 commits (a8fe7aa..d01bc4f) + plan 1be02b2. Serial fork-point for parallel lanes.
- AppView cork-stub + 9 overlay/focus flags + 5 TitleBar triggers + 6 overlay stubs + global keybindings (⌘K/⌘./⌘E/⌘,, Esc) + focus mode (chrome recedes, data-focus on .win, exit affordance) + migration 4 (quick_notes/goals/archive, project_id NOT NULL) + BinderCallbacks archive stubs + Settings theme-setter + setGoalsOn/setHasQuickItems threaded to overlay props.
- Gates: 169/169 tests (was 155; +14 this wave), tsc + lint clean. Wave-end adversarial review PASS (one FLAG fixed d01bc4f).
- **⚠ Live integrated smoke pending** — app requires Tauri runtime (browser smoke hangs); all automated gates green; overlays/focus/cork/keybindings acceptance criterion needs `npm run tauri dev`.
- **Grammar now IN-BATCH (2026-06-04 override):** wave 16 spelling+grammar lane via harper-core Rust IPC (harper.js renderer rejected). See ADR 0007.

## Next 3 steps
1. **Smoke wave 11 live** — run `npm run tauri dev`, click TitleBar overlays, toggle focus (⌘./button), switch Corkboard, test keybindings + Esc. Gate: one outstanding acceptance criterion, de-risks shared fork base before fan-out.
2. **Fan out parallel lanes** per `roadmap/parallel-feature-waves-coordination.md` — worktrees for waves 12 Corkboard(+migration 5), 13 QuickCapture+Inbox, 14 Goals (wire `setGoalsOn`), 15 Settings, 16 Spelling+Grammar — in parallel; then 17 Archive, 18 Export (last, lib-gated).
3. **Carry 10 open follow-ups** — none resolved by wave 11; all feature-polish, deferred by design.

## Active work
- Open follow-ups: 10 · [inbox](follow-ups/) — 7 polish from 2026-06-03 + app-detection-wiring + statusbar-live-data-wiring + transparent-window-aesthetic.
- **Migration-safety habit:** Back up `writing.db` before any migration wave's live smoke (waves 12 onward + wave 11 live-smoke if run on real DB).
- `src-tauri/Cargo.toml` CRLF noise (excluded every commit).

## Reference index
- Coordination: [parallel-feature-waves-coordination.md](parallel-feature-waves-coordination.md) · Scope: [feature-waves-plan.md](feature-waves-plan.md)
- Decisions: [decisions/](decisions/) — 0001–0007 (0007: grammar-harper-core-ipc)
- Wave 11 stub: [wave-11-feature-shell-wiring.md](wave-11-feature-shell-wiring.md)
- Build: `npm run tauri dev` · Test: `npm run test` · Lint: `npm run lint:fix`
