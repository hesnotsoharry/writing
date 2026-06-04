---
status: PLANNED
created: 2026-06-04
---

# Wave 19 — Editor canon: header, bubble menu, page-flip, spell/grammar de-conflict

## Plan

### Status

DRAFT · target v0.1.x · drafted 2026-06-04.

### Goal

After this wave the editor surface (`src/editor/*`) matches the canon prototype (`design-reference/canvas.jsx` + `shell.jsx`): the prose is preceded by a header — chapter eyebrow with status, the scene title as an `<h1>`, and a byline reading "N words · N characters · N locations present" sourced from the live word count and the scene-links store; selecting text pops a canon formatting bubble (Bold / Italic / Heading / Quote / List); switching scenes turns a paper leaf showing the outgoing scene, directional by scene order, gated on the motion tweak and reduced-motion; and a misspelled word shows a single red wavy underline (not the current red+blue "weird blue mark" stack) with grammar checking on by default and its harper suggestions reachable on right-click. One small authorized prop-pass through the otherwise-frozen `EditorPane` threads the scene/view context the editor needs.

### Scope

**In scope:**

- **Authorized foundation prop-pass** (Cole-approved, 2026-06-04): minimal additive edit to `src/App.content.tsx` `buildViewStage` + `EditorPane` to thread `selectedSceneId`, `tree`, `view`, `storyBibleStore`, `linksVersion` into `<Editor>`. Wiring only — no component rewrite. Isolated in its own clearly-labeled commit.
- **`src/editor/Editor.tsx`** — consume the new props; mount the header, bubble menu, and page-flip overlay.
- **Editor header/byline** — new `src/editor/EditorHeader.tsx` rendering `.scene-eyebrow` (chapter title · status via `STATUS_META`), `.scene-h1` (scene title), `.scene-byline` (`useLiveWordCount` words · char/loc counts). New hook `src/editor/useSceneLinkCounts.ts` (`loadSceneEntities` → counts, re-loads on `linksVersion`).
- **Formatting bubble menu** — `src/editor/FormatBubble.tsx` using `<BubbleMenu>` from `@tiptap/react/menus`: Bold / Italic / {sep} / Heading(H2) / Quote / List, canon inline styles + `Icon`, active-state highlight.
- **Page-flip animation** — new `src/editor/usePageFlip.ts` (scene-change detection via `selectedSceneId`, direction by scene-order index, motion + reduced-motion + `view==="editor"` gating, self-cleanup) + leaf render (`src/editor/PageFlipLeaf.tsx`) wiring the dead `.page-turn-layer`/`.page-leaf` CSS. Walking skeleton first.
- **Spell/grammar de-conflict** — in `src/editor/extensions/ProofreadExtension.ts`: drop grammar decorations overlapping a spelling decoration; flip grammar default to `true`; confirm harper IPC render path.
- **Unit tests** under `src/test/` for the extractable pure helpers (flip direction/gating, overlap filter, link-count hook, byline formatting).

**Out of scope:**

