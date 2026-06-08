---
status: PLANNED
created: 2026-06-08
---

# Wave 29: editor

## Plan

### Status

PLANNED · wave-29 canon-burndown editor lane · drafted 2026-06-08 · reviewer tier: single

### Goal

After this wave, the editor/canvas lane of the wave-29 canon burndown is complete: (1) the scene
header chrome (chapter eyebrow + scene H1 + byline) is confirmed to match `design-reference/canvas.jsx`
and the follow-up is closed — no build, the chrome already shipped; (2) an empty scene shows a real
typing-cue placeholder because the official TipTap v3 Placeholder extension is wired into the editor
(today the placeholder CSS is dead — the `.is-editor-empty` class it keys on is never applied); and
(3) the AutoLink "Find mentions" affordance (context-menu item + peek-card Find button) emits a real
`onFindMentions(entityName)` callback the lead can wire to open Find & Replace prefilled, instead of
firing a mock toast. All changes are confined to `src/editor/`; the lead integrates the one new prop
contract and ratifies the one new dependency on merge.

### Scope

**In scope:**

- `src/editor/Editor.tsx` — wire `Placeholder` into `buildExtensions()`; add optional `onFindMentions`
  prop on `EditorProps`; thread it through `CanvasWrapProps` + `AlLinkMenuArgs`; capture
  `data-entity-name` into `AlPeekState` in `useAutoLinkHover.handleMouseOver`; `handleFind` wrapper
  with toast fallback.
- `package.json` / `package-lock.json` — **flagged frozen-file edit**: add `@tiptap/extensions@^3.24.0`
  (the official v3 home of `Placeholder`). Loud handoff flag for lead ratification at merge.
- Verify-and-close: `src/editor/EditorHeader.tsx` render vs `design-reference/canvas.jsx:107–121`
  (read-only verification — no edit).

**Out of scope:**

- Scene-header status **click-to-pick** — canon has a clickable status button; production `EditorHeader`
  is intentionally read-only (prior "Decision 2"). Restoring click needs a lead-owned status-picker
  overlay + `onStatus` wiring in App. Deferral: flag in handoff "Needs lead's eyes"; lead decides
  whether to file a follow-up.
- The other three still-mock AutoLink menu items (Unlink here / Never link / Manage aliases) — keep
  `fireNotice`/`AlNotice`. Deferral: out of this lane's brief; future wave or follow-up.
- `src/editor/extensions/AutoLink.ts` — pure decoration plugin; no interaction logic, no edit needed.
- `src/storybible/AutoLinkPeek.tsx` — out-of-dir (not owned); its existing `onFindMentions: () => void`
  prop is preserved (I pass a name-capturing closure from `Editor.tsx`). Deferral: lead-owned dir.
- `src/styles/app.css` — frozen + consume-only; the existing `.is-editor-empty::before` rule is correct
  and activated by the default `emptyEditorClass`. No edit.
- All `App.*`, `src/features/findreplace/`, `src/yjs/`, `src/shell/*` — lead-owned (Rule 5).

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Verify-and-close scene header chrome | orchestrator (read-only) | trophy · internal-only · Read `EditorHeader.tsx` + `Editor.tsx:290–294`; diff vs `design-reference/canvas.jsx:107–121`; confirm eyebrow/H1/byline match; record the read-only-status divergence. No code change. | Internal — no observation point (verification only; visual confirm deferred to lead). |
| 2 | Wire TipTap v3 Placeholder extension | `haiku-implementer` | trophy · cross-boundary (new external-SDK extension into the editor) · Add `@tiptap/extensions@^3.24.0` dep; `import { Placeholder } from "@tiptap/extensions"`; add `Placeholder.configure({ emptyEditorClass: "is-editor-empty" })` to `buildExtensions()`. Do NOT touch frozen CSS. | Empty scene renders the "Start writing…" cue (frozen CSS `app.css:339`) once `is-editor-empty` is applied — **lead's eyes** (no live app in lane). Gate proxy: tsc + lint + touched test green. |
| 3 | Emit `onFindMentions` callback from AutoLink | `sonnet-implementer` | trophy · cross-boundary (new prop contract the lead wires to Find&Replace) · Add optional `onFindMentions?: (entityName: string) => void` to `EditorProps`; thread through `CanvasWrapProps` + `AlLinkMenuArgs`; capture `data-entity-name` into `AlPeekState`; `handleFind(name)` = callback-or-toast-fallback; both context-menu item + peek closure call it. Keep the 3 other mocks. | Right-click an auto-linked span → "Find mentions" (and peek "Find") opens Find&Replace prefilled with the entity name **once the lead wires the callback** — lead's eyes. Pre-wire: graceful toast fallback (no regression). |

