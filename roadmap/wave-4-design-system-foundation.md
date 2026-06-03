---
status: PLANNED
created: 2026-06-03
---

# Wave 4 — Design-system foundation

## Plan

### Status

DRAFT · target v0.4 · drafted 2026-06-03.

### Goal

After this wave the codebase has a global design-system layer it does not have today: the design's `tokens.css` + `app.css` are copied verbatim into `src/styles/` and imported at app boot, the five design fonts are self-hosted via `@fontsource` (no CDN), and the three wiring-free design primitives (the `Icon` set, and the `ContextMenu` / `Toast` / `RenameInput` overlays) plus a slim `useTheme` hook are ported to typed TSX under `src/`. Everything is additive — the design system becomes available for the shell and per-screen ports that follow, while all four existing screens (Binder, Editor, Story Bible, Scene Inspector) keep functioning exactly as before. Nothing is wired into the existing screens yet.

### Scope

**In scope:**

- `src/styles/tokens.css` + `src/styles/app.css` — byte-identical copies of `design-reference/tokens.css` and `design-reference/app.css`.
- Global import of both stylesheets in `src/main.tsx` (currently imports no CSS at all).
- Static `@fontsource/*` packages for the five families — `@fontsource/literata`, `@fontsource/newsreader`, `@fontsource/source-serif-4`, `@fontsource/hanken-grotesk`, `@fontsource/ibm-plex-mono` — at the weights the design loads, imported so the exact family names `tokens.css` references resolve.
- `src/components/Icon.tsx` — ported from `design-reference/icons.jsx`: the 46-entry icon-path map, `Icon({ name, className, style })` with `name` typed as a union of the 46 keys, ESM export (no `window.Icon`, no `React.*` namespace calls).
- `src/components/menu/` — `ContextMenu`, `Toast`, `RenameInput` ported to typed TSX, preserving the viewport-edge position correction and the 5000 ms Toast auto-dismiss, with vitest unit tests for that behavior.
- `src/theme/useTheme.ts` — slim theme hook extracted from the design's theme logic: writes `data-theme` + accent CSS vars to `document.documentElement`; defaults to light; persistence deferred.

**Out of scope:**

