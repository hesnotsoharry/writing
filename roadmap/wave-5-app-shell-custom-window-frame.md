---
status: PLANNED
created: 2026-06-03
---

# Wave 5 — DRAFT TITLE

## Plan

### Status

DRAFT · target v0.5 · drafted 2026-06-03.

### Goal

After this wave the app renders inside its own custom frameless window frame and the designed
three-pane shell instead of the current flat, inline-styled `AppContent` div. Native OS window
decorations are off (`decorations: false`); a ported custom title bar carries working
minimize/maximize/close controls and a drag region; the binder, editor/canvas, inspector, and story
bible are reparented into stable named slots inside the shell; and `useTheme()` is wired at the root
so the design tokens and accent finally take visual effect ("the screens light up"). Corkboard, focus
mode, and the transparent floating-window aesthetic are deliberately out — this wave delivers the
functional shell spine that later screen-port and feature waves fill in.

### Scope

**In scope:**

- `src-tauri/tauri.conf.json` — set `app.windows[0].decorations: false` (+ `minWidth`/`minHeight` floors). `transparent` stays OFF.
- `src-tauri/capabilities/default.json` — add `core:window:allow-minimize`, `allow-toggle-maximize`, `allow-close`, `allow-start-dragging`.
- New `src/shell/` dir: `WindowControls.tsx` (Phase 1 spine), `TitleBar.tsx` + `StatusBar.tsx` (port of `design-reference/chrome.jsx`), `AppShell.tsx` (port of `design-reference/shell.jsx`).
- Reparent the four existing screens — `src/binder/Binder.tsx`, `src/editor/Editor.tsx` (via EditorPane), `src/inspector/SceneInspector.tsx`, `src/storybible/StoryBibleView.tsx` — into named shell slots; remove `AppContent`'s inline styles + placeholder view-toggle button.
- A named, empty `CorkboardSlot` placeholder in the view-stage (reserves the slot; renders nothing yet).
- Two-segment view switch (Write / Story Bible) wired to existing `AppView` (`"editor" | "bible"`).
- Wire `useTheme()` at the `App()` root so `data-theme` + accent CSS vars are live. (Phase-4 scope refinement: the original "thread `setTheme`/`setAccent` to a stubbed Settings consumer" was **deliberately deferred** — a stub consumer with no real consumer is premature abstraction; the Settings wave establishes the threading with its real consumer. Phase 4 ships the root side-effect wiring only.)
- `data-tauri-drag-region` on the title bar root; window controls call `getCurrentWindow()` per ADR 0002.

**Out of scope:**

