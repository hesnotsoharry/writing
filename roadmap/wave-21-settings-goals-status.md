---
status: PLANNED
created: 2026-06-04
---

# Wave 21: settings-goals-status

## Plan

### Status

PLANNED · canon-polish lane (branch `wave-21-settings-goals-status`) · single reviewer tier · drafted 2026-06-04

### Goal

After this wave the bottom **status bar renders live data** instead of em-dash placeholders: the
manuscript-wide word total on the left, and — when goals are on — a daily-goal section on the right
(target icon + `words / target today` + progress bar) plus a genuinely-live clock. The **Settings →
Backup "Reveal" button** opens the real on-disk library folder (`appConfigDir()`, where `writing.db`
lives) in Explorer and the path display shows that real resolved path rather than a hardcoded string.
The Settings **Configure… → Goals** flow and the **Goals modal** are confirmed against the design canon
and any wiring gap is closed. The editor typeface/size/spacing/width selects are confirmed to write the
exact keys `useEditorStyle` reads (so font changes apply). All of this is verified by tsc + lint +
vitest + line-by-line review against `design-reference/*.jsx` — **no human UI smoke is available** until
all four lanes merge, so every human-only behavior is listed for Cole.

### Scope

**In scope:**

- `src/shell/StatusBar.tsx` — render `manuscriptTotal` (left, manuscript slot), the goal section on the
  right gated on `goalsOn` (`.goal-mini` + `.goal-track`/`.goal-fill`, fed by `goal={words,target,pct,streak}`),
  and a real-ish backup/clock area (live ticking local clock; honest backup label). Props are already
  threaded by Wave 17 — RENDER only.
- `src/features/settings/Settings.sections.tsx` — Backup section: resolve `appConfigDir()` from
  `@tauri-apps/api/path` on mount, display the resolved path, wire "Reveal" → `openPath(resolvedDir)`
  from `src/lib/ipc.ts`; guard the path API for non-Tauri/jsdom (try/catch fallback display).
- `src/features/settings/Settings.tsx` + `Settings.sections.tsx` — verify `onOpenGoals` is threaded
  Settings → WritingSection "Configure…" button; fix the thread if broken.
- `src/features/goals/Goals.tsx` — verify against `design-reference/dialogs.jsx` (enable toggle,
  goal-type grid, target input, Done) and close any gap.
- New/updated tests under `src/test/` for StatusBar rendering and the Reveal wiring (mock `invoke`).

**Out of scope:**

- Threading StatusBar/Settings props in `src/App.*` — **FROZEN** (Wave 17 owns; props already passed).
- Any `src/db/` change or migration — **FROZEN** (goal progress is localStorage; no schema work).
- `src/styles/app.css` / `tokens.css` — **CONSUME-ONLY** (all canon classes exist; flag the lead if one is missing).
- Implementing `useEditorStyle` font-application — done by Wave 17; this wave only confirms key names match.
- Real off-machine backup + last-backup timestamp — deferred (Phase 2 / Wave 23-area); status label stays cosmetic.
- Export menu, Archive UI, focus-mode hide logic (CSS-driven via `data-focus`, consume-only).

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | StatusBar live render | sonnet-implementer | pyramid · internal-only (consumes Wave-17 props, no new boundary) · Render `manuscriptTotal` in the manuscript slot (`—` when undefined); when `goalsOn && goal`, render `.goal-mini` (target icon + `{goal.words} / {goal.target} today` + `.goal-track`/`.goal-fill` width `goal.pct%`); replace the hardcoded backup placeholder with a live local clock (HH:MM via `setInterval`, cleaned up on unmount) + an honest backup label. Match `design-reference/chrome.jsx` StatusBar structure/classes. Unit-test render states. | Status bar shows manuscript total + (goals-on) goal bar + ticking clock — **human-observable only post-merge in `npm run tauri dev`**; internally verified via vitest render tests (manuscript slot, goal section on/off, clock element present). |
| 2 | Settings Reveal + Goals verify/fix | sonnet-implementer | trophy · cross-boundary (Tauri `open_path` IPC + `appConfigDir()` path API) · Resolve `appConfigDir()` on mount (try/catch → fallback display string for jsdom), display it, wire Reveal → `openPath(dir)`. Verify `onOpenGoals` threads Settings → WritingSection Configure button (fix if broken). Verify `Goals.tsx` matches `dialogs.jsx` (toggle/grid/target/Done) + confirm EditorSection writes `proseFont`/`proseSize`/`lineSpacing`/`editorWidth` (the keys `useEditorStyle` reads) — fix gaps only. Acceptance test mocks `invoke` and asserts `open_path` called with the resolved dir. | Clicking Reveal opens Explorer at the library folder; Configure opens the Goals overlay — **human-observable only post-merge**; internally verified via acceptance test (mocked `invoke` receives `open_path` + resolved path) and key-match review. |

