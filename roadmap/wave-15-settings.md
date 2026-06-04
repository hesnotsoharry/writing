---
status: PLANNED
created: 2026-06-04
---

# Wave 15: settings

## Plan

### Status

PLANNED · parallel feature batch lane (sibling to waves 12/13/14/16) · drafted 2026-06-04 · worktree `C:\Web App\writing-wave15-settings` (branch `wave-15-settings`)

### Goal

After this wave, opening the Settings overlay (⌘,) shows the full five-section settings sheet from
`design-reference/settings.jsx` — Appearance / Editor / Writing / Backup & data / About — instead of
the "coming soon" stub. Every control is backed by a new localStorage-backed settings store
(`src/features/settings/settings.store.ts`) persisting under the existing `writing.*` namespace, so
preferences survive an app restart. Theme and accent changes apply live through the pre-wired
`setTheme`/`setAccent` props and now persist (the documented `useTheme.ts` persistence seam is filled).
Critically, the store exports three boolean toggle keys as **named constants** — `spellCheck` (default
ON), `grammar` (default OFF), `styleHints` (default OFF) — that wave 16 (Spelling & Grammar) imports as
its read contract.

### Scope

**In scope:**

- `src/features/settings/settings.store.ts` — NEW. Tweak defaults, `writing.*` localStorage helpers
  (safe JSON read with fallback), the `useSettings` hook (`{ tweaks, setTweak }`), and the exported
  wave-16 key constants (`SPELLCHECK_KEY`, `GRAMMAR_KEY`, `STYLEHINTS_KEY`) + their defaults.
- `src/features/settings/Settings.tsx` — REPLACE stub with the full five-section sheet (left-nav +
  section panels + internal toast). Consumes `useSettings` and the `setTheme`/`setAccent` props.
- `src/features/settings/*.test.ts(x)` — NEW. Co-located store tests + a Settings render/interaction
  test. (Co-located rather than in `src/test/` to avoid cross-lane file collisions.)
- `src/theme/useTheme.ts` — EDIT (shared, non-frozen). Fill the persistence seam at line 46: lazy
  `useState` initializers read `writing.theme` / `writing.accent`; write on every change. **Flag this
  shared-file touch to the lead at merge.**
- `src/test/useTheme.test.tsx` — EXTEND existing file with persistence round-trip cases.

**Out of scope:**

- "System" theme option — DEFERRED (see Locked decision 5; widening `Theme` breaks frozen
  `App.overlays.tsx:30`). Ship a light/dark 2-way seg. Deferral path: `## Follow-up candidates`.
- Backup/restore behavior — no backup infrastructure exists in Phase 1. Backup-now / restore / reveal
  buttons fire a local toast only (cosmetic). Deferral path: a later backup wave.
- Goals navigation — `onOpenGoals` is not in the frozen prop surface. Rendered as an optional prop with
  a toast fallback; real wiring deferred until the shell passes the prop. Deferral path: a wiring wave.
- Any edit to `App.tsx`, `App.state.ts`, `App.overlays.tsx`, `TitleBar.tsx`, `app.css`, `tokens.css`
  (FROZEN — consume-only). No DB migration.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Settings store + wave-16 key contract | `sonnet-implementer` | trophy (store logic + contract is load-bearing for wave 16) · internal-only (localStorage) · Create `settings.store.ts`: `TWEAK_DEFAULTS`, safe `getTweak<T>/setTweak` over `writing.*`, `useSettings` hook, and the THREE exported key constants + defaults (`spellCheck`=true, `grammar`=false, `styleHints`=false). Single source of truth for theme/accent defaults = import `DEFAULT_ACCENT` from `useTheme.ts` — do NOT redefine. Tests assert exact key names + defaults + round-trip. | Internal — no observation point. (Verified via co-located vitest store tests.) |
| 2 | useTheme persistence seam | `sonnet-implementer` | trophy · cross-boundary (persistent storage) · Fill the seam at `useTheme.ts:46`: lazy initializers read `writing.theme`/`writing.accent` (safe-parse, fall back to current in-memory defaults); write inside the existing `useEffect`s (or in wrapped setters). Must not break the existing `src/test/useTheme.test.tsx`. Extend that file with persistence round-trip cases. Acceptance test authored by orchestrator. | Toggle theme/accent in Settings, reload the app → selection persists (manual smoke + acceptance test). |
| 3 | Full Settings UI (5 sections) | `sonnet-implementer` | trophy · internal-only (renders within existing frozen overlay mount) · Replace `Settings.tsx` stub: primitives (`SetRow`/`Seg`/`SetToggle`/`SetSelect`), five section components, left-nav, internal toast state, optional `onOpenGoals` prop w/ toast fallback. Appearance theme/accent → read current from `writing.theme`/`writing.accent`, call `setTheme`/`setAccent` props on change; all other rows → `useSettings.setTweak`. Map design's `spellcheck` row to the `spellCheck` key. Keep every function ≤40 lines / complexity ≤10 (lint gate). Map bare `<Icon name>` to `src/components/Icon.tsx`. | Open Settings overlay (⌘,) in the running app → all five sections render, controls toggle, theme switch applies live (manual smoke). |