### Acceptance criteria

- [ ] `EditorHeader` render verified line-for-line against `design-reference/canvas.jsx:107–121`
  (eyebrow chapter title + separator + status, `scene-h1`, byline `N words · N characters · N locations
  present`); divergence (read-only status) recorded in handoff.
- [ ] `@tiptap/extensions@^3.24.0` added to `package.json`; `npm install` updates the lockfile; no other
  dep changed.
- [ ] `Placeholder.configure({ emptyEditorClass: "is-editor-empty" })` present in `buildExtensions()`;
  `src/styles/app.css` unchanged (verified by `git diff --stat`).
- [ ] `EditorProps` has new **optional** `onFindMentions?: (entityName: string) => void`; existing call
  sites compile without supplying it (optional+guarded — no required-prop break of the lead call site).
- [ ] Context-menu "Find mentions" item and peek-card Find both invoke `handleFind(entityName)`; when
  `onFindMentions` is undefined, the toast fallback fires (no behavior regression).
- [ ] `AutoLink.ts` and `src/storybible/AutoLinkPeek.tsx` are unchanged (`git diff` shows neither).
- [ ] Gates green: `npm run lint` · `npx tsc --noEmit` · `npm run test -- <touched>` (all run with
  worktree cwd `C:\Web App\writing-wave29-editor`).
- [ ] One commit per item (3 commits); branch pushed to `origin/wave-29-editor`; NOT merged.

### Files the next agent should read first

1. `src/editor/Editor.tsx` — the one file edited by Phases 2 & 3 (extensions array, `buildExtensions`,
   `useAutoLinkHover`, `buildAlLinkMenu`, `CanvasWrap`, `EditorProps`).
2. `src/editor/EditorHeader.tsx` — Phase 1 verify target.
3. `design-reference/canvas.jsx` (lines 58–79, 107–121) — header chrome canon.
4. `design-reference/AUTOLINK-SPEC.md` — "Find mentions" affordance spec.
5. `src/styles/app.css:326–342` — the (frozen) placeholder CSS the Placeholder extension activates.
6. `roadmap/canon-burndown-coordination.md` § Section 5 Lane 2 + Section 2 global rules — the lane contract.

### Note to the implementer

This lane delivers self-contained editor changes plus clean contracts for the lead; you do not wire
anything into `App.*`. The big trap is over-building: item 1 is **already shipped** — verify and close
it, do not "improve" the header or restore the status click (that's a deliberate prior decision and
needs lead-owned overlay wiring). For item 2, resist hand-rolling empty-detection — the official
`@tiptap/extensions` Placeholder is correct and the CSS already exists; you only add the extension so
the class gets applied. For item 3, keep `onFindMentions` **optional** and keep the toast fallback so
nothing regresses before the lead wires it. Do not touch `AutoLink.ts`, `AutoLinkPeek.tsx`, the CSS, or
any `App.*`/shell file. First step: confirm the `## Locked decisions` section below is filled in.

Observation discipline: you **cannot run the app** in this worktree (Rule 3 — Vite strictPort, hardcoded
CDP port, shared DB). So for Phases 2 and 3 the runtime observation points (placeholder renders; Find &
Replace opens prefilled) are **not directly observable by you** — they require the lead's live CDP
instance. Do not claim "verified in the UI." Your gate is: tsc + lint + touched tests green AND
line-by-line canon review. Restate each phase's observation point in the handoff under "Needs lead's
eyes" and say plainly that you could not observe it directly. Tests passing ≠ the placeholder showing.

## Locked decisions