- **Status mutation from the eyebrow** — the eyebrow renders status read-only this wave; clicking-to-change-status stays in the binder right-click (Lane 18) and corkboard cycle (Lane 20). Deferral: a follow-up if Cole wants editor-side status editing later.
- **Scene-link editing UI** (the "Link a character/location" buttons) — Lane 20 (inspector). This wave reads counts only.
- **Any `app.css` / `tokens.css` edit** — CONSUME-ONLY; all canon classes already exist. If a class is missing → flag the lead, do not author CSS.
- **`src/db/` changes / migrations** — frozen; status is free-text TEXT, counts come from existing store methods.
- **TipTap dependency additions** — `@tiptap/react/menus` resolves from the existing direct dep; no new package.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Foundation prop-pass + page-flip **walking skeleton** | sonnet-implementer | trophy · cross-boundary (frozen-file prop thread + new animation surface) · **NEW architectural surface → walking skeleton**: thinnest end-to-end slice — thread props (isolated commit), then on a `selectedSceneId` change mount ONE `.page-turn-layer`/`.page-leaf` inside `.canvas-scroll`, gated on `getTweak("motion")` + `prefers-reduced-motion` + `view==="editor"`, fwd-only, self-cleanup ~1250ms (timeout + onAnimationEnd, flip-key guarded). Extract pure `computeFlip({prevIndex,nextIndex,motion,reduced,view})` → `{dir}|null`, unit-tested. tsc is the net for the frozen-file thread. | In `npm run tauri dev`, clicking a different scene in the binder turns a single paper leaf across the canvas once, then it settles and disappears (Cole observes the page-turn). |
| 2 | Page-flip polish: direction + outgoing-scene leaf content | sonnet-implementer | trophy · internal-to-editor · direction by scene-order index (earlier→`back`, later→`fwd`); render the OUTGOING scene on the leaf front face (eyebrow + h1 + byline + snapshot of the outgoing prose HTML captured before the swap). Unit-test the direction helper across index pairs. | Switching to an earlier scene turns the leaf right-to-left; to a later scene left-to-right; the turning leaf shows the title/prose of the scene Cole is leaving. |
| 3 | Editor header / byline | sonnet-implementer | trophy · cross-boundary (reads `storyBibleStore` async) · `EditorHeader` above `EditorContent`: `.scene-eyebrow` (chapter title · `STATUS_META` status display), `.scene-h1` (title), `.scene-byline` (`useLiveWordCount` words · `useSceneLinkCounts` chars/locs). `isFinal` renders a check, else a colored dot. | Above the prose Cole sees the chapter name and status, the scene title as a heading, and a byline whose word count climbs as he types and that reads "N characters · N locations present" matching the scene's links. |
| 4 | Formatting bubble menu | sonnet-implementer | trophy · internal-to-editor · `<BubbleMenu editor={editor}>` from `@tiptap/react/menus`; buttons Bold/Italic/{sep}/Heading(H2)/Quote/List, canon inline-styled dark pill + `Icon`, `editor.isActive(...)` highlight. Visual-only — tsc + Cole's eyes are the net (BubbleMenu render needs a real selection). | Selecting a run of prose pops a dark rounded toolbar just above the selection; clicking Bold turns the selected text bold and the button shows active. |
| 5 | Spell/grammar de-conflict + grammar default-on | sonnet-implementer | pyramid · internal-to-editor · in `ProofreadExtension.ts` drop grammar `CheckResult`s whose `[from,to)` overlaps any spelling result; flip grammar default `false`→`true`; confirm harper render. Extract pure `dropOverlappingGrammar(spell, grammar)` → filtered, unit-tested (overlap, adjacency, disjoint cases). | A misspelled word shows ONE red wavy underline (no blue-over-red stack); right-clicking a grammar issue lists harper suggestions; grammar checking is on without Cole toggling anything. |

### Acceptance criteria

- [ ] `src/App.content.tsx` `<Editor>` receives `selectedSceneId`, `tree`, `view`, `storyBibleStore`, `linksVersion` (additive props; the change is confined to `buildViewStage` + `EditorPane` + the `<Editor>` call site).
- [ ] `computeFlip(...)` exists in `src/editor/usePageFlip.ts` (or sibling) and returns `null` when `motion` is false OR `reduced` is true OR `view !== "editor"`, and `{dir:"back"}` when `nextIndex < prevIndex`, else `{dir:"fwd"}`; covered by a unit test.
- [ ] On `selectedSceneId` change with motion on, the editor mounts exactly one element matching `.page-turn-layer` that is removed within ~1250ms (self-cleanup); a second rapid change does not leave a stuck leaf (flip-key guard).
- [ ] `EditorHeader` renders `.scene-eyebrow`, `.scene-h1`, `.scene-byline`; byline word count equals `useLiveWordCount(doc)`; character/location counts equal `loadSceneEntities(sceneId)` lengths (0/0 when unlinked); `STATUS_META[status].isFinal` controls check-vs-dot.
- [ ] `useSceneLinkCounts` re-fetches when `linksVersion` changes (unit test with a stubbed store).
- [ ] A `FormatBubble`/`BubbleMenu` is mounted with five command buttons wired to `toggleBold`/`toggleItalic`/`toggleHeading({level:2})`/`toggleBlockquote`/`toggleBulletList`; `import { BubbleMenu } from "@tiptap/react/menus"` type-checks with no new dependency added to `package.json`.
- [ ] `dropOverlappingGrammar(spell, grammar)` removes grammar results overlapping any spelling range and keeps disjoint ones; covered by a unit test (overlap / adjacent / disjoint).
- [ ] `readBoolSetting(SETTINGS_KEYS.grammar, true)` — grammar defaults on in `ProofreadExtension.ts`.
- [ ] `npm run lint` + `tsc` (via `npm run build` or `tsc --noEmit`) + touched `vitest` files all green.
- [ ] All files changed are within `src/editor/*` and `src/test/*`, EXCEPT the single authorized `src/App.content.tsx` prop-pass commit.

### Files the next agent should read first