### Acceptance criteria

- [ ] `settings.store.ts` exports `SPELLCHECK_KEY`/`GRAMMAR_KEY`/`STYLEHINTS_KEY` (camelCase string
      values `spellCheck`/`grammar`/`styleHints`) and a defaults map; a vitest asserts exact names +
      `spellCheck`=true, `grammar`=false, `styleHints`=false.
- [ ] `useSettings` round-trips: set a tweak → new hook instance reads the persisted value from
      `localStorage`; a corrupt/missing value falls back to the default without throwing.
- [ ] `useTheme` initializes from `writing.theme`/`writing.accent` when present and writes on change;
      existing `useTheme.test.tsx` cases still pass.
- [ ] `Settings.tsx` renders all five nav sections; clicking a nav item switches the panel; a toggle
      calls `setTweak`; theme seg calls `setTheme`; an accent swatch calls `setAccent`.
- [ ] Theme seg is light/dark only (no "system"); backup action buttons fire the internal toast.
- [ ] Gates green in the worktree: `tsc --noEmit`, ESLint (strict flat config), `vitest run`.
- [ ] No diff to any frozen file (`App.tsx`, `App.state.ts`, `App.overlays.tsx`, `TitleBar.tsx`,
      `app.css`, `tokens.css`).

### Files the next agent should read first

1. `design-reference/settings.jsx` — the source design (5 sections, control shapes, CSS class names).
2. `src/features/settings/Settings.tsx` — the stub being replaced; exact `SettingsProps` to honor.
3. `src/theme/useTheme.ts` — the persistence seam (line 46), `Theme`/`AccentPalette` types,
   `DEFAULT_ACCENT` (single source of truth for accent default).
4. `src/test/useTheme.test.tsx` — existing test patterns (jsdom override, renderHook) + the file to extend.
5. `src/components/Icon.tsx` — real Icon component (`{name, className?, style?}`) + valid icon names.
6. `src/inspector/SceneInspector.tsx` — the `writing.*` localStorage namespace precedent (`writing.goalTarget`).
7. `roadmap/parallel-feature-waves-coordination.md` — frozen-surface + merge-order rules for this batch.

### Note to the implementer

The spirit of this wave: faithfully reproduce the design's calm, complete settings sheet AND ship the
load-bearing wave-16 key contract. The store is the real deliverable — the UI is its surface.

**Resist these temptations:** (1) editing any frozen file to wire `onOpenGoals`/`onToast` — they are
deliberately handled inside the feature; (2) adding a "system" theme to "match the design" — it breaks
frozen `App.overlays.tsx:30`; ship light/dark and the deferral is already filed; (3) redefining the
accent default — import `DEFAULT_ACCENT` from `useTheme.ts` so Settings and useTheme can never diverge;
(4) using string literals for the wave-16 keys anywhere — export and reference the named constants so
wave 16 imports the symbol.

First step: verify the `## Locked decisions` section below has decisions filled in (it does — 5).

Before declaring a phase complete, restate that phase's Observation point in your own words and describe
what you actually observed. For Phase 2 (theme persistence) the observation is runtime — if you cannot
reload the running Tauri app to confirm persistence, say so explicitly and rely on the acceptance test;
do not substitute "tests pass" for the runtime claim. Phase 3's observation requires the running app
(the overlay mounts only in the live shell) — note if you can only confirm via render tests.

## Locked decisions

> All five decisions were resolved by the orchestrator during grounding (file-level reads of
> `useTheme.ts`, `Settings.tsx`, `App.overlays.tsx`, `design-reference/settings.jsx` + a graph check of
> `Theme` consumers). They are lane-scoped coordination/architecture calls within a single feature dir,
> not multi-subsystem ADRs — review-tier `skip` (sidecar written before recording).

### Decision 1: Settings store shape

**Context:** Where do non-theme preferences live, and how does wave 16 read its toggles?
**Pick:** New `useSettings` hook + `settings.store.ts` in `src/features/settings/`, localStorage under the
existing `writing.*` namespace; owns all non-theme tweaks and exports the wave-16 key constants.
**Rationale:** Matches the established `writing.*` namespace (`SceneInspector` `writing.goalTarget`); keeps
the cross-wave contract in one importable module; no existing `useSettings` to collide with.
**Consequences:** Wave 16 imports key constants from this module — the file is now a cross-wave contract surface.
**Enforcement:** vitest store tests assert exact key names + defaults.
`durable: candidate`

### Decision 2: theme/accent persistence via useTheme seam

