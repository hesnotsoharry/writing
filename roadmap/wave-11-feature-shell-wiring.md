---
status: PLANNED
created: 2026-06-03
---

# Wave 11: feature-shell-wiring

## Plan

### Status

PLANNED · target v0.12.0 (minor — feature-enabling) · drafted 2026-06-03 · SERIAL bottleneck for the parallel feature batch (waves 12–18)

### Goal

After this wave, `App.tsx` / `App.state.ts` / `TitleBar` carry every stable mount point the parallel
feature lanes need to fill — and nothing more. The `AppView` union gains `"cork"`; the app-state hook
carries six overlay-visibility flags plus `focusMode` / `goalsOn` / `hasQuickItems` and their setters
(all default `false`); `App.tsx` wires TitleBar's five stubbed action handlers to those setters, renders
a flag-gated stub overlay per feature using the existing `.scrim`/`.sheet` classes, adds the
`view === "cork"` viewStage branch, stamps `data-focus` on the AppShell root (focus mode FULLY working),
exposes `useTheme()`'s setters for the Settings lane, and adds no-op `onArchiveScene`/`onArchiveChapter`
to `BinderCallbacks`. `src/db/migrations.ts` gains an additive **migration 4** creating `quick_notes`,
`archive`, and `goals` tables. `src/features/{corkboard,quickcapture,inbox,archive,goals,export,settings}/`
exists, each holding a minimal stub component. **No feature UI is built** — the lanes build that. This
wave is the frozen fork base: every shared-file edit the lanes would otherwise collide on happens here, once.

### Scope

**In scope:**

- `src/App.state.ts` — `AppView += "cork"`; add `showQuickCapture / showInbox / showArchive / showGoals /
  showExport / showSettings / focusMode / goalsOn / hasQuickItems` booleans + setters to `useAppState()`,
  all default `false`; export them in the existing return-object style.
- `src/App.tsx` — wire TitleBar's `onToggleGoals / onOpenQuick / onEnterFocus / onOpenSettings / onOpenExport`
  to the setters; add `view === "cork"` viewStage branch (renders `<Corkboard/>` stub); render each overlay
  stub gated on its `show*` flag via existing `.scrim`/`.sheet` classes; add `data-focus` attr on the
  AppShell root; destructure + pass `useTheme()`'s `setTheme`/`setAccent`; add no-op archive stubs to the
  `BinderCallbacks` object passed into the binder.
- Global keybinding `useEffect` (`⌘K` quick-capture, `⌘.` focus, `⌘E` export, `⌘,` settings, `Esc`
  close/exit) mirroring `design-reference/app.jsx`.
- `src/binder/BinderCrud.tsx` — extend `BinderCallbacks` interface with `onArchiveScene` / `onArchiveChapter`.
- `src/db/migrations.ts` — append `{ version: 4, name: "feature-tables", up: … }` creating `quick_notes`,
  `archive`, `goals` (additive only; never edits migrations 1–3; `IF NOT EXISTS` guards).
- `src/features/{corkboard,quickcapture,inbox,archive,goals,export,settings}/` — one minimal stub component each.

**Out of scope:**

- Any feature behavior/UI (Corkboard board, QuickCapture form, Goals ring wiring, Settings panels, Export
  formats, Archive list, spell/grammar) → deferred to the parallel lanes (waves 12–18; see
  `roadmap/parallel-feature-waves-coordination.md`).