- **Corkboard** — net-new feature; its own later wave (HANDOFF step 3). Wave-5 only reserves the named slot.
- **Focus mode** — design supports it (hides titlebar/binder/inspector); deferred to a polish/feature wave. Not wired here.
- **Transparent / floating rounded-shadow window look** — needs `transparent: true`, which carries Windows WebView2 render risk (see research §4). Deferred to a post-shell polish pass once the square-frameless shell is proven. Filed as a follow-up candidate, not built.
- **`src/db/**`** — owned by the concurrent SQLite-migration wave (separate worktree). Wave-5 does not touch `src/db/`, including `schema.ts`/`getDb()`. The root/init seam stays as-is.
- **Real Settings panel / persistence wiring of `useTheme`** — the persistence seam (`useTheme.ts:48`) stays a TODO; settings UI is a later wave. Wave-5 only lifts the hook to root.
- **AppView expansion to three-way** — stays two-way; expanding it belongs to the Corkboard wave.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Walking skeleton — frameless window + live controls | sonnet-implementer | **Walking skeleton / end-to-end slice with a smoke run** for the new Tauri-window-API surface (first time the frontend calls into Tauri's window API). Cross-boundary (frontend → `@tauri-apps/api/window` → v2 ACL → OS window). Set `decorations:false` (`app.windows[]`) + min dims; add the 4 `core:window:*` capabilities; build minimal `src/shell/WindowControls.tsx` with `data-tauri-drag-region` + min/toggle-max/close buttons calling `getCurrentWindow()`; mount it temporarily atop `AppContent` so the app runs end-to-end. Trophy shape (static typecheck + manual smoke is the real gate). Grounded in research sidecar §1–3; implements ADR 0002. | Cole runs `npm run tauri dev`: the window opens with **no native OS titlebar**, dragging the custom bar moves the window, the ✕ button closes the app, and minimize/maximize buttons respond — the end-to-end smoke for the new window surface. |
| 2 | Port `chrome.jsx` → `TitleBar.tsx` + `StatusBar.tsx` | sonnet-implementer | Convert `design-reference/chrome.jsx` to TSX (ES exports, typed props; replace `window.X=` exports). Fold Phase-1 controls into `.wbtns`; add `data-tauri-drag-region` on `.titlebar` root. Wire brand, two-segment Write/Story-Bible switch (to existing `view`/`setView`), `doc-name`, `tb-actions` icon buttons (no-op stubs flagged for later waves), StatusBar word counts (real where the stores expose them, static placeholders flagged otherwise). Trophy shape; internal-render + manual smoke. Consumes wave-4 `Icon`/`menu` primitives + tokens. | Cole sees the full designed title bar (brand + segmented Write/Story-Bible switch + action icons) and status bar (word counts) rendered with tokens/fonts in the live app; clicking a segment switches the center view and window buttons still work. |
| 3 | Port `shell.jsx` → `AppShell.tsx` with named slots; reparent screens | sonnet-implementer | Create `src/shell/AppShell.tsx`: `.win > TitleBar + .body[.panel-binder \| .center>.view-stage \| .panel-inspector] + StatusBar`. Define stable named slots — BinderSlot, ViewStageSlot (Editor↔StoryBible by `view`), InspectorSlot (write-view only, preserving current condition), plus an empty named CorkboardSlot placeholder. Replace `AppContent`'s inline-styled flex div with `AppShell`; reparent the four screens; delete inline styles + the placeholder toggle button. Do NOT restructure the hooks inside `App()` (keeps DB-init seam untouched). Trophy; manual smoke. | Cole sees the app in the designed three-pane shell — Binder docked left, Editor/Story Bible center, Inspector right — replacing the old flat layout, with no inline-style fallback or stray toggle button visible. |
| 4 | Wire `useTheme()` at root — screens adopt design tokens | sonnet-implementer | Lift the dangling `useTheme()` hook into `App()` (its `useEffect` writes `data-theme` + `--accent-*` to `documentElement`); thread `setTheme`/`setAccent` to a stubbed consumer for the future Settings wave. Internal-only edit at the App-root seam — coordinate: this is the one file (`App.tsx`) the DB-migration session might also touch; keep the change to adding the hook call + provider wrapper, not refactoring `useSceneLoader`/`getDb()` callers. Persistence stays a TODO (out of scope). Trophy; manual smoke. | Cole sees the app visibly adopt the design's paper/accent palette live (editor background is warm paper, not white); `getComputedStyle(document.documentElement).getPropertyValue('--paper')` returns a color **and** the rendered UI uses it. |

### Acceptance criteria

- [ ] `src-tauri/tauri.conf.json` has `app.windows[0].decorations === false`; `transparent` is absent or `false`.
- [ ] `src-tauri/capabilities/default.json` `permissions[]` includes all four: `core:window:allow-minimize`, `core:window:allow-toggle-maximize`, `core:window:allow-close`, `core:window:allow-start-dragging`.
- [ ] `src/shell/TitleBar.tsx`, `src/shell/StatusBar.tsx`, `src/shell/AppShell.tsx` exist and export their components via ES `export` (no `window.X =` assignment).
- [ ] The title bar root element carries `data-tauri-drag-region`; window-control buttons call `getCurrentWindow().minimize() / .toggleMaximize() / .close()`.
- [ ] `AppShell` renders `.win > .titlebar + .body + .statusbar`; `.body` contains `.panel-binder`, `.center > .view-stage`, `.panel-inspector`; a documented CorkboardSlot extension point (a comment marking where App()'s future `view === "cork"` branch lands — **not** a rendered empty component) is present at the view-stage routing.
- [ ] Binder, Editor (via EditorPane), SceneInspector, StoryBibleView each render inside their named slot; the old inline-styled `AppContent` flex div and its placeholder view-toggle button are removed.
- [ ] `App()` calls `useTheme()`; on app start `document.documentElement` carries the `--accent-*` CSS vars written by the hook (and a `data-theme` attribute once a non-default theme is set). (Note: `--paper` is a wave-4 `tokens.css` `:root` token, already non-empty pre-wave — it is NOT written by `useTheme`; the prior AC wording conflated the two.)
- [ ] No file under `src/db/` is modified by this wave (`git diff --name-only` shows zero `src/db/` paths).
- [ ] `npm run lint`, `tsc` (typecheck), and `npm run test` (touched tests) all exit 0.

### Files the next agent should read first

1. `roadmap/wave-5-app-shell-custom-window-frame-research.md` — current Tauri-2 window API/config + Windows gotchas; the schema correction (`app.windows[]`, not `tauri.windows[]`) and the four required capability identifiers. **Read first.**
2. This wave file's `## Locked decisions` section — confirm it's populated before touching code.
3. `roadmap/decisions/0002-window-frame-recorded-for-next-wave.md` — the ADR this wave implements (custom frame, `decorations:false`, `@tauri-apps/api`).
4. `design-reference/shell.jsx` + `design-reference/chrome.jsx` — the components being ported (regions, slot composition, window buttons, view-switch).
5. `design-reference/HANDOFF.md` — the porting spec (jsx→tsx conversion rules, "copy css verbatim", drop TweaksPanel, "wire window controls to Tauri").
6. `src/App.tsx` (esp. `AppContent`, lines ~140–177) — the current flat shell being replaced; the reparent target.
7. `src/App.state.ts` — `AppView = "editor" | "bible"`, `view`/`setView`; do not expand to three-way.
8. `src/theme/useTheme.ts` — the dangling hook to lift to root (signature + persistence TODO at line ~48).
9. `src-tauri/tauri.conf.json` + `src-tauri/capabilities/default.json` — config + ACL starting state.

### Note to the implementer

The spirit of this wave: turn the design from "loaded but invisible" into the actual running frame
and shell, without expanding scope. You are porting presentational components and wiring them to what
already exists — not building features. Resist these temptations: do **not** build Corkboard (reserve
its slot only), do **not** add focus mode, do **not** chase the transparent floating-window look
(square-frameless is the call — see Out-of-scope), and do **not** touch anything under `src/db/` (a
parallel session owns it; `App.tsx` is the one shared seam — add the theme hook, don't refactor the
DB-init hooks). Keep `AppView` two-way. First step: verify the `## Locked decisions` section below is
filled in, then read the research sidecar.

Before declaring a phase complete, restate the observation point from the Phases table Observation
column in your own words and describe what you actually observed there. If you could not observe it
directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not
substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but
not sufficient.

## Locked decisions

<!-- ADR entries are appended here as the wave progresses. Each entry: Context (1 line), Pick, Consequences, Enforcement.
The core window-frame decision is already locked upstream — see roadmap/decisions/0002-window-frame-recorded-for-next-wave.md (custom frame, decorations:false, @tauri-apps/api). Wave-5 IMPLEMENTS 0002; it is not re-decided here. Any NEW non-trivial decision that arises mid-wave (e.g. revisiting the transparent/floating look) must pass the decision-review cell before being written here. -->

> Decisions are NOT appended here freely. Per the decision-review cell (`~/.claude/rules/best-practice-spectrum.md`, M-42 P2): a non-trivial decision must run `sonnet-architect` → `sonnet-adversarial-reviewer` (`Posture: attack-decision`) → orchestrator adjudication BEFORE it is written into `## Locked decisions`. The `adversarial_review_enforce.mjs` hook denies the wave-file edit if the cell has not fired; genuinely trivial decisions skip via the `review-tier-{session_id}.json` sidecar.

## Status

<!-- Per-phase rows added as work progresses: Phase | Dispatched | Completed | Commit SHA | Observation point hit -->

| Phase | Dispatched | Gates | Commit | Observation point hit |
|---|---|---|---|---|
| 1 — walking skeleton | ✓ (run-phase `wf_187db51c-873`) | green (lint/tsc/oracle 4/4) · review PASS single-tier | `a3e9491` | wiring contract ✓ (oracle) · **frameless/drag/OS smoke PENDING live run** |
| 2 — TitleBar + StatusBar | ✓ (run-phase `wf_454c0aa3-c49`) | green post-remediation (lint/tsc/116 tests · oracle 8/8) · review **FLAG** → adjudicated | `bed69d6` | view-switch contract ✓ (oracle) · **visual fidelity (brand/tokens/fonts/icons) PENDING manual smoke** |

| 3 — AppShell + reparent | ✓ (run-phase `wf_d48dd10a-2c7`) | green (lint/tsc/122 tests · slot oracle 6/6) · review FLAG_UNCERTAIN → doc-only, resolved | `2c2e55c` | slot→region contract ✓ (oracle) · **three-pane visual fidelity PENDING manual smoke** |

**Phase 3 adjudication notes:** review FLAG_UNCERTAIN was a doc-vs-doc nit — the plan's AC said CorkboardSlot "placeholder" while the brief (correctly) said comment-only. Code follows the brief (no dead markup). Resolved by correcting the AC wording above. No code change needed; clean otherwise (blast radius 0, only `Cargo.toml` EOL noise in scope signals).

**Phase 2 adjudication notes:** review FLAGged `sceneWordCount={null}` — **justified-deferred** (a correct live count needs a Yjs doc observer = feature-tier, not the cheap memo the brief assumed; a freeze-on-load count would mislead; honest `—` shipped → wave-6). Scope expansions reviewed: jest-dom dep + `WindowControls` getCurrentWindow-into-handlers = necessary/accepted; **`tsconfig.json` test-exclude (gate-weakening) = REJECTED and remediated** (typing fixed at source, test files kept in tsc scope). `Cargo.toml` signal = pre-existing EOL noise, untouched. `behavioralCoverageGap` (StatusBar presentational) = advisory, no test filed.

## Follow-up candidates

- Transparent / floating rounded-shadow window aesthetic: deferred from wave-5 to avoid the Windows WebView2 transparency render risk; requires `transparent:true` + shadow handling + Windows verification, separate from the functional shell. | present-harm: K3 — design-reference `.win { inset:18px; border-radius:var(--r-lg); box-shadow:var(--shadow-lg) }` (the "Quiet Study" floating look) will not render with square-frameless shipped in wave-5; visual gap observable at ≥1180px viewport once the shell lands.
- StatusBar live-data wiring (wave-6 feature slice): live SCENE word count (needs a Yjs doc observer that recomputes on edit, not a freeze-on-load memo), manuscript-wide word-count aggregate (`SUM` over `plaintext_projection`), goals mini-bar (`goalsOn`/session/target from a goals store), and backup timestamp — all currently render honest `—`. Naturally groups with the goals/word-count feature work. | present-harm: K3 — `src/shell/StatusBar.tsx` shows `—` for scene/manuscript counts; `src/App.tsx` passes `sceneWordCount={null}`; user sees no live word count in the status bar once the shell lands.

## Result

<!-- Filled at ship by wrap team. Includes: what the wave delivered, links to promoted artifacts, mechanical-review verdict, telemetry summary. -->

### Mechanical review

**Inputs:** Plan `roadmap/wave-5-app-shell-custom-window-frame.md` · Diff `37a9d6b..9d63def` · Graph healthy.

## Mechanical review: PASS

- Check 1 (forward-trace): PASS — `WindowControls`←TitleBar, `TitleBar`/`StatusBar`/`AppShell`←App.tsx; all 4 new components reach a production consumer.
- Check 2 (plan universals): PASS — all 4 screens (Binder/EditorPane/SceneInspector/StoryBibleView) reparented into AppShell slots; all 4 `core:window:*` capabilities present.
- Check 3 (export audit): PASS — no dead exports (components + their `*Props` interfaces all consumed).
- Check 5 (boundary acceptance test): PASS — Phase 1 (Tauri window API, cross-boundary) oracle `windowControls.contract.test.tsx` authored at `c17de7a` (before impl `a3e9491`), unmodified by impl, run evidence in Status (4/4).
- **Checks N/A: 4 + 6** — no electron-store schema removal (Tauri app, no config schema); no `stryker.config` in project.

Prior wave-end adversarial review (attack-diff, wave granularity) returned FLAG; all flags adjudicated (fabricated save-state text removed in `9d63def`; threading-deferral + AC wording reconciled). Runtime visual fidelity pending the consolidated manual smoke.
