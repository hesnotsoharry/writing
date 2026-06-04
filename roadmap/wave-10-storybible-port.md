---
status: PLANNED
created: 2026-06-03
---

# Wave 10: storybible-port

## Plan

### Status

PLANNED · style-only port · drafted 2026-06-03 · branch `wave-10-storybible-port` (worktree `C:/Web App/writing-wave10-storybible`)

### Goal

After this wave, `src/storybible/StoryBibleView.tsx` renders entirely through the
shared design-system classes in `src/styles/app.css` instead of ~11 module-level
inline-`CSSProperties` constants plus three inline-styled root elements. The screen
visually matches `design-reference/views.jsx` `StoryBible()` — a two-column
`.bible-grid` of `.bible-entry` cards (avatar + name + role + notes) under
`.bible-col-title` headers, inside the `.corkboard` / `.corkboard-inner` parchment
canvas — while every existing behavior (inline rename, notes editing, add, delete)
and every accessible label asserted by the locked test is preserved byte-for-byte.
No shared CSS, `App.tsx`, or `src/db/` file is modified.

### Scope

**In scope:**

- `src/storybible/StoryBibleView.tsx` — the ONLY file edited this wave.
  - Delete the 11 inline-style constants (`sectionStyle`, `headingStyle`, `rowStyle`,
    `rowTopStyle`, `nameSpanStyle`, `nameInputStyle`, `notesStyle`, `deleteBtnStyle`,
    `addRowStyle`, `addInputStyle`, `addBtnStyle`).
  - Remove the root `<main>` inline styles and the inline-styled "Story Bible"
    header block + `<h2>` (lines ~279–282).
  - Remap structure to shared classes: `.corkboard` > `.corkboard-inner` >
    `.bible-grid` > two columns each with `.bible-col-title` + N×`.bible-entry`
    (`.avatar.character|.location` + `.be-body` > `.be-name`/`.be-role`/`.be-notes`)
    + `.add-entity` button.
  - Inline rename input → `.rename-input` class.
- Preserve: `useState`/`useEffect` data flow, `refreshVersion` keying, all store
  calls, all accessible labels/placeholders/aria-labels, name-as-text rendering.

**Out of scope:**

- `src/App.tsx` — owned by wave-9 (Inspector) only. Not touched. (Deferral: wave-9.)
- `src/styles/app.css` + `tokens.css` — CONSUME-ONLY (coordination rule 1). If a
  class seems missing, flag it; do NOT add. (Deferral: flag to lead → shared-CSS pass.)
- `src/db/` — frozen (coordination rule 4). No new queries this lane. (Deferral: wave-9.)
- `.be-foot` scene-count row from the design reference. Our data model has no scene
  count loaded here; wiring `findScenesForEntity` per entity is a behavior addition
  beyond a style port. (Deferral: see Follow-up candidates / StatusBar-style live-data wave.)
- Icons in `.bible-col-title` / entries. No `Icon` component is in scope for this lane;
  text-only headers render correctly against the existing class. (Deferral: future polish.)

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Remap StoryBibleView to shared classes | `sonnet-implementer` | trophy (1 locked acceptance test + existing CRUD test is the floor) · internal-only (style refactor, no boundary crossed) · Brief: delete the 11 inline-style constants + root/header inline styles; rebuild JSX with `.corkboard`/`.corkboard-inner`/`.bible-grid`/`.bible-col-title`/`.bible-entry`/`.avatar.character\|.location`/`.be-body`/`.be-name`/`.be-role`/`.be-notes`/`.add-entity`/`.rename-input` per `design-reference/views.jsx`. Keep ALL labels the test asserts ("Add character"/"Add location", placeholders, `Delete ${name}`). Keep minimal local inline ONLY for edit-chrome with no shared class (notes textarea reset, delete-× button, add input) — do NOT add to app.css. | Manual smoke: Story Bible view renders as parchment two-column card grid (no white pane / inline-debt look); add/rename/delete/notes-edit all still work. |

Single-phase wave: one file, one cohesive refactor. No new architectural surface
(React + existing CSS classes already in use across the app) → no walking-skeleton
phase required.

### Acceptance criteria

- [ ] All 11 inline-style constants and the root/header inline styles are gone from `StoryBibleView.tsx`.
- [ ] JSX renders through `.corkboard` > `.corkboard-inner` > `.bible-grid` two-column structure with `.bible-col-title` headers and `.bible-entry` cards matching `design-reference/views.jsx`.
- [ ] Each entry shows `.avatar` (type class + uppercased name initial), `.be-name` (name as text / editable), `.be-role` (entity kind), `.be-notes` (editable notes).
- [ ] Inline rename uses the `.rename-input` class.
- [ ] `src/test/storyBibleView.test.tsx` passes unchanged (add/delete CRUD + accessible labels).
- [ ] `npm run test -- storyBibleView` GREEN; `tsc` GREEN; `npm run lint` GREEN on the touched file.
- [ ] No diff outside `src/storybible/StoryBibleView.tsx` (+ this wave file). `git diff --stat` confirms app.css/App.tsx/src/db untouched.
- [ ] Manual smoke (orchestrator, `npm run tauri dev` or rendered view): Story Bible looks like the design reference; add/rename/delete/notes-edit work.