- `src/styles/app.css` / `tokens.css` edits → CONSUME-ONLY; all feature classes already exist (verified).
- Migration 5 (scene `status` column) → owned by the Corkboard wave (12), not here.
- Spell/grammar toggle *values* → Settings wave (15) owns the keys; this wave only ensures the state shape exists.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | App-state surface | `sonnet-implementer` | trophy · internal-only · Add `"cork"` to `AppView` (App.state.ts:15); append the 9 flags+setters to `useAppState()` in existing style, all default false. The shared contract every lane consumes — get the names exact (match runbook). | Internal — no observation point (state plumbing; verified by tsc + consuming phases). |
| 2 | Migration 4 — feature tables | `sonnet-implementer` | trophy · **cross-boundary (persistent storage)** · Append v4 to MIGRATIONS registry (migrations.ts:217–221); `quick_notes`/`archive`/`goals` tables, `IF NOT EXISTS`, additive, follow migrations 1–3 pattern exactly. Orchestrator authors the acceptance test first. | After `npm run tauri dev` on a fresh/migrated `writing.db`, the three tables exist with expected columns (DB inspection / acceptance test asserts schema). |
| 3 | Feature stub components | `haiku-implementer` | trophy · internal-only · Create `src/features/{corkboard,quickcapture,inbox,archive,goals,export,settings}/<Name>.tsx`, each a named-export component rendering a minimal labeled placeholder (matches Icon.tsx house style). No logic. | Internal — no observation point (stubs exist so Phase 4 can import them; their rendered output is observed in Phase 4). |
| 4 | App.tsx wiring | `sonnet-implementer` | trophy · internal+UI · Wire 5 TitleBar handlers→setters; `view==="cork"` branch; render flag-gated overlay stubs (`.scrim`/`.sheet`); `data-focus` on AppShell root; expose `useTheme` setters; `BinderCallbacks` archive no-op stubs. Focus mode functional after this phase. | Clicking each TitleBar action button (Goals/Quick/Focus/Settings/Export) opens the matching stub overlay; entering focus dims the chrome via `data-focus`; clicking the binder column shows the cork view via the toolbar/view switch. |
| 5 | Global keybindings | `sonnet-implementer` | trophy · UI · `useEffect` keydown hook mirroring `design-reference/app.jsx`: `⌘K/⌘./⌘E/⌘,` → setters, `Esc` → close active overlay / exit focus. Proper add/removeEventListener cleanup. | Pressing `⌘K` opens the QuickCapture stub; `⌘.` enters focus mode; `Esc` exits focus / closes the open overlay — observed live in `tauri dev`. |

### Acceptance criteria

- [ ] `AppView` includes `"cork"`; `tsc` passes with the new union member exhaustively handled.
- [ ] `useAppState()` exposes all 9 new flags + setters, each defaulting to `false`, exported in the existing style.
- [ ] All 5 TitleBar action handlers invoke a real setter (no remaining `?? (() => {})` no-op for the wired five).
- [ ] Each of the 6 `show*` overlays renders its stub when its flag is `true` and nothing when `false`, using `.scrim`/`.sheet`.
- [ ] `view === "cork"` renders the Corkboard stub in the viewStage slot.
- [ ] `data-focus` is present on the AppShell root and toggles with `focusMode`; the `.focus-exit` affordance is reachable.
- [ ] `useTheme()`'s `setTheme`/`setAccent` are destructured and threaded (no longer discarded) — Settings lane can consume them.
- [ ] `BinderCallbacks` declares `onArchiveScene` / `onArchiveChapter`; App passes no-op stubs; `tsc` clean.
- [ ] Migration 4 is appended (not edited into 1–3); running it on a migrated DB creates `quick_notes`, `archive`, `goals` with the intended columns; the orchestrator-authored acceptance test passes.
- [ ] `src/features/{corkboard,quickcapture,inbox,archive,goals,export,settings}/` each contain a stub component that imports cleanly.
- [ ] Global keybindings (`⌘K/⌘./⌘E/⌘,`, `Esc`) fire the correct setters and clean up their listener on unmount.
- [ ] Full suite + lint + tsc green; one integrated smoke run confirms overlays open/close and focus toggles.

### Files the next agent should read first

1. `src/App.state.ts` — the `AppView` union + `useAppState()` return shape to extend (Phase 1).
2. `src/App.tsx` — viewStage branch (~171–176, has the reserved cork-slot comment), AppShell invocation, `useTheme()` call (~264) (Phase 4).
3. `src/shell/TitleBar.tsx` — the 5 stubbed action-handler props (~7–28) + their no-op wiring (Phase 4).
4. `src/binder/BinderCrud.tsx` — `BinderCallbacks` interface (~14–21) to extend (Phase 4).
5. `src/db/migrations.ts` — `Migration` interface, registry array (~217–221), `runMigrations` runner (~233–246) (Phase 2).
6. `design-reference/app.jsx` — the canonical keybinding map to mirror (Phase 5).
7. `src/components/Icon.tsx` — house-style reference for the stub components (named export, destructured props) (Phase 3).
8. `roadmap/parallel-feature-waves-coordination.md` — the batch this wave gates; confirms the frozen-surface contract the lanes depend on.