### Acceptance criteria

- [ ] StatusBar renders `manuscriptTotal.toLocaleString()` in the manuscript slot, and `—` when `manuscriptTotal` is undefined.
- [ ] When `goalsOn` is true and `goal` is present, StatusBar renders `.goal-mini` with target icon, `{goal.words} / {goal.target} today`, and a `.goal-track`/`.goal-fill` bar whose fill width is `goal.pct%`.
- [ ] When `goalsOn` is false (or `goal` absent), no goal section renders.
- [ ] StatusBar shows a live local clock that updates over time (interval), cleaned up on unmount; no fabricated "2 minutes ago" timestamp.
- [ ] Settings Backup section displays the resolved `appConfigDir()` path (not the hardcoded `C:\Users\you\Writers Nook`), with a graceful fallback string when the path API is unavailable (jsdom/non-Tauri).
- [ ] Clicking "Reveal" calls `openPath` with the resolved library directory (asserted via mocked `invoke`).
- [ ] The "Configure…" button in the Writing settings section invokes `onOpenGoals` (threaded end-to-end from the Settings prop).
- [ ] EditorSection typeface/size/line-spacing/editor-width controls write the keys `useEditorStyle` reads (`proseFont`, `proseSize`, `lineSpacing`, `editorWidth`) — confirmed by review (and a key-assertion test if cheap).
- [ ] Goals modal matches `design-reference/dialogs.jsx`: enable toggle, goal-type grid, target input, Done — confirmed by review; gaps fixed.
- [ ] `npm run lint` + `tsc` (via `npm run build`'s tsc step) + touched-file vitest all green.
- [ ] No edits to `src/App.*`, `src/db/`, or `src/styles/*`.

### Files the next agent should read first

1. `roadmap/coordination/canon-polish-coordination.md` § "Lane 21" + GLOBAL RULES — the disjoint-dir contract and handoff format.
2. `roadmap/wave-17-foundation.md` — the contracts this lane consumes (StatusBar props, `openPath`, `useDailyGoalProgress`, `useEditorStyle`).
3. `design-reference/chrome.jsx` (StatusBar canon), `design-reference/settings.jsx` (Backup Reveal + Writing Configure), `design-reference/dialogs.jsx` (Goals modal), `design-reference/data.jsx` (STATUS/goal shapes).
4. `src/shell/StatusBar.tsx` — current placeholder render + the `StatusBarProps`/`GoalProgress` interface (Wave-17 mount points).
5. `src/features/settings/Settings.sections.tsx` — BackupSection (Reveal + hardcoded path), EditorSection (font keys), WritingSection (Configure button); `Settings.tsx` (prop threading).
6. `src/features/goals/Goals.tsx` + `goalStorage.ts` + `useDailyGoalProgress.ts` — the goal model already in place.
7. `src/lib/ipc.ts` (`openPath`) and `@tauri-apps/api/path` (`appConfigDir`) — the Reveal seam.
8. `src/test/Settings.test.tsx`, `src/test/goalsOverlay.test.tsx` — the vitest/jsdom test patterns to mirror.

### Note to the implementer

The spirit of this wave is **wiring and rendering, not building** — exploration confirmed the Settings
modal, all its sections, and the Goals modal already exist. The bulk of genuinely-new code is the
StatusBar render (Phase 1). Resist the temptation to (a) rebuild Goals.tsx or the Settings sections from
the canon JSX — verify-and-fix only; (b) edit `src/App.content.tsx` to thread StatusBar props — they are
**already threaded by Wave 17 and the file is frozen**; (c) fabricate a "Backed up 2 minutes ago" string —
the live clock is real, but real backup does not exist yet, so the backup label is cosmetic (see Locked
decisions). For the Reveal path: `appConfigDir()` throws outside Tauri (jsdom tests), so guard it.

First step: verify the `## Locked decisions` section below has decisions filled in (it does — 3 entries).

Before declaring a phase complete, restate that phase's Observation point in your own words and describe
what you actually observed. Both phases are observable only by a human running `npm run tauri dev`
**post-merge** — you cannot see the rendered Tauri UI. Say so explicitly: verify via vitest render/seam
tests + line-by-line review against the canon JSX, and do NOT claim "verified in the UI." Tests passing at
the unit boundary is necessary but not sufficient — every human-only behavior goes in the handoff's
"Needs Cole's eyes post-merge" list.

## Locked decisions

## Decision 1: Library path source for the Reveal button

**Context:** No `libraryPath` getter exists; the displayed path is hardcoded and `writing.db`'s real location is plugin-resolved.
**Pick:** Resolve `appConfigDir()` from `@tauri-apps/api/path` in the Settings component; reveal and display that.
**Rationale:** ctx7-confirmed — tauri-plugin-sql v2 resolves a relative `sqlite:` path against `BaseDirectory::AppConfig`, so `appConfigDir()` is exactly the folder containing `writing.db`. Frontend-only; no out-of-dir / Rust change needed.
**Consequences:** Reveal/display correctness depends on the plugin's path convention; if a future plugin version changes the base dir, this must follow. Path API throws outside Tauri → guarded with try/catch + fallback display.
**Enforcement:** advisory-only (verified by acceptance test asserting `openPath` receives the resolved dir; human-confirms-folder post-merge).

## Decision 2: Backup status honesty in the status bar

**Context:** Canon shows "Backed up · 2m ago"; no off-machine backup is implemented (deferred Phase 2).
**Pick:** Render a genuinely-live local clock (real, ticking); render the backup label as a static cosmetic indicator with NO fabricated timestamp, and flag it for Cole.
**Rationale:** The StatusBar file's own documented principle is data-honesty ("only genuinely derivable values are shown"); a fake "2 minutes ago" violates it. The clock is real; the backup state is not yet derivable.
**Consequences:** Visual parity with canon is partial (no live "Xm ago") until real backup lands; the cosmetic label is called out in the handoff for a product decision.
**Enforcement:** none (convention) — data-honesty principle documented in `StatusBar.tsx`; flagged in handoff.

## Decision 3: Verify-don't-rebuild for existing Settings/Goals UI

**Context:** Settings modal/sections and Goals modal already exist; coordination scope reads as "wire," not "build."
**Pick:** Treat Phase 2 Settings/Goals items as verify-against-canon + fix-gaps; do not regenerate components from the JSX.
**Rationale:** Rebuilding risks regressing existing tested behavior (Settings.test, goalsOverlay.test) and inflates the diff/merge surface for the lead.
**Consequences:** If a component proves materially divergent from canon (not just a small gap), that escalates to the lead as a scope question rather than a silent rewrite.
**Enforcement:** advisory-only (reviewer compares diff against canon; large rewrites flagged).

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | yes | yes | dea695a | Internal-verified (12 vitest cases: manuscript fmt, goal on/off, fill width, neg-pct clamp, clock cleanup). Rendered UI needs post-merge `npm run tauri dev` — agent cannot see the Tauri surface. |
| 2 | yes | yes | 11e3083 | Internal-verified (Reveal acceptance oracle + full suite 394/394; T2/T3/T4 confirmed by review). Reveal opening Explorer + Goals/Configure flow need post-merge human eyes. |

## Follow-up candidates

## Result

**Status: COMPLETE on branch `wave-21-settings-goals-status` (2 commits atop `e304e83`); awaiting lead merge.**

Delivered:
- **StatusBar** renders live data: manuscript total (left), goal section on the right when `goalsOn && goal` (target icon + `words / target today` + `.goal-fill` bar at `goal.pct%`, clamped 0–100), and a live local clock. Backup label is cosmetic (real off-machine backup is Phase 2) — no fabricated relative timestamp, per the file's data-honesty principle (Decision 2).
- **Settings → Backup "Reveal"** resolves `appConfigDir()` (where `tauri-plugin-sql` v2 places `writing.db`, AppConfig base dir, ctx7-confirmed) and opens it via `openPath()`; the path display shows the resolved dir with a jsdom/non-Tauri fallback. Reveal reuses the mount-resolved dir (on-demand resolve only if not yet landed).
- **Verified-as-is** (no code change): Configure… threads `onOpenGoals`; Goals modal matches canon (toggle/grid/target/Done, superset of the prototype); EditorSection writes the exact keys `useEditorStyle` reads — so font/size/spacing/width changes apply.

Gates: tsc clean · lint clean · full suite **394/394**. Reviewer (attack-diff, single): Phase 1 PASS (one test-coverage FLAG addressed); Phase 2 PASS (three FLAGs — markup class, Reveal double-call, oracle robustness — all addressed).

Scope held: edits confined to `src/shell/StatusBar.tsx`, `src/features/settings/*`, `src/test/*`. No `src/App.*`, `src/db/*`, or `src/styles/*` changes. No migrations.

⚠ **Needs Cole's eyes post-merge** (no UI smoke was possible): status-bar goal rendering + live clock, Reveal actually opening Explorer at the right folder + the displayed path being correct, the Configure→Goals overlay flow, the Goals modal layout, and that a font/size/spacing/width change visibly applies. Also a product call: the cosmetic "Backed up" label (no real backup yet) — keep optimistic or make honest.