### Files the next agent should read first

1. `src/storybible/StoryBibleView.tsx` — the file being ported (current inline-style state).
2. `design-reference/views.jsx` — `StoryBible()` + `BibleEntry()`, the target markup.
3. `src/styles/app.css` lines 342–361 (`.avatar`, `.add-entity`), 377–380 (`.empty-hint`), 439–496 (`.corkboard`/`.bible-*`), 581–587 (`.rename-input`) — the class contract (READ-ONLY).
4. `src/db/storyBibleStore.ts` — the `Character`/`Location` data model (fields actually available: `name`, `notes` only).
5. `src/test/storyBibleView.test.tsx` — the locked accessible contract the port must preserve.

### Note to the implementer

This is a paint job, not a remodel. The behavior already works and is tested — your
job is to swap inline styles for shared classes so the screen stops wearing the
reparented-screen inline debt and starts looking like `design-reference/views.jsx`.
First step: verify the `## Locked decisions` section below is filled in — it resolves
the three real tensions (data fields that don't exist, the test-vs-design wording
conflict, and where residual inline is allowed). Resist two temptations: (1) do NOT
add a class to `app.css` for the notes textarea or delete button — those edit-chrome
bits keep a minimal LOCAL inline style; app.css is consume-only. (2) Do NOT copy the
design reference's "New character" button text or its context-menu delete — the locked
test requires the button text "Add character"/"Add location" and a `Delete ${name}`
button, so keep the existing add-input + delete-× interaction model and only reskin it.

Before declaring the phase complete, restate the observation point in your own words
and describe what you actually observed: render the Story Bible view and confirm it
shows the parchment two-column card grid (not the white-pane inline-debt look) and
that add / rename / delete / notes-edit all still function. If you cannot render it
live, say so explicitly — "tests pass" is necessary but not sufficient for a visual port.

## Locked decisions

> These are trivial style-mapping calls (codebase-native, one defensible answer each),
> recorded at plan time — not routed through the decision-review cell (no `sonnet-architect`
> dispatch, so `adversarial_review_enforce.mjs` is not armed).

## Decision 1: avatar color/initial source

**Context:** `design-reference` `BibleEntry` reads `entity.color` + `entity.initial`; neither field exists on our `Character`/`Location`.
**Pick:** Derive `initial` = `name.trim()[0]?.toUpperCase()`; use the type-based `.avatar.character` / `.avatar.location` classes for color (already defined in app.css) instead of a per-entity color.
**Rationale:** Type-based avatar color is data-backed and already styled; inventing a per-entity color field is out of a style-port's scope and would need `src/db/` changes (forbidden).
**Consequences:** All characters share one avatar tint, all locations another — matches the existing token system; no schema change.
**Enforcement:** advisory-only (plan guidance; verified by phase reviewer + manual smoke).

## Decision 2: be-role text source

**Context:** `design-reference` shows `entity.role || kind`; we have no `role` field.
**Pick:** Render `.be-role` as the entity kind — "Character" / "Location".
**Rationale:** Preserves the visual role line with truthful data; no field invention.
**Enforcement:** advisory-only.

## Decision 3: residual inline styles for edit-chrome

**Context:** The screen is fully inline-editable (name span→input, always-on notes textarea, add input, delete ×), but app.css has no class for these edit affordances and is consume-only (coordination rule 1).
**Pick:** Display/resting elements use shared classes; transient edit-chrome (notes textarea border/bg reset, delete-× button, add input) keeps a MINIMAL local inline style. Name-edit input reuses the existing `.rename-input` class.
**Rationale:** Honors "shed the inline-style CONSTANTS → classes" without editing the forbidden shared CSS. These chrome bits are component-local edit affordances, not part of the resting design system, so a shared class is not "truly missing."
**Consequences:** A small amount of inline style remains, scoped to edit interactions only. If the lead wants these tokenized, that's a shared-CSS pass (flag, don't self-add).
**Enforcement:** advisory-only (phase reviewer confirms no app.css edit; `git diff --stat` gate).

## Decision 4: test wording wins over design wording

**Context:** `design-reference` add button reads "New character"; the locked test asserts button text "Add character"/"Add location" + placeholders "New character name"/"New location name".
**Pick:** Keep the existing add labels/placeholders exactly; do NOT adopt the design reference's button wording.
**Rationale:** The test is the locked contract; a style port must not break it.
**Enforcement:** gate — `src/test/storyBibleView.test.tsx` (fails if wording drifts).

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | — | — | — | — |

## Follow-up candidates

<!-- DEFAULT empty. Stage here only if Tier-3 TRIPLE gate clears (VALUE + STRUCTURAL + CLEARABILITY). -->

## Result

<!-- filled at ship by wrap team -->