1. `roadmap/wave-19-DRAFT-research.md` — current TipTap v3 `BubbleMenu` API + the integration-surface contract (names exact); the phase briefs are grounded in it.
2. `roadmap/canon-polish-coordination.md` § GLOBAL RULES + "Lane 19 — Editor" — the scope + the CONSUME-ONLY / FROZEN boundaries.
3. `design-reference/canvas.jsx` (header + `FormatBubble` shape) and `design-reference/shell.jsx:83-148` (page-flip mechanics — `prevSceneRef`, `flipNum` key guard, direction, 1250ms cleanup, `LeafPage`).
4. `src/editor/Editor.tsx` — the surface being extended (currently `{doc}`-only).
5. `src/editor/extensions/ProofreadExtension.ts` — `runChecks`, `buildDecorations`, the grammar default read (Phase 5 target).
6. `src/App.content.tsx:67-176` — the frozen `EditorPane`/`buildViewStage` seam the Phase-1 prop-pass edits (read to confirm the additive change stays minimal).
7. `src/lib/status.ts`, `src/db/storyBibleStore.ts` (`loadSceneEntities`), `src/features/settings/settings.store.ts` (`getTweak`) — the consumed contracts.
8. `src/styles/app.css:658-706` + `:275-309` — the page-flip + header classes to wire (read-only; never edit).
9. The `## Locked decisions` section of this wave file.

### Note to the implementer

The spirit of this wave is **wiring canon that already exists** — the CSS classes, the design-reference component shapes, and the data layer are all built; you are connecting them, not inventing them. Resist three temptations: (1) writing CSS — every class you need is in `app.css`; if one is genuinely missing, STOP and flag the lead, do not author it; (2) widening the frozen-file edit — the `App.content.tsx` change is a thin additive prop-pass in ONE labeled commit, nothing more; (3) building status-mutation, link-editing, or anything that belongs to Lanes 18/20. Page-flip is a NEW architectural surface — get the Phase-1 walking skeleton (one scene-change → one leaf, end-to-end, cleaned up) working before adding direction or leaf content. First step: verify the `## Locked decisions` section below is filled in. You cannot run the Tauri app or see the rendered UI — verify via `tsc` + `vitest` + line-by-line comparison against `canvas.jsx`/`shell.jsx`, and record every visual behavior that needs Cole's post-merge eyes.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

**Decision 1: Foundation prop-pass through frozen EditorPane.**
**Context:** Editor needs scene/view/store context the frozen `EditorPane` doesn't thread. **Pick:** minimal additive prop-pass (`selectedSceneId`, `tree`, `view`, `storyBibleStore`, `linksVersion`) in one isolated commit. **Rationale:** USER-LOCKED (Cole, 2026-06-04, Option A) — it's the "small wiring edit" Wave 17 was meant to do, not a component rewrite; no consume-only path exists (App is frozen, no global for scene/view). **Consequences:** lane touches one frozen file; lead reviews that delta at merge. **Enforcement:** isolated labeled commit (`foundation(wave-19):`) + handoff flag; advisory-only.

**Decision 2: Editor eyebrow status is read-only this wave.**
**Context:** canvas.jsx makes the eyebrow status a click-to-change button. **Pick:** render status as display only; mutation stays in binder (Lane 18) + corkboard (Lane 20). **Rationale:** wiring a setter needs more frozen-file threading and duplicates other lanes' status-mutation paths — out of Lane 19 scope. **Consequence:** editor users change status via binder/corkboard, not the eyebrow. **Enforcement:** scope section + `Out of scope`; convention.

**Decision 3: Spelling wins on overlapping spell/grammar ranges.**
**Context:** the "weird blue mark" is a grammar `.grammar-error` decoration stacked on a spelling `.spell-error` over the same range. **Pick:** drop grammar `CheckResult`s overlapping any spelling range. **Rationale:** extends the existing Decision G (nspell owns spelling; harper already skips its own spelling bucket) to the cross-engine overlap case — codebase-native, single defensible answer. **Consequence:** a misspelled token that a grammar lint also spans shows only the red spelling underline. **Enforcement:** `dropOverlappingGrammar` helper + unit test in Phase 5.

**Decision 4: Page-flip leaf shows the outgoing scene via a pre-swap prose snapshot.**
**Context:** the leaf (shell.jsx `LeafPage`) renders the scene being left; the editor only holds the incoming `doc` after the swap. **Pick:** on `selectedSceneId` change, capture the outgoing scene's metadata + rendered prose HTML (from the editor DOM) into a ref before React updates, render it on the leaf front face. **Rationale:** decouples the flip from the Yjs doc-swap timing; contained to `usePageFlip`. **Consequence:** leaf prose is a static HTML snapshot (acceptable — it animates away in ~1.2s). **Enforcement:** `usePageFlip.ts` + Phase-2 observation (Cole's eyes).

## Status

| Phase | Dispatched | Completed | Commit | Observation hit |
|---|---|---|---|---|

## Follow-up candidates

## Result