> Decisions below were trivial-tier (codebase-native, single defensible option) and skip the
> decision-review cell per `~/.claude/rules/best-practice-spectrum.md` (review-tier sidecar set to
> `skip` for this lane — no architectural tension; the only library choice is dictated by TipTap v3's
> own packaging).

## Decision 1: Placeholder via official `@tiptap/extensions`, not a hand-rolled plugin

**Context:** The dead CSS placeholder needs the `is-editor-empty` class applied; either add the official
extension or hand-roll an empty-detection ProseMirror plugin.
**Pick:** Add `@tiptap/extensions@^3.24.0` and use its `Placeholder` (confirmed via ctx7 as v3's home for
Placeholder; StarterKit v3 does not bundle it).
**Rationale:** Hand-rolling root-class empty-detection is a subtle-bug surface (empty-node detection
across node types, the `is-empty` per-node class); the official extension is battle-tested and matches
the existing CSS via the default `emptyEditorClass`.
**Consequences:** One new dependency — a **frozen-file edit** (`package.json`/lockfile) that the lead must
ratify at merge; flagged loudly in the handoff.
**Enforcement:** advisory-only (handoff flag — no mechanical gate; lead reviews the dep on merge).

## Decision 2: `onFindMentions` is an optional prop with a toast fallback

**Context:** The lane emits the callback but the lead wires it; pre-merge there is no consumer.
**Pick:** `onFindMentions?: (entityName: string) => void` (optional); `handleFind` calls it when present,
else fires the existing mock toast.
**Rationale:** A required prop would break the lead's `<Editor>` call site (per the
`lane-prop-required-breaks-lead-call-site` lesson); the fallback prevents any behavior regression before
wiring.
**Enforcement:** none (convention) — optional-prop discipline; verified by tsc compiling the existing
call sites without the new prop.

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | orchestrator | 2026-06-08 | 61519c6 | Verified in-window: `EditorHeader` render matches `canvas.jsx:107–121` except deliberate read-only status (Decision 2). No runtime obs (lane cannot run app). |
| 2 | orchestrator | 2026-06-08 | c9ce88d | Not directly observable in lane (no live app). Gate proxy green: lint + tsc + 21 tests pass. Placeholder cue render → lead's eyes. |
| 3 | sonnet-implementer | 2026-06-08 | 3f7b986 | Not directly observable in lane. Gates green; attack-diff reviewer PASS on all correctness/scope angles, one FLAG (fallback test) adjudicated → justify. Find-mentions behavior → lead's eyes (CDP). |

## Follow-up candidates

<!-- DEFAULT empty. Candidate divergences (read-only status, 3 remaining mock menu items) are flagged
to the lead in the handoff, not staged here — they are lead judgment calls, not Tier-3 multi-wave work. -->

## Result

Lane complete (2026-06-08). 3 commits on `wave-29-editor`; all gates green; attack-diff reviewer
PASS (one FLAG adjudicated → justify). Ready for lead merge. NOT merged by the lane.

### Wave 29 editor — handoff for merge

- **Branch:** `wave-29-editor`  ·  **Plan:** `roadmap/wave-29-editor.md`
- **Commits:** `61519c6` (plan + Phase 1 verify-close) · `c9ce88d` (Phase 2 Placeholder) ·
  `3f7b986` (Phase 3 onFindMentions)
- **Gates:** lint PASS · tsc PASS · touched tests 21 pass (`editorHeader.test.tsx` + `alBuildIndex.test.ts`)
- **Reviewer verdict:** FLAG — all correctness/scope/regression/constraint angles PASS; single flag =
  no unit test for the `handleFind` fallback branch. Adjudicated → **justify** (see "Flags" below).
- **What shipped:**
  1. Item 1 (scene header chrome) — **already shipped in a prior wave; verified & closed**, no code.
  2. Item 2 — TipTap v3 **Placeholder** wired (`@tiptap/extensions`), activating the previously-dead
     empty-scene CSS cue.
  3. Item 3 — AutoLink **"Find mentions"** now emits a real `onFindMentions(entityName)` callback
     (context-menu item + peek Find), with a graceful toast fallback until the lead wires it.
