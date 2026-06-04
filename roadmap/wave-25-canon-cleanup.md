---
status: PLANNED
created: 2026-06-04
---

# Wave 25 — DRAFT TITLE

## Plan

### Status

DRAFT · target v0.5.0 · drafted 2026-06-04.

### Goal

After this wave the canon UI that landed in waves 18–21 actually behaves as designed. The App wiring the
parallel sweep had to freeze — whole-manuscript word total, quick-notes / archived counts, a reload
callback, and view→side-panel visibility — is threaded so the data-flow bugs disappear at their root. On
top of that foundation: the binder's selected scene is readable in dark mode (clay, not cream) and shows
per-scene word counts, chapters add inline at the list bottom, and empty chapters invite a first scene;
the editor plays its page-flip on scene change and the prose surface has a clean "start writing"
affordance with no stray input boxes; the inspector links and creates characters/locations and renders a
saved synopsis identically to its edit state; the status bar shows the true manuscript total with clean
goal percentages; goals are scoped to manuscript / chapter / scene and addable from a scene's right-click
menu; the corkboard and story bible render full-screen with working status-sync and canon-styled cards;
quick-notes pins to a working modal; and the canon page-load / float-in / selected-indicator animations
plus the window-control hover all fire.

### Scope

**In scope:**

- **Phase 1 — Foundation (`App.content.tsx` / `App.tsx` / `App.handlers.ts`):** compute the real
  whole-manuscript word total (`useManuscriptWordCount`) and thread it to `StatusBar` (the
  `ProjectSwitcher` subtitle CONSUMES this total in P2 — binder owns that file); thread `quickCount` to
  the binder footer (`archivedCount` deferred to Lane 22 — no archive store exists yet, so the Archived
  button stays render-guarded); establish a tree-reload callback in App wiring for Corkboard + inspector
  to consume in P4/P5; drive side-panel visibility off `view` so Corkboard and Story Bible render full-screen.
- **Phase 2 — Binder (`src/binder/*`):** dark-mode selected-row clay fix; per-scene `.scene-words`
  counter; inline add-chapter at list bottom; "No scenes yet — add one" empty state (clay, clickable);
  ProjectSwitcher subtitle word count (consumes P1 total); quick-notes footer pinned bottom + the canon
  quick-notes modal.
- **Phase 3 — Editor (`src/editor/*`):** diagnose + fix the inert page-flip; remove the two stray prose
  input boxes and replace with a clean canon "start writing" placeholder (no boxes once typing).
- **Phase 4 — Inspector (`src/inspector/*`):** diagnose + fix "Link a character/location" + section-`+`
  "create"; synopsis saved-state styling parity with its edit state.
- **Phase 5 — Corkboard (`src/features/corkboard/*`):** status-set propagates to the binder immediately
  (consumes P1 reload); full-screen (no side panels); drag-and-drop card reorder that persists and
  mirrors to the binder order.
- **Phase 6 — Goals + status-bar polish (`src/features/goals/*`, `src/shell/StatusBar.tsx`):** scope
  dimension (manuscript / chapter / scene) on the daily goal model + a functional "counts towards"
  dropdown scoped to the current selection + right-pane display of the active goal; right-click
  chapter/scene → "Add goal" pre-scoped; clean goal-percentage formatting (no float artifacts);
  backup-label honesty per Decision 4.