- Any change to Binder / Editor / StoryBibleView / SceneInspector behavior or markup — the per-screen ports are later waves (project waves 6–9).
- The app shell, three-column layout, chrome, and custom window frame — **next wave** (the conceptual "Wave 2" of the integration).
- `design-reference/tweaks-panel.jsx` — dev-only design-review tool; intentionally **not** ported (the designer's HANDOFF flags it drop-from-prod).
- `design-reference/data.jsx` mock data — never ported.
- Corkboard and all other net-new feature surfaces (Quick Capture, Inbox, Archive, Goals, Export, Settings) — later feature waves, built against this design system. (The previously-pencilled `wave-4-corkboard` is resequenced behind the foundation + shell.)
- Theme persistence to a store — deferred to a later wave.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Stylesheet + font foundation | sonnet-implementer | Trophy · internal-only (asset wiring) · reviewTier **single** (touches build config + global import; can affect every screen). Copy `design-reference/{tokens.css,app.css}` verbatim → `src/styles/`; `npm i` the 5 static `@fontsource` packages at the design's weights (per the research sidecar — **static, not variable**, to keep the `tokens.css` family names verbatim); import the font CSS + both stylesheets in `main.tsx`. This is the thin end-to-end slice: tokens + fonts dropped in and verified rendering via a `tauri dev` smoke run before any primitive is ported. | On launching `tauri dev`, the app window's base background and default typography visibly change to the design's parchment tone + Literata/Hanken Grotesk type, and all four existing screens still render and respond — confirming the global stylesheet + self-hosted fonts loaded without breaking existing UI. |
| 2 | Icon primitive port | haiku-implementer | Trophy · internal-only · reviewTier **skip** (mechanical single-file presentational port). `design-reference/icons.jsx` → `src/components/Icon.tsx`: 46-entry `ICON_PATHS` map, `Icon({ name, className, style })` with `name` a union of the 46 keys, `window.Icon` → named export, `React.*` → named imports. No consumer yet. | Internal — no observation point (the primitive has no screen rendering it until the shell wave; correctness is the tsc union-type check). |
| 3 | Menu / overlay primitives port | sonnet-implementer | Trophy · internal-only · reviewTier **single** (carries real logic + tests). `design-reference/menu.jsx` → `src/components/menu/{ContextMenu,Toast,RenameInput}.tsx`, typed props; preserve ContextMenu viewport-edge correction and Toast 5000 ms auto-dismiss. vitest: ContextMenu repositions when near a viewport edge; Toast calls `onClose` after 5 s (fake timers); RenameInput commits on Enter / cancels on Esc. | Internal — no observation point (primitives have no consumer until the shell wave; behavior is asserted by the unit tests). |
| 4 | Theme hook extraction | sonnet-implementer | Pyramid · internal-only · reviewTier **single** (logic + test). Author `src/theme/useTheme.ts` from the design's theme effect (in `tweaks-panel.jsx` / `app.jsx`): writes `data-theme` + accent CSS vars to `document.documentElement`; default `light`; **no** persistence (deferred); do **not** port the `TweaksPanel` overlay. vitest: `setTheme('dark')` puts `[data-theme='dark']` on `:root` and the dark token block applies. | Internal — no observation point (the hook has no consumer until the shell wires it; behavior is asserted by the unit test). |

### Acceptance criteria

- [ ] `src/styles/tokens.css` and `src/styles/app.css` exist and are byte-identical to the `design-reference/` originals (verbatim — D2).
- [ ] `src/main.tsx` imports both stylesheets and the 5 `@fontsource` families; `npm run build` (tsc + vite) exits 0.
- [ ] In `tauri dev`, `document.fonts.check('16px "Literata"')` and `document.fonts.check('16px "Hanken Grotesk"')` both return `true`, and the Network panel shows **no** `fonts.googleapis.com` / `fonts.gstatic.com` request (fonts are self-hosted — D3).
- [ ] `getComputedStyle(document.documentElement)` resolves `--paper`, `--ink`, and `--accent` to the values defined in `tokens.css`.
- [ ] All four existing screens still function in `tauri dev` with no new console errors: binder expand/collapse + project switch, editor typing, story-bible create/rename/delete, inspector render.
- [ ] `src/components/Icon.tsx` exports `Icon` with `name` typed as a union of all 46 icon keys; `<Icon name="feather" />` type-checks and an invalid `name` is a `tsc` error.
- [ ] `src/components/menu/` exports `ContextMenu`, `Toast`, `RenameInput`; vitest passes for viewport-edge reposition, 5 s Toast dismiss, and RenameInput Enter-commit / Esc-cancel.
- [ ] `src/theme/useTheme.ts` exports a hook that sets `[data-theme]` + accent vars on `document.documentElement`; vitest confirms `setTheme('dark')` applies the dark token block.
- [ ] No file under `src/` imports from `design-reference/` (it stays reference-only).
- [ ] `design-reference/tweaks-panel.jsx` is NOT ported into `src/`.
- [ ] `npm run lint` and `npm run test` (full suite) are green.

### Files the next agent should read first

1. `roadmap/wave-4-DRAFT-research.md` — current `@fontsource` package names + import API + the static-vs-variable gotcha; grounds Phase 1.
2. `design-reference/HANDOFF.md` — the designer's porting spec: verbatim-copy instruction for the stylesheets, the drop-from-prod list, the font self-hosting note.
3. `design-reference/tokens.css` and `design-reference/app.css` — the assets to copy verbatim (and the exact `font-family` names that must keep resolving).
4. `design-reference/index.html` — the Google Fonts `<link>` being replaced (exact families + weights).
5. `design-reference/icons.jsx`, `design-reference/menu.jsx`, `design-reference/tweaks-panel.jsx` — the components/logic being ported (icons + overlays) or deliberately dropped (tweaks panel; extract only its theme effect).
6. `src/main.tsx` — the import target; currently imports no CSS.
7. The `## Locked decisions` section of this wave file — D1–D6.

### Note to the implementer

The spirit of this wave is **pure-additive groundwork** — you are laying the design system down beside the existing app, not rewiring the app onto it. The single biggest temptation to resist: "while I'm here, let me convert Binder/Editor/Inspector to the new tokens." Do not. Those are dedicated later waves that carry the wiring forward carefully (the Binder one re-grafts `@dnd-kit` — see D4). Touching them here is out of scope. Equally: do not port `tweaks-panel.jsx` or `data.jsx`, and do not import anything from `design-reference/` into `src/` — copy what's specified, leave the rest as reference. First step: verify the `## Locked decisions` section below is filled in, and read the research sidecar before installing fonts (the static-vs-variable choice is load-bearing for the verbatim-tokens lock).

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

> Decisions D1–D5 were settled with Cole in the integration-strategy discussion that preceded this wave (product/strategy calls, user-locked). D6 is a technical pick forced by the D2 verbatim constraint + the research finding; trivial given that constraint, recorded for traceability. No `sonnet-architect` decision-review cell was run — these are pre-settled / constraint-forced, not open architectural questions.

### Decision 1: Window frame (recorded for next wave)

**Context:** The design ships a full custom title bar with its own window controls. **Pick:** Custom frame — Tauri `decorations: false`, controls via `@tauri-apps/api`. **Rationale:** Matches the design exactly; the seamless title bar is core to the "Quiet Study" look. **Consequences:** Next wave owns window drag/min/max/close wiring. **Enforcement:** advisory-only (recorded here; implemented and enforced in the shell wave).

### Decision 2: tokens.css + app.css adopted verbatim

**Context:** The app has no design system; the design supplies one. **Pick:** Copy `tokens.css` + `app.css` byte-identical into `src/styles/`; existing inline styles migrate per-screen in later waves. **Rationale:** Nothing competes with the incoming system (current styling is ad-hoc inline literals), so verbatim adoption is lowest-risk and keeps the design as single source of truth. **Consequences:** Existing screens coexist on inline styles until their port wave; minor global resets from `app.css` are acceptable. **Enforcement:** acceptance criterion (byte-identical check) + Phase 1.

### Decision 3: Fonts self-hosted via @fontsource

**Context:** The design loads 5 fonts from the Google Fonts CDN; the app is offline-first (Tauri). **Pick:** Self-host all 5 via `@fontsource` packages; remove the CDN `<link>`. **Rationale:** An offline desktop app cannot depend on a CDN; bundling is the only correct path. **Consequences:** Fonts ship in the bundle; one new dependency category. **Enforcement:** acceptance criterion (no `fonts.g*` network request in `tauri dev`).

### Decision 4: Drag re-grafted onto designed binder (recorded for the Binder wave)

**Context:** Existing binder uses `@dnd-kit` (multi-container, custom collision detection); the designed `binder.jsx` has no drag. **Pick:** In the Binder port wave, graft the existing `@dnd-kit` logic onto the designed markup — no native-DnD rewrite. **Rationale:** The existing drag is sophisticated and working; rewriting it risks regressions. **Consequences:** The Binder port is the highest-risk screen port; budget for the graft. **Enforcement:** advisory-only (recorded here; enforced in the Binder wave).

### Decision 5: Animations are CSS-only

**Context:** The design's transitions (page-flip, etc.) need an animation approach. **Pick:** CSS `@keyframes` in `app.css` + a `matchMedia` reduced-motion gate — no animation library. **Rationale:** The design already implements every animation in pure CSS; adding framer-motion/react-spring would be dead weight. **Consequences:** No animation dependency enters the tree. **Enforcement:** none (convention) — no animation library is added.

### Decision 6: Static @fontsource packages, not variable

**Context:** Each family is available as static (`@fontsource/*`) and variable (`@fontsource-variable/*`); variable packages expose suffixed family names (e.g. `'Literata Variable'`). **Pick:** Static packages, importing the exact weights the design loads. **Rationale:** Variable packages would require renaming the families inside `tokens.css`, violating the D2 verbatim lock; static packages register the exact names (`'Literata'`, `'Hanken Grotesk'`, …) `tokens.css` already references. Bundle-size savings from variable are negligible for a bundled desktop app. **Enforcement:** acceptance criterion (tokens.css verbatim + fonts resolve under their original names).

## Status

run-phase Run IDs: phase-1 = `wf_d431a5e1-4f3` (for resume).

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | 2026-06-03 | 2026-06-03 | 158f78e | Gates green (lint/tsc/build exit 0); reviewer FLAG (import-order lint) dismissed — `npm run lint` exits 0. **Live `tauri dev` smoke DEFERRED to Cole** (no GUI in build session). |
| 2 | 2026-06-03 | 2026-06-03 | 5848a03 | Internal — no observation point. tsc + lint exit 0 (union-type `IconName` of 46 keys checks). Glyph fidelity rides on deferred visual smoke. |
| 3 | 2026-06-03 | 2026-06-03 | caec670 | Internal — no observation point. tsc/lint/16 tests green. Reviewer FLAGs: deps-array + test-path accepted (justified); RenameInput Escape+blur double-fire **fixed** (one-shot guard + regression test). Tests in `src/test/` per vitest include. |
| 4 | 2026-06-03 | 2026-06-03 | this commit | Internal — no observation point. tsc/lint/7 tests green. Reviewer FLAG_UNCERTAIN (rgbOf NaN on 3-digit hex) **fixed** — short-form hex now expands; regression test added. Persistence seam left as a comment for the shell wave. |

## Follow-up candidates

<!-- DEFAULT: empty. -->

## Result

<!-- Filled at ship by wrap team. -->