### Note to the implementer

This wave's whole job is to be *boring and complete*: stamp every mount point the parallel lanes need,
build zero feature behavior. The temptation to resist is "while I'm here, let me make the Corkboard /
Settings / QuickCapture actually do something" — don't; that's a different wave's scope and building it
here re-introduces the merge collisions the whole serial-wiring strategy exists to prevent. A stub is
correct here, not lazy. Equally: don't under-build — every flag, setter, overlay slot, and keybinding in
the scope must land, because a missing mount point means a downstream lane STOPS and flags you. Focus mode
is the one thing fully finished in this wave (boolean + `data-focus` + CSS + keybinding), not stubbed.
First step: verify the `## Locked decisions` section below has decisions filled in.

Before declaring a phase complete, restate the observation point from the Phases table Observation column
in your own words and describe what you actually observed there. If you could not observe it directly — no
live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass"
for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

## Decision 1: Grammar is in-batch (wave 16), via the harper-core Rust IPC path

**Context:** The coordination runbook deferred Grammar (Harper) until "harper.js API stabilizes"; Cole reversed that and asked to include grammar in this batch.
**Pick:** Fold Grammar into the wave-16 editor lane alongside Spelling, using `harper-core` (Rust crate) behind a `#[tauri::command]` over IPC — NOT `harper.js` WASM in the renderer.
**Rationale:** Research (2026-06-03) confirmed `harper.js` npm is still "early access" / explicitly-unstable (v1.2.0) with recent renderer-context breakage; `harper-core` is the more-stable surface (Tauri's own desktop app uses it) and keeps grammar off the main thread. Spelling + Grammar share one decoration-plugin contract, so they belong in ONE lane, not two colliding worktrees.
**Consequences:** Wave 16 grows by `src-tauri/src/grammar.rs` + a version-PINNED `harper-core` Cargo dep + IPC registration; harper-core bumps are treated as explicit migrations; integration tests cover the known edge-case breaks. The Settings wave (15) owns `spellCheck` (default ON) / `grammar` (default OFF) / `styleHints` (default OFF) toggle keys.
**Enforcement:** advisory-only at wave-11 scope (recorded in `roadmap/parallel-feature-waves-coordination.md` + `feature-waves-plan.md § Wave S2`). The harper-core IPC-contract + `grammar.rs` API-shape decision goes through `sonnet-architect` + the attack-decision review cell at wave-16's `/wave-plan`.
durable: candidate

## Decision 2: This wave builds mount points only — zero feature UI

**Context:** Whether the wiring wave should ship any feature behavior to "save a step."
**Pick:** Stamp stable mount points (state flags, overlay slots, keybindings, stubs, migration) and build NO feature UI.
**Rationale:** Every shared-file edit (`App.tsx`/`App.state.ts`/`TitleBar`/`BinderCallbacks`) happens once here so the parallel lanes fork from a frozen base and never collide — the wave-5 slot pattern, proven on the screen-port batch.
**Enforcement:** none (convention) — enforced by review at wave-end (`/review` scope-check) and by the lanes flagging any missing mount point back to the lead rather than patching the shared files.

## Decision 3: Migration 4 is additive-only, appended to the existing registry

**Context:** How to add the three feature tables without risking the existing schema.
**Pick:** Append `{ version: 4, … }` to the MIGRATIONS array; create tables with `IF NOT EXISTS`; never edit migrations 1–3.
**Rationale:** Matches the established runner (`PRAGMA user_version`, in-order apply, per-migration stamp) and ADR 0006 (SQLite-migration); additive migrations are crash-safe and forward-only.
**Enforcement:** advisory-only — `runMigrations` applies in version order; reviewer checks the diff touches only the appended entry. (Yjs-doc-as-base64-TEXT gotcha does not apply — none of the three new tables store doc state.)

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | — | — | — | — |
| 2 | — | — | — | — |
| 3 | — | — | — | — |
| 4 | — | — | — | — |
| 5 | — | — | — | — |

## Follow-up candidates

<!-- DEFAULT empty. Stage here ONLY if Tier-3 triple-gate clears (VALUE w/ present-harm + STRUCTURAL + CLEARABILITY). -->

## Result

<!-- filled at ship by wrap team -->