- **Phase 7 — Story bible (`src/storybible/*`):** diagnose + fix the stuck grab-cursor; full-screen (no
  side panels); notes box clay (light + dark); canon right-click card menu (Edit name / Delete; "Open
  full entry" stub deferred to Lane 24); copy the corkboard card shadow onto entity cards.
- **Phase 8 — Animations + chrome (`src/editor/*`, `src/features/corkboard/*`, `src/storybible/*`,
  `src/binder/*`, `src/shell/TitleBar.tsx`):** canon page-load fade-up on write/corkboard/story-bible;
  overlay float-in (quick-notes modal et al.); selected-indicator spread-from-middle animation;
  close-window control hover → clay.

**Out of scope:**

- **Archive (Lane 22), Export (Lane 23), Full-Entry pages (Lane 24)** — the three parallel worktree
  streams; merged separately per `roadmap/batch-2-coordination.md`.
- **Story-bible "Open full entry" navigation** — the menu item is built here as a deferred no-op; the
  actual open-entry view + nav stack is wired when Lane 24 lands (Decision 3).
- **DB migrations** — this wave uses the existing schema; `entity_links` / `entity_fields` are Lane 24's.
- **Goal total-target-per-scope** — deferred (Cole's partner may request; Decision 2). Daily-scoped only.
- **Real off-machine backup** — Phase 6 only corrects the label honesty, not the backup mechanism (a
  later phase/wave).

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Foundation: App data threading + view→panel visibility | sonnet-implementer | trophy · cross-boundary (App↔stores) · reviewTier single. Thread `useManuscriptWordCount` total + `quickCount`/`archivedCount` + a tree-reload callback through `App.content.tsx`; drive side-panel hide off `view`. No new schema. | In a live session the status bar reads the full manuscript total (sum across all scenes), not the open scene's count; opening Corkboard or Story Bible hides both side panels. |
| 2 | Binder / left-pane fixes | sonnet-implementer | trophy · internal-only · reviewTier single. Dark clay selected row, `.scene-words` per scene, inline add-chapter at bottom, empty-state, subtitle total (consumes P1), quick-notes footer+modal. Canon: `binder.jsx`, `dialogs.jsx`. | In dark mode the selected scene row renders clay with readable text; each scene row shows its word count; an empty chapter shows "No scenes yet — add one" and clicking "add one" creates a scene; "New chapter" adds inline at the list bottom. |
| 3 | Editor: page-flip + prose affordance | sonnet-implementer | trophy · internal-only · reviewTier single. **Diagnose-first** the inert page-flip (`sonnet-diagnostician` → attack-hypothesis review) before fixing — check motion gate / `view` value / leaf mount in `.canvas-scroll`. Then remove 2 prose boxes → canon placeholder. Canon: `canvas.jsx`, `shell.jsx`. | Switching scenes plays the page-flip (a leaf turns ~1.17s in the binder-order direction, then clears); the prose surface shows a clean "start writing" placeholder and once typing there are no boxes around anything. |
| 4 | Inspector: link/create + synopsis parity | sonnet-implementer | trophy · internal-only · reviewTier single. **Diagnose-first** why link/create no-ops (likely module-singleton store path, now fixable via P1 reload/store). Linking uses existing `replaceSceneLinks` — decoupled from Lane 24. Canon: `inspector.jsx`, FULL-ENTRY-SPEC §8. | Clicking "Link a character/location" links an existing entity and it appears in the scene's list; the section "+" creates a new entity linked to the open scene; a saved synopsis renders in the same style as while editing. |
| 5 | Corkboard: sync + full-screen + drag-reorder | sonnet-implementer | trophy · internal-only · reviewTier single. Status-sync verified after P1 reload (may resolve for free); full-screen via P1 visibility; drag-drop reorder persists via the existing binder reorder path and mirrors to the left panel. Canon: `views.jsx`. | Setting a card's status updates the left binder status dot immediately (no manual re-move); the corkboard renders with no side panels; dragging a card reorders it and the same order appears in the binder. |
| 6 | Goals scope + status-bar polish | sonnet-implementer | pyramid (goal-model logic) + trophy (UI) · internal-only · reviewTier single. Add scope (manuscript/chapter/scene) to the daily goal model + dropdown + right-pane display + right-click "Add goal"; clean percentage format; backup-label honesty (Decision 4). Daily model preserved (Decision 2). | The "counts towards" dropdown offers Manuscript/Chapter/Scene and the right panel shows the active goal scoped to the current selection; right-clicking a scene shows "Add goal" which opens goal setup pre-scoped; the goal percentage reads a clean value (70%, 90%) as words are written, not 0.6999…. |
| 7 | Story bible: cursor + full-screen + cards | sonnet-implementer | trophy · internal-only · reviewTier single. **Diagnose-first** the stuck grab-cursor (leftover `cursor:grab` from removed resize). Full-screen via P1; notes box clay (light+dark); right-click card menu (Edit name/Delete, "Open full entry" deferred no-op per Decision 3); copy corkboard card shadow. Canon: `views.jsx`, `full-entry.css`. | Entering the story bible shows a normal pointer (not a stuck grab-hand) that stays normal after navigating away; the page renders with no side panels; the notes box is clay in both themes; right-clicking a card shows Edit name / Delete; cards carry the corkboard drop-shadow. |
| 8 | Animations + chrome hover | sonnet-implementer | trophy · internal-only · reviewTier single. Canon page-load fade-up (write/corkboard/story-bible), overlay float-in (quick-notes modal), selected-indicator spread-from-middle, close-window hover→clay. Consume canon CSS classes (Decision 1) — do not invent. Canon: `app.css`, `chrome.jsx`. | Opening Write / Corkboard / Story Bible fades the page content up into place; opening the quick-notes modal floats it in; the left-pane selected indicator animates out from its middle; hovering the window close button turns it clay. |

### Acceptance criteria

- [ ] `StatusBar` manuscript total equals the sum of all scenes' word counts (via `useManuscriptWordCount`), verified in a live session with ≥2 scenes — not the active scene's count.
- [ ] Entering `view === "cork"` or `view === "bible"` renders with neither the binder nor the inspector panel mounted.
- [ ] In dark mode the selected scene row uses a clay background token with contrast-passing text (no cream-on-cream).
- [ ] Every scene row renders a `.scene-words` count; an empty chapter renders the "No scenes yet — add one" affordance whose "add one" click creates a scene in that chapter.
- [ ] "New chapter" creates a chapter inline at the bottom of the binder list.
- [ ] Switching the active scene mounts a `.page-leaf` that animates and self-removes (page-flip no longer inert), gated on motion + `prefers-reduced-motion` + `view === "editor"`.
- [ ] The prose surface renders no empty input boxes; an empty scene shows a canon placeholder.
- [ ] `replaceSceneLinks` fires from the inspector "Link a character/location" picker and from the section-`+` create path; the linked/created entity appears in the scene's inspector list.
- [ ] A saved synopsis and an in-edit synopsis use the same typography (no visual style switch on commit).
- [ ] Setting a corkboard card's status updates the binder's status dot for that scene without a manual reorder.
- [ ] Dragging a corkboard card to a new position persists the order and the binder reflects the same order.
- [ ] The goal "counts towards" dropdown has Manuscript / Chapter / Scene options; selecting Chapter/Scene scopes progress to the current selection; `useDailyGoalProgress` accepts a scope argument.
- [ ] Right-clicking a chapter or scene shows an "Add goal" item that opens goal setup with that target pre-selected.
- [ ] The goal percentage rendered in the status bar is formatted to ≤1 decimal place with no floating-point artifact string.
- [ ] Entering the story bible yields a default pointer cursor (no persistent `cursor:grab`); the notes box uses the clay token in light and dark; right-clicking a card shows Edit name / Delete.
- [ ] Story-bible entity cards carry the same shadow class the corkboard cards use.
- [ ] Page-load fade-up plays on entering Write / Corkboard / Story Bible (gated on the motion tweak); the quick-notes modal floats in; the selected-indicator animates from its middle; the window close button hovers clay.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the full `npm run test` suite all pass at wave end.

### Files the next agent should read first

1. `roadmap/wave-25-canon-cleanup.md` `## Locked decisions` — the decisions governing this wave (read before any phase).
2. `roadmap/canon-polish-coordination.md` — the sweep's global rules + the foundation contracts (status.ts, sceneMenu.ts, goalModel, manuscriptWords, useEditorStyle) the canon lanes consume.
3. `design-reference/` canon source for the phase you're on: `binder.jsx` (P2), `canvas.jsx`+`shell.jsx` (P3), `inspector.jsx`+`FULL-ENTRY-SPEC.md` §8 (P4), `views.jsx` (P5,P7), `dialogs.jsx` (P2 modal), `chrome.jsx`+`app.css` (P8). `tokens.css`/`app.css` are the styling source of truth.
4. `src/App.content.tsx`, `src/App.state.ts`, `src/App.handlers.ts` — the wiring surface (was frozen during the sweep; editable now; Phase 1 owns the threading).
5. `src/lib/status.ts`, `src/lib/manuscriptWords.ts`, `src/features/goals/goalModel.ts` + `useDailyGoalProgress.ts` — Wave 17 contracts P1/P2/P6 build on.
6. The specific surface file(s) for the active phase's owned dir (see the Scope list).

### Note to the implementer

This is a wiring-and-fidelity sweep, not a rebuild — the components exist and mostly work; the canon
behavior just isn't connected. Resist rewriting anything in a parallel lane's scope (archive, export,
full-entry — those are worktrees) and resist "improving" the Wave 17 contracts (status.ts, sceneMenu.ts,
goalModel) — consume them. Phase 1 is the foundation: do it first; several later "bugs" (manuscript count,
corkboard sync, subtitle) dissolve once the data is threaded, so re-test those after P1 before treating
them as separate fixes. For the three diagnose-first phases (3 page-flip, 4 link/create, 7 cursor), find
the root cause before touching code — these are "shipped but inert," so a blind fix will miss. First step:
verify the `## Locked decisions` section below has its decisions filled in.

Before declaring a phase complete, restate the observation point from the Phases table Observation column
in your own words and describe what you actually observed there. If you could not observe it directly — no
live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass"
for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

**Decision 1 — Consume canon CSS for animations; do not author new keyframes.**
Context: page-load fade-up, float-in, selected-indicator, and hover states all shipped in the original
canon and live in `design-reference/app.css`/`tokens.css`.
Pick: apply the existing canon classes/tokens; if a needed class is genuinely absent, flag rather than invent.
Consequences: animations match canon exactly; `app.css`/`tokens.css` edits are additive-only and rare.
Enforcement: advisory-only (reviewer checks P8 diff for net-new keyframes vs canon-class application).

**Decision 2 — Goal model stays daily; add a scope dimension only.** `durable: candidate`
Context: smoke surfaced a non-functional "counts towards" dropdown; Cole locked the product shape.
Pick: keep the Wave 17 daily / whole-manuscript model and extend it with a scope (manuscript|chapter|scene
+ targetId); compute daily delta for the scope. Total-target-per-scope is NOT built now.
Consequences: `useDailyGoalProgress`/`goalModel` gain a scope arg; total-target is a future additive change.
Enforcement: none (convention) — product decision recorded by Cole 2026-06-04.

**Decision 3 — Story-bible "Open full entry" is a deferred no-op this wave.**
Context: the full-entry view + nav stack is Lane 24 (parallel worktree); the right-click menu lives here (#18).
Pick: build the canon right-click card menu with Edit name + Delete now; ship "Open full entry" as a present
menu item whose handler is a deferred no-op (or "coming soon" toast) until Lane 24's integration wires it.
Consequences: clean menu now; one integration commit on master when Lane 24 lands swaps the no-op for `openEntry`.
Enforcement: advisory-only (Lane 24 integration step in `batch-2-coordination.md`).

**Decision 4 — Backup status label: make it honest now (LOCKED, Cole 2026-06-04).**
Context: the StatusBar "Backed up" label is cosmetic — no real off-machine backup exists yet (the clock is real).
Real backup is being set up by Cole in parallel (separate from this wave) + wired in a future wave.
Pick: P6 shows an honest local-only state (no "Backed up" claim) rather than implying off-machine safety the
app does not yet provide; once real backup ships, the label reflects true backup status.
Consequences: P6 edits the StatusBar label to a truthful state; the future backup wave swaps in real status.
Enforcement: none (convention) — product decision, Cole 2026-06-04.

## Status

| Phase | Dispatched | Completed | Commit | Notes |
|---|---|---|---|---|
| 1 Foundation | 2026-06-04 | 2026-06-04 | 49da98b | gates green; review single-tier FLAGs adjudicated (reloadTree forward-contract accepted; subtitle scope reworded to P2; bible+null-project fallthrough = pre-existing, noted). reloadTree established for P4/P5; archivedCount deferred to Lane 22. |
| 2 Binder | 2026-06-04 | 2026-06-04 | e438f80 | gates green (510 tests); 4 review FLAGs fixed pre-commit: 0-word count renders "0" not "—", onCreateScene inline (no window.prompt), short-pieces empty-state clickable "add one", + .active selected-row test. Dark-clay fix via useTheme removing inline tint so dark cascade applies. manuscriptTotal→subtitle; quick-notes footer→Inbox modal. |
| 3 Editor | 2026-06-04 | 2026-06-04 | a7267f9 | gates green (516 tests). Page-flip root cause: Editor unmounts on scene-switch (reset prevSceneRef) + view-string gate mismatch → lifted usePageFlip to always-mounted EditorPane + fixed view gate. Prose boxes removed via .editor-content-mount CSS reset + "Start writing…" placeholder. Review FLAGs adjudicated: app.css edit justified (can't reset TipTap .ProseMirror via React props); added position:relative to make placeholder self-contained; effect-dep view-staleness noted (low risk). ⚠ NEEDS COLE'S SMOKE: the leaf X-slide is clipped by .canvas-scroll overflow-x:hidden — flip fires but slide-off is clipped; if visually wrong, move the leaf mount to .canvas-pane (contained fix). |
| 4 Inspector | 2026-06-04 | 2026-06-04 | (this commit) | gates green (519 tests, +3). Root causes confirmed: (A) header '+' was wired to the link picker instead of createCharacter/createLocation — no create flow existed; also `e.currentTarget` nulled after yield, silently swallowing `getBoundingClientRect`. (B) `SynopsisEditField` textarea lacked `className="synopsis"` → browser-default styling differed from display div. Fixes: header '+' now calls create→replaceSceneLinks→onLinked→deferred onOpenEntry no-op per Decision 3; footer "Link a…" remains the picker; `triggerEl` captured before await; textarea gets `className="synopsis"`. Runtime observation: no Tauri runtime available — verified via wiring + 3 new unit tests (link adds to list, create+link calls replaceSceneLinks + deferred onOpenEntry, synopsis textarea carries same CSS class as display div). |

## Follow-up candidates

<!-- DEFAULT: empty. Tier-3 triple-gate only. -->

## Result

<!-- Filled at ship by wrap team. -->