**Context:** Theme/accent must persist across launches, but Settings only receives setters (no current value).
**Pick:** Fill the documented `useTheme.ts` persistence seam (lazy initializer reads localStorage; write on
change). Settings reads current theme/accent from the same `writing.theme`/`writing.accent` keys to drive
the active-state highlight and calls the props on change.
**Rationale:** `useTheme` is the only launch-time consumer that can apply persisted theme; the seam comment
(line 46) explicitly designates it. App shell (frozen) can't be the persistence site.
**Consequences:** Touches a shared, non-frozen file outside the feature dir — **must be flagged to the lead
at merge** (low collision risk; theme is settings-specific).
**Enforcement:** vitest (`useTheme.test.tsx` persistence cases) + advisory (lead merge review).

### Decision 3: toggle key casing + export form

**Context:** Design JSX uses `t.spellcheck` (lowercase); plan/brief specify `spellCheck` (camelCase).
**Pick:** camelCase `spellCheck`/`grammar`/`styleHints`, exported as named constants; design's `spellcheck`
row maps to the `spellCheck` key.
**Rationale:** Brief is canonical for the cross-wave contract; named constants prevent literal drift between
waves 15 and 16.
**Enforcement:** vitest asserts exact key string values + defaults.

### Decision 4: missing onOpenGoals / onToast props

**Context:** The design uses `onOpenGoals` and `onToast`, but the frozen `App.overlays.tsx` mount passes only
`{onClose, setTheme, setAccent}`.
**Pick:** `onToast` → internal local toast state inside Settings. `onOpenGoals` → optional prop
(`onOpenGoals?: () => void`) with a toast fallback when absent.
**Rationale:** Self-contained within the feature dir; no frozen-file edit; future-proof if a wiring wave later
passes the prop.
**Consequences:** Goals "Configure…" button shows a toast instead of opening Goals this wave — **flag to lead.**
**Enforcement:** advisory-only.

### Decision 5: "system" theme deferred; backup buttons cosmetic

**Context:** Design shows a 3-way theme seg (light/dark/system); `Theme = "light" | "dark"` is consumed by
frozen `App.overlays.tsx:30`.
**Pick:** Ship light/dark 2-way seg; defer "system". Backup-now/restore/reveal buttons fire a toast only.
**Rationale:** Widening the `Theme` union would break the frozen overlay prop signature (graph-confirmed
consumer at `App.overlays.tsx:30`); no backup infra exists in Phase 1.
**Consequences:** Two design affordances ship as stubs/omissions — filed under `## Follow-up candidates`.
**Enforcement:** none (convention).

### Decision 6: grammar/styleHints store keys, but NO UI toggle rows in wave 15

**Context:** Phase 3 review FLAGged that the store declares `grammar`/`styleHints` keys (wave-16 read
contract) but the Settings sheet has no toggle rows for them.
**Pick:** Wave 15 ships the KEYS + defaults in the store only (per the lead's brief: *"you own the …
toggle KEYS in the shared settings store — wave 16 reads them"*). The grammar/styleHints toggle ROWS are
NOT added in wave 15.
**Rationale:** The design-reference has no such rows; `grammar` is OFF "until S2 ships." Adding live
toggles for behavior that doesn't exist yet is UI-without-wiring (anti-pattern). Wave 16 adds the rows to
the Editor section when it lands the backing spell/grammar behavior.
**Consequences:** Wave 16 must add two `SetToggle` rows (reading `tweaks.grammar`/`tweaks.styleHints` via
`setTweak`) to `Settings.sections.tsx` `EditorSection` — **flag to lead/wave-16.**
**Enforcement:** advisory-only (coordination note).
`durable: candidate`

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | ✅ | ✅ | 23bae22 | Internal — 13 store tests (exact keys+defaults, corrupt/null fallback, persistence) |
| 2 | ✅ | ✅ | fbd9412 | Unit boundary — 4 oracle tests (remount restores theme+accent). Runtime reload NOT observed (no live Tauri app in this lane) — deferred to wave-end smoke |
| 3 | ✅ | ✅ | (this commit) | Unit boundary — 11 render/interaction tests (5 sections, section-switch, store write, prop calls, toast, scrim-close). Live overlay render NOT observed (overlay mounts only in running shell) — deferred to wave-end smoke |

## Follow-up candidates

- "System" theme option deferred: requires widening the `Theme` union, which breaks the frozen
  `App.overlays.tsx:30` `setTheme` signature — cannot be done in-wave without editing a frozen file.
  | present-harm: K2 — `src/theme/useTheme.ts:10` `Theme = "light" | "dark"` consumed by frozen
  `src/App.overlays.tsx:30`; design at `design-reference/settings.jsx:55` offers a "system" option the app
  cannot honor.
- Backup/restore actions are cosmetic toasts: real backup infrastructure does not exist in Phase 1, so
  Backup-section buttons cannot perform their function in-wave. | present-harm: K2 —
  `design-reference/settings.jsx:121-144` shows backup/restore/reveal controls with no backing service.

## Result

<filled at ship by wrap team>