- **Files touched:** `src/editor/Editor.tsx` (all owned), `package.json` + `package-lock.json` (dep —
  flagged below). No file outside `src/editor/` except the dep manifests. `AutoLink.ts`,
  `AutoLinkPeek.tsx`, `app.css` confirmed untouched.
- **NEW store methods added:** none.

- **COMPONENT PROP CONTRACTS (what the lead supplies on integration):**
  - **`EditorHeaderProps`** (item 1 — **NO lead wiring needed**): `EditorHeader` already takes
    `{ chapterTitle: string; title: string; status: SceneStatus; words: number; characters: number;
    locations: number }` and is fully fed *internally* by `Editor` (from `tree` + `selectedSceneId` +
    `useLiveWordCount` + `useSceneLinkCounts`, props the lead already passes). The lead does **not**
    pass any new header prop. Stated per handoff protocol for completeness.
  - **`onFindMentions`** (item 3 — **lead wires this**): new OPTIONAL prop on `EditorProps`:
    `onFindMentions?: (entityName: string) => void`. The lead threads it through `EditorPane`
    (`App.content.editor.tsx`) and wires it to open Find & Replace (`src/features/findreplace/` via
    `App.overlays.tsx` + `useModalFlags`) prefilled with `entityName`. Until wired, both affordances
    fire the existing mock toast (no regression).

- **⚠ Needs lead's eyes post-merge (CDP — lane cannot run the app):**
  1. **Empty-scene placeholder** renders the "Start writing…" cue on an empty scene (CSS at
     `app.css:339`, now activated by the Placeholder extension). Could not be observed in-lane.
  2. **Find mentions** — after wiring `onFindMentions`: right-click an auto-linked span → "Find mentions",
     and the hover peek-card "Find" button, both open Find & Replace prefilled with the entity name.
  3. **Toast fallback** (pre-wiring or if left unwired): clicking "Find mentions" shows the transient
     "Find mentions: <name> — coming soon" toast — confirms no regression.
  4. **Scene-header status is read-only** (`StatusDisplay`) — canon `canvas.jsx:110` has a clickable
     status button (status-picker). This is the intentional prior "Decision 2". If you want the
     editor-header status click restored, that needs lead-owned status-picker overlay + `onStatus`
     wiring — out of this lane. Lead decides: leave as-is or file a follow-up.

- **Follow-ups resolved/obsolete:** item 1 (scene header chrome) follow-up is **resolved** — chrome
  was already implemented and matches canon; close it. The item-2 follow-up premise ("add Placeholder")
  was real but the CSS already existed — only the extension was missing (now added).

- **Flags / deviations the lead should know before merging:**
  - **DEP ADD (frozen-file edit — ratify):** `@tiptap/extensions@^3.24.0` added to `package.json`.
    It was already present transitively, so the lockfile gained only the direct-dep reference line.
    `package-lock.json` also shows a **`version` sync `0.1.0`→`0.2.1`** — npm corrected a stale lockfile
    version field to match `package.json` (0.2.1); kept because hand-editing a lockfile is disallowed.
    The lockfile diff is intentionally minimal (5 lines) — I reverted an `npm install` CRLF→LF EOL flip
    back to CRLF so the diff is dep + version only, not 16k lines of EOL churn. Re-run `npm install`
    on merge to confirm clean.
  - **Reviewer FLAG → justify (no unit test for `handleFind` fallback):** a unit test can only live in
    `src/test/` (Lane 3's declared `(new)` ownership) or needs a `vite.config.ts` include change — both
    cross lane boundaries. This surface is CDP-oracle territory (ProseMirror DOM); the real behavior is
    lead-wired and covered by the Section 6 lead CDP smoke of "auto-link find". The fallback ternary is
    trivial; `Editor.tsx` had zero unit tests before this change. If you want coverage, the seam is
    clean: extract `handleFind` to a pure helper and test it from `src/test/` (your turf) on merge.
  - **Two behavior-neutral line-budget collapses** in `Editor.tsx` (`buildExtensions` signature,
    `PageFlipLeaf` div) were needed to stay under the 300-line `max-lines` cap after the additions —
    reviewer confirmed pure-formatting, no semantic change.
