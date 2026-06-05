---
project: writing
updated: 2026-06-05
---

## Current state
- Trunk: **`master`** (HEAD `4f607b2`). Full suite green (803+), lint + tsc clean, `cargo check` clean.
- **Wave 26 (canon-bugfix) SHIPPED + SMOKED + runtime-fixed.** All 9 phases (P1–P9) committed; mechanical
  `/review` PASS + wave-end adversarial review done (see `roadmap/wave-26-canon-bugfix.md`). Then Cole's live
  `tauri dev` smoke surfaced a batch of "passed-unit-tests-but-broke-at-runtime" bugs — **all fixed and
  verified live this session.**
- **Smoke tooling now exists** (the gap that let those bugs slip past green tests): a WebView2 CDP debug port
  (`9222`, dev builds only) in `src-tauri/src/lib.rs` + a `tauri-devtools` MCP that attaches to it. The app is
  now **agent-drivable** for real UI verification. See memory `app-can-be-smoked-via-cdp-port`.

## Smoke-session fixes (committed `45547c1`..`4f607b2`, each verified live in-app)
- **Corkboard snap-back** (`815cd13`) — `onDragEnd` cancelled when `over===active`, which is the normal case
  for a real sortable drop. Now commits on actual order-change. (Console-traced via the smoke tool.)
- **Off-screen menus** (`cb26a9f`) — inspector "Link a character/location" picker (~1000px off) + editor
  spell popover (~300px off): `position:fixed` re-based by a transformed ancestor → portal both to `<body>`.
  Editor right-click now suppresses the Windows native menu for all editor clicks.
- **Binder footer pin + empty-gap** (`c4d38b2`) — the double `.panel-binder` (AppShell wrapper + inner nav):
  inner nav now `height:100%` so the quick-notes footer pins to the panel bottom; empty-chapter hint 12px→3px.
- **Synopsis edit boxes** (`4f607b2`) — killed the default focus OUTLINE (the "black/white border"), themed
  the inspector + corkboard-card editors to the canon `.be-sketch` field (themed border, recessed bg,
  auto-grow, no resize handle); empty synopsis renders no box. Plus dark-mode text readability + default
  detail-box edit alignment.

## Follow-ups / parked
- **Detail-box edit grid-shift (MINOR — follow-up):** clicking a full-entry DEFAULT detail box (Age/etc.) to
  edit shifts the DETAILS grid by ~3px, shifts back on blur. Pre-existing box-model quirk — NOT the input
  padding (live-tested; matching it made it worse). 3px transient, low priority. Pick up if it nags.
- Recurring `src-tauri/Cargo.toml` CRLF churn — still uncommitted, excluded from all commits (gitattributes
  follow-up someday).
- Worktree cleanup (lanes 18–24 branches/worktrees, all merged) — still parked.

## Next
- Wave 26 is fully done + runtime-verified; awaiting Cole's next direction.
- **For any future UI work: use the smoke tool** (`npm run tauri dev` → `tauri-devtools` MCP, drive +
  `evaluate_script` + `list_console_messages`) to verify at runtime. That's the lesson of this wave — unit
  tests passed while the rendered app was broken.

## Reference index
- Wave 26 plan: [wave-26-canon-bugfix.md](wave-26-canon-bugfix.md) · prior wave: [wave-25-canon-cleanup.md](wave-25-canon-cleanup.md)
- Smoke setup: memory `app-can-be-smoked-via-cdp-port` · Build: `npm run tauri dev` · Test: `npm run test` · Lint: `npm run lint:fix`
- Canon design source: `design-reference/*.jsx` + `FULL-ENTRY-SPEC.md` + `app.css`/`tokens.css`
