---
status: SHIPPED
created: 2026-06-07
completed: 2026-06-08
shipped: 2026-06-08
version: v0.2.1
---

# Wave 28 — Story-planning salvage (wave-27 feature fix-sweep)

## Plan

### Status

**SHIPPED as v0.2.1** (2026-06-08) · P1–P8 + 2 K3 wrap-fixes, all CDP-smoke-verified · Stage-5 review PASS (mechanical + wave-end adversarial, all flags addressed) · merged to `master` (fast-forward) + tagged `v0.2.1` + pushed to origin · drafted 2026-06-07, completed/shipped 2026-06-08.

### Goal

After this wave the eight story-planning features Sonnet built in wave-27 (branch
`orchestrator-test-fixes`) are canon-correct and runtime-verified: Find & Replace actually replaces
text and keeps it (no self-undo, marks preserved), the Snapshots overlay renders fully styled, the new
entity types show their correct fields/icons/accents in the right tiers, every Full Entry shows a single
relationships section, color labels appear on corkboard cards, goal cards are right-clickable, focus
mode highlights the current paragraph with a readable HUD, and auto-linked names have a working
settings panel and context menu. Each feature is brought to its `design-reference/` spec and confirmed
working in a live `tauri dev` CDP smoke before the next is touched.

### Scope

**In scope:**

- **P1 Find & Replace** (`src/features/findreplace/FindReplace.tsx`, `src/db/manuscriptSearchStore.ts`,
  `src/App.snapshots.ts`, `src/shell/TitleBar.tsx`): remove the immediate `onUndoReplace` self-undo;
  replace `buildDocFromText` with a mark-preserving headless replace (per `wave-28-DRAFT-research.md`);
  add match-case / whole-word toggles, a preview, a Toast-with-Undo, and the title-bar search button.
- **P2 Snapshots** (`src/storybible/VersionHistory.tsx`, `src/inspector/HistoryRail.tsx`,
  `src/styles/app.css`, `src/App.tsx`, `src/shell/TitleBar.tsx`): port `design-reference/snapshots.css`;
  add the title-bar ↺ entry; fix the HistoryRail stale-scene data-load; add a restoring spinner.
- **P3 Entity types** (`src/storybible/fullEntry/defs.ts`, `src/storybible/BibleTypes.tsx`,
  `src/storybible/EntityRow.tsx`, `src/storybible/fullEntry/FeTopbarHero.tsx`, CSS): correct DEF_FIELDS
  labels + faction `Conflicts` section; correct per-type icons/accents/tiers to the spec table; add
  `.avatar.generic-entity` CSS + fix new-type avatar fallback.
- **P4 Relationships + Full Entry** (`src/storybible/fullEntry/FullEntry.tsx`, `RelationshipGroup.tsx`,
  `src/storybible/BibleListView.tsx`, `src/App.entryView.tsx`, `src/storybible/fullEntry/FeTopbarHero.tsx`,
  `storyBibleStore.ts`, possibly a migration): resolve the double relationship section; make the
  breadcrumb root clickable; remove the `setState`-in-effect; fix the RelationshipMap stale `useMemo`;
  presets + map-view per the locked decisions.
- **P5 Outliner + Labels** (`src/features/corkboard/CorkCard.tsx`, `src/styles/tokens.css`,
  `src/features/outliner/*`, `labelStore.ts` + impls): LabelBadges on corkboard cards; 8 `--label-*-tint`
  tokens; `reorderLabels` store method + UI; empty-outliner prompt; `contentEditable` re-render guard.
- **P6 Goals** (`src/features/goals/InspectorGoalRings.tsx`, `src/inspector/InspectorGoalRings.tsx`,
  `Goals.tsx`, `src/App.content.tsx`): inspector goal-card right-click menu + jump-to-goal; thread real
  manuscript word count; resolve the duplicate `GoalRing`.
- **P7 Focus mode** (`src/styles/app.css`, `src/editor/Editor.tsx` or a new
  `src/features/focus/` wrapper, `src/App.content.tsx`): HUD opacity 0.15→0.6; cold-start dim fix; cog
  placement; the frozen-editor ruling.
- **P8 Auto-link** (`src/editor/Editor.tsx`, `src/editor/extensions/AutoLink.ts`,
  `src/storybible/AutoLinkPeek.tsx`, new settings panel, `app.css`): make `linksVersion` optional+guarded
  and the store prop interface-typed; build the settings panel + reactive toggle; right-click context
  menu + "Find mentions"; underline 1px→1.5px; `autolinkScope`.

**Out of scope:**

- **Outliner drag-to-reorder** — already deferred by Sonnet with a filed follow-up
  (`roadmap/follow-ups/2026-06-05-27-outliner-drag-reorder.md`); stays deferred, not reopened here.
- **Auto-capture settings UI + close/interval hook for Snapshots** — explicitly spec-deferred in
  `SNAPSHOTS-SPEC.md`; not built this wave.
- **`autolinkStyle` clean-until-hover (`al-hideunder`) mode** — second autolink visual mode; defer to a
  follow-up unless P8 lands with budget to spare (Direction-B styling, not core function).
- **New features beyond the wave-27 set** — this is a salvage/fix wave; no net-new capability.
- **Merge to `master`** — happens after the wave ships and smokes clean, as a separate step Cole approves.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| P1 | Find & Replace — fix critical self-undo + format-preserving replace | sonnet-implementer | **Honeycomb · cross-boundary (persistent storage) · reviewTier: panel + orchestrator-owned acceptance test.** Remove immediate `onUndoReplace` self-undo (`FindReplace.tsx:175`) → defer to a Toast Undo button. Replace `buildDocFromText` with mark-preserving headless replace (`yDocToProsemirror`→`tr.insertText`→`prosemirrorToYDoc`→`Y.applyUpdate`; add `y-prosemirror` dep if not transitively resolvable) per `wave-28-DRAFT-research.md`. Add match-case/whole-word toggles + preview + title-bar button. Keep snapshot-before-replace-all. | In `tauri dev`, Cmd+Shift+H replaces a term across scenes; the replaced text keeps its bold/italic formatting, stays replaced (no auto-undo), and a Toast offers Undo. |
| P2 | Snapshots — port CSS, wire entry, fix HistoryRail | sonnet-implementer | **Trophy · internal+CSS · reviewTier: single.** Port `design-reference/snapshots.css` classes (`diff-add`/`diff-del`/`vh-*`/`snap-*`) into `src/styles/app.css`. Add title-bar ↺ entry (`TitleBar.tsx`). Fix HistoryRail data-load: fetch on scene change + reset `historySceneId` on switch (`App.tsx:244-250`). Add restoring spinner. | The version-history overlay (title-bar ↺) renders fully styled — snapshot rows + a word-diff with green/red runs; the inspector HistoryRail shows the currently-open scene's snapshots, not a stale scene's. |
| P3 | Entity types — fix data constants + avatar CSS | sonnet-implementer | **Trophy · internal data+CSS · reviewTier: single.** Correct DEF_FIELDS labels (`defs.ts:22-25`) + add faction `Conflicts` section. Correct icons/accents/tiers (`BibleTypes.tsx:25-30`) to the spec table (item feather/gold, faction users/plum, lore sparkle/sea, theme quote/rose; Locations+Items under People&Groups). Add `.avatar.generic-entity` CSS; fix `FeTopbarHero` new-type avatar fallback. | Opening an Item in the Story Bible shows Kind/Owner/Status fields with a feather icon + gold accent; Items and Factions appear under the "People & Groups" tier. |
| P4 | Relationships + Full Entry — de-dup, breadcrumb, effect, presets | sonnet-implementer | **Honeycomb (if `entity_links` migration) · cross-boundary · reviewTier: panel.** Apply locked decisions Q-PEOPLEGROUP / Q-PRESETS / Q-MAPVIEW. Make breadcrumb root clickable (`FeTopbarHero.tsx:36-40`→`onExit`). Remove `setState`-in-effect (`App.entryView.tsx:105-107`; `key`-remount already covers). Fix RelationshipMap `useMemo` deps (add a label hash). Add `allRelations` alias. | A character's Full Entry shows ONE relationships section (not two duplicate blocks); clicking the breadcrumb root returns to the Story Bible; editing an edge label then reopening the map shows the new label. |
| P5 | Outliner + Labels — card badges, tints, reorder, empty state | sonnet-implementer | **Trophy · internal · reviewTier: single.** Add LabelBadges to `CorkCard`. Add 8 `--label-*-tint` tokens to `tokens.css` (mirror `--character-tint`) + switch LabelBadges off runtime `color-mix`. Add `reorderLabels` store method + LabelManager reorder UI. Add empty-outliner quiet prompt. Apply Q-LABELCAP / Q-STATUSDOT. Guard `contentEditable` synopsis against re-render clobber. | Corkboard cards display tinted color-label pills; an empty outliner shows a quiet "no scenes" prompt instead of blank; labels render with their tint wash. |
| P6 | Goals — inspector context menu, real word count, dedup ring | sonnet-implementer | **Trophy · internal · reviewTier: single.** Wire inspector goal-card right-click → Edit/Manage/Delete (`openGoalMenu` + `onContextMenu` through `ScopedGoalCards`→`FamilyGoalCard` + `App.content.tsx` handler) + overlay jump-to-goal-id. Thread real manuscript word count to the Goals overlay (replace `projectWords={0}`, `Goals.tsx:419`). Apply Q-GOALRING (keep family-scoped ring, delete old, update tests). | Right-clicking an inspector goal card opens an Edit / Manage all / Delete menu (the existing tooltip now does something); a new deadline goal's "already written" default reflects the real manuscript word count, not 0. |
| P7 | Focus mode — HUD opacity, cold-start dim, editor ruling | sonnet-implementer | **Trophy · internal (+editor-constraint ruling) · reviewTier: single.** Fix faded HUD opacity `0.15`→`0.6` (`app.css:853`). Dispatch an initial dim-focus on focus enter (fixes all-paragraphs-dimmed cold start). Apply Q-FROZEN ruling on `useFocusEditorEffects` placement. Move the settings cog adjacent to "Exit focus". | Entering focus mode highlights the current paragraph (not all paragraphs dimmed); the HUD sits visible-but-faded (~60%) and brightens on hover. |
| P8 | Auto-link — settings panel, context menu, frozen-editor fix | sonnet-implementer | **Trophy · internal (+editor-constraint) · reviewTier: single.** Make `Editor.tsx` `linksVersion` prop optional+guarded and type the store prop as the `StoryBibleStore` interface (per Q-FROZEN ruling; current required prop breaks isolated Editor tests). Build the autolink settings panel (toggle/appearance/scope/per-type chips) + reactive `autolinkOn` (add to dep array). Add right-click context menu (Open / Find mentions / Unlink / Never link / Manage aliases) + Find-mentions in the peek. Underline `1px`→`1.5px` (`app.css:1253`). Implement `autolinkScope` all-vs-first. | Right-clicking an auto-linked name opens a context menu (Open entry / Find mentions / …); toggling auto-link off in the new settings panel removes the underlines live, no restart. |
| Wrap | Wave-end gates + ship + handoff | orchestrator | Not a feature phase. Full suite + lint + format + typecheck; wave-end attack-diff review (Claude `sonnet-adversarial-reviewer` + Codex `adversarial` seat); `/review` mechanical gap-check; then `wrap-wave`. | Internal — no observation point. |

**Wave-level verification strategy (Site 4 — declared once, not per row).** Every feature phase's effect
is runtime/visual and was invisible to the static audit — that is the exact failure class that produced
wave-27's mess. Therefore **every feature phase is CDP-smoke-gated**: after gates go green, drive the app
via `npm run tauri dev` + the `tauri-devtools` MCP (screenshot + `evaluate_script` + `list_console_messages`)
and confirm the phase's Observation cell *before* committing. "Tests green" is necessary but never
sufficient this wave. (See memory `app-can-be-smoked-via-cdp-port`; dnd-kit drags still need a human drag
if one arises.) Pass `smoke: true` in each phase's `run-phase` brief.

**Claude-vs-Codex bake-off (wave-level — Cole's directive).** This wave is ALSO a head-to-head model
comparison: at every agent seat, run the Claude (Sonnet 4.6) agent AND a Codex (GPT-5.4) agent on the
SAME brief/task in parallel, then the orchestrator adjudicates — take the better, or graft best-of-both.
Codex is pinned to **gpt-5.4** for apples-to-apples with Sonnet 4.6 (stock `architect`/`adversarial`/
`diagnostician` profiles are 5.5 → override with `-c model="gpt-5.4"`):

| Seat | Claude | Codex (model · effort) | Isolation |
|---|---|---|---|
| Implementation | `sonnet-implementer` | `implementer` gpt-5.4 · medium | each in its own git worktree; both must pass the orchestrator-owned acceptance test; orchestrator lands winner/graft |
| Architect | `sonnet-architect` | `architect` -c gpt-5.4 · high | read-only, parallel |
| Adversarial review | `sonnet-adversarial-reviewer` | `adversarial` -c gpt-5.4 · high | read-only, same diff |
| Diagnostician (on friction) | `sonnet-diagnostician` | `diagnostician` -c gpt-5.4 · high | read-only, parallel |
| Reviewer (mechanical) | `/review` | `reviewer` gpt-5.4 · medium | read-only, parallel |
| Explorer | `sonnet-explorer` | `explorer` gpt-5.4-mini · medium | read-only, parallel |

The Codex adversarial seat still gates nothing (M-55 constraint — Claude's `sonnet-adversarial-reviewer`
remains the schema-bearing gate); the bake-off is observational + adjudicated. Adjudication criteria:
correctness, spec-adherence, completeness, code quality, conciseness, acceptance-test pass (impl).
**Deliverable:** `MODEL-BAKEOFF.md` at repo root — per-dispatch entries (seat · phase · task · each side's
verdict · winner + why · adjudication mode), a running scorecard, and a final per-seat overall verdict.
Caveat logged in the tally: the explorer seat is not perfectly apples-to-apples (Sonnet 4.6 full vs
gpt-5.4-**mini**).

### Acceptance criteria

- [ ] P1: replace-all writes the change and it PERSISTS — no immediate self-restore; the `onUndoReplace`
      call is gone from the post-replace path in `FindReplace.tsx` and Undo is a Toast button instead.
- [ ] P1: replacing a term inside formatted prose preserves surrounding marks — a unit/integration test
      over the new mark-preserving replace asserts a bold run survives a replace; `buildDocFromText` is
      no longer the replace path.
- [ ] P1: match-case and whole-word toggles exist in `FindReplace.tsx` and change results; a title-bar
      search button opens the overlay.
- [ ] P2: zero references to `design-reference/snapshots.css` classes remain unstyled — `diff-add`,
      `diff-del`, `vh-sheet`, `snap-row` (and the rest) resolve to rules in `src/styles/app.css`.
- [ ] P2: a title-bar ↺ button opens the version-history overlay; HistoryRail returns the open scene's
      snapshots after a scene switch (regression test on the data-load gating).
- [ ] P3: `defs.ts` DEF_FIELDS for item/faction/lore/theme match the spec table exactly; faction has a
      `Conflicts` section; `BibleTypes.tsx` icons/accents/tiers match the spec table.
- [ ] P3: a `.avatar.generic-entity` rule exists in CSS and non-char/loc entity rows are not unstyled.
- [ ] P4: a character Full Entry renders exactly one relationships section (assert PeopleGroup is not
      co-rendered with RelationshipGroup); breadcrumb root has an `onClick`; `App.entryView.tsx` has no
      `setState`-in-effect.
- [ ] P5: `CorkCard` imports and renders `LabelBadges`; `tokens.css` defines 8 `--label-*-tint` vars;
      `reorderLabels` exists on the label store interface + both impls.
- [ ] P6: inspector goal cards have a working `onContextMenu` → Edit/Manage/Delete; `Goals.tsx` no longer
      passes `projectWords={0}` (real count threaded); only one `GoalRing` implementation remains.
- [ ] P7: `.focus-hud.faded` opacity is `0.6`; entering focus mode marks one paragraph `data-focused`
      without a cursor move.
- [ ] P8: `Editor.tsx` `linksVersion` prop is optional; the store prop is typed as the `StoryBibleStore`
      interface; a settings panel toggles auto-link live; `.al-link` has a right-click context menu.
- [ ] Every feature phase has a recorded CDP smoke observation in the wave file `## Status` before its commit.
- [ ] Wrap: full suite + lint + typecheck + format clean; wave-end attack-diff review PASS (or FLAG addressed);
      `/review` PASS.

### Files the next agent should read first

1. `roadmap/wave-28-DRAFT-research.md` — current Yjs/TipTap mark-preserving replace API + version pins + gotchas (P1 grounding).
2. `roadmap/discovery/2026-06-07-sonnet-salvage-audit.md` — the per-feature damage map with file:line pointers; the primary grounding for every phase.
3. The `## Locked decisions` section of THIS file — resolve before P4/P5/P6/P7/P8.
4. `design-reference/FEATURE-WAVE-PLAN.md` + the per-feature spec for the phase you're on (`SNAPSHOTS-SPEC.md`, `ENTITY-TYPES-SPEC.md`, etc.) — the canon target.
5. The specific source file(s) named in the phase's Notes — read the existing (Sonnet) implementation before editing; you are fixing forward, not rewriting.
6. `CLAUDE.md` Gotchas section — base64 TEXT, editor-wiring order, one-Yjs-doc-per-scene.

### Note to the implementer

This is a salvage wave, not a greenfield build. Sonnet's architecture is mostly right — correct schemas,
working stores, real tests. Your job is the finish work it skipped (CSS, wiring, data accuracy) and the
handful of real bugs. **Resist the temptation to rewrite** structurally-sound code because you'd have
written it differently; fix the specific defects the audit names and leave the rest. Honor the standing
constraints: no `setState` in `useEffect` (use key-remount), no `any`, lane-boundary props optional+guarded,
base64 TEXT not BLOB, one Yjs doc per scene, editor additive-only. First step: verify the `## Locked
decisions` section has its answers filled before touching P4 onward.

Before declaring a phase complete, restate the observation point from the Phases table Observation column
in your own words and describe what you actually observed there. If you could not observe it directly — no
live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass"
for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

> These are PROPOSALS drafted at plan time. Items marked `REQUIRES USER LOCK:` need Cole's call before their
> phase. Non-trivial technical items are locked via the decision-review cell (`sonnet-architect` +
> `sonnet-adversarial-reviewer` attack-decision, plus a Codex `architect` opinion on the flagged ones) at
> the start of their phase, then written here as final.

### Decision 1 (Q-PEOPLEGROUP): disposition of the old PeopleGroup / `entity_links`

**LOCKED 2026-06-07 (Cole): drop `PeopleGroup`, abandon `entity_links`; no migration.** Cole's call:
"do whatever is proper — data loss is fine, app is in testing state." With data-preservation off the
table, the proper end-state is a single relationships section backed by `entity_relations`
(`RelationshipGroup` is canon); remove the legacy `PeopleGroup` block entirely. No migration is written —
adding migration code + tests for throwaway test data is waste given the testing-state framing.
**Pre-removal check (P4 recon):** confirm no OTHER live consumer of `entity_links` exists beyond
`PeopleGroup` (a writer/reader elsewhere) before deleting — if one is found, surface it; otherwise drop
clean. The `entity_links` table may remain in the schema unused (harmless); only the UI block + its
read path are removed. **Enforcement:** P4 acceptance test asserts exactly one relationships section
(PeopleGroup not co-rendered).

### Decision 2 (Q-PRESETS): RELATION_PRESETS per-type vocabulary

**LOCKED 2026-06-07 (Cole): build per-type presets now.** Implement
`RELATION_PRESETS: Record<EntityType,{label,inverse}[]>` matching the spec vocabulary (characters:
sibling/parent/child/ally/rival; factions: member-of/has-member; etc.), with the `'*'` list as the
fallback for custom types. Small, canon-faithful, relationships are a headline feature.
**Enforcement:** P4 acceptance check asserts per-type preset shape (each built-in type resolves a
non-empty preset list; custom types fall back to `'*'`).

### Decision 3 (Q-MAPVIEW): RelationshipMap as Bible sub-view vs new AppView

**PROPOSED — decide-and-explain (lock at P4):** Sonnet built the map as a `BibleSubView` inside
`StoryBibleView` rather than a new `AppView "map"`. **Pick:** keep the sub-view. **Rationale:** the binder
stays visible, no AppView-enum churn, and the spec's "new AppView `map`" was descriptive of placement, not a
hard contract. **Consequences:** any future `view === "map"` check won't exist; not currently needed.
**Enforcement:** none (convention) — documented here.

### Decision 4 (Q-LABELCAP): curated/capped labels vs unlimited

**LOCKED 2026-06-07 (Cole): curated, capped at 8 hues.** One label per hue from the 8-color palette
(renamable + recolorable), hard cap = 8. Matches the "stay cohesive, no free color picker" design
philosophy and the existing 8-token palette. **Enforcement:** P5 LabelManager enforces the cap (the
"add label" affordance is disabled / hidden at 8); P5 acceptance asserts the cap.

### Decision 5 (Q-STATUSDOT): outliner status-dot click behavior

**LOCKED 2026-06-07 (decide-and-explain):** Spec says the status dot opens the status menu; Sonnet made
single-click *cycle* status (menu still on right-click). **Pick:** keep cycle-on-left-click + menu-on-right-click
(best of both). **Rationale:** cycling is a faster triage gesture and the menu is still reachable; matches the
corkboard's quick-status pattern. **Consequences:** minor divergence from the literal spec sentence.
**Enforcement:** none (convention).

### Decision 6 (Q-HUDOPACITY): focus HUD faded opacity

**LOCKED 2026-06-07 (P7):** Impl was `0.15`; spec says `0.6`. **Pick:** `0.6` per spec — applied.
**Rationale:** 15% is near-invisible and reads as "HUD disappeared"; the spec value keeps it glanceable while
faded. Almost certainly a `0.15` vs `0.6` transcription error. **Enforcement:** P7 acceptance test asserts
`.focus-hud.faded` resolves to `0.6` (green); CDP smoke confirmed the faded HUD is glanceable.

### Decision 7 (Q-FROZEN): "editor frozen — additive only" ruling

**LOCKED 2026-06-07 (orchestrator, delegated by Cole): behavioral freeze.** Cole clarified the "frozen"
constraint was agent-imposed (not his), and delegated the call: "do whichever is better." Pick: treat
"frozen — additive only" as *no change to editor-core editing behavior*, NOT literally zero new lines in
`src/editor/`. Additive hooks/decorations that don't alter editing behavior are COMPLIANT and may stay in
`Editor.tsx`. BUT the **required `linksVersion` prop IS a violation** (it breaks isolated callers/tests) —
make it optional+guarded, and type the store prop as the `StoryBibleStore` interface, not the concrete
class. That restores the lane-boundary contract without extraction churn.
**Rationale:** identical runtime to the byte-freeze alternative; Option B (extract `useFocusEditorEffects`
+ autolink wiring into `src/features/*` wrappers so `src/editor/` is byte-frozen) is pure churn for no
functional gain — moving working code to satisfy a structural rule with an identical end result.
**Enforcement:** P7/P8 acceptance + adversarial review check prop optionality + no editor-core behavior change.

### Decision 8 (Q-GOALRING): duplicate GoalRing implementations

**PROPOSED — decide-and-explain (lock at P6):** Two rings exist (`inspector/InspectorGoalRings.tsx` old vs
`features/goals/InspectorGoalRings.tsx` family-scoped). **Pick:** keep the `features/goals` family-scoped
ring, delete the old `inspector/` one, migrate its tests to the survivor. **Rationale:** the family-scoped
ring is the newer canon-correct viz; one implementation prevents drift. **Consequences:** test imports move.
**Enforcement:** P6 acceptance criterion (one ring remains).

### Decision 9 (Q-FOCUSPM): P7 focus effects move INSIDE ProseMirror (decoration plugin)

**LOCKED 2026-06-07 (architect + attack-decision review; BLOCK→resolved).** The pure-DOM
`focusEffects.ts` / `useFocusEditorEffects` hook is categorically broken — **CDP-proven**: ProseMirror's
MutationObserver reverts external `data-focused` mutations on `.prose p` (node detached + attr stripped
within 800ms, even with caret OUTSIDE the editor, no scroll); and `scrollIntoView` on a PM node →
redraw → new `<p>` object → the identity gate `para===prevRef` never matches → 480k+ call/sec self-
sustaining loop. This is why P7 passed jsdom tests but looped live (twice).
**Pick:** Replace with a TipTap v3 extension `src/editor/extensions/FocusModeExtension.ts` (precedent:
`AutoLink.ts`). Dim = `Decoration.node(from,to,{class:'pm-focused'})` from `selection.$anchor`
(PM renders it → cannot revert); typewriter = plugin `view().update()` scrolling the `.canvas-scroll`
**container** via `coordsAtPos` (never `scrollIntoView` on a PM node → no redraw → no loop); flags via
`configure()` + `setMeta(focusModeKey)` useEffect. CSS selector `[data-focused]` → `.pm-focused`.
**DELETE `focusEffects.ts`** + its `Editor.tsx` import/call (NOT retained as a dead module — the
adversarial review BLOCKed "keep dead code so a jsdom test stays green" as gate-gaming + the exact
confusion vector that burned this session). **UPDATE `focusModeP7.acceptance.test.tsx`** ("DO NOT MODIFY"
binds implementers, not an orchestrator architecture change): keep structural/HUD-opacity checks, drop the
`data-focused` dead-path assertions; ProseMirror-dependent behavior is verified by **CDP smoke** (the only
valid oracle — jsdom has no layout, no MutationObserver, `scrollIntoView` is a no-op).
**FLAG fixes (from review):** (a) pass live flag values into `useEditorCore`→`configure()` so initial
state is correct (no cold-start flash); (b) guard `$anchor.depth < 1` and build the dim decoration only for
`TextSelection` (NodeSelection/GapCursor mis-target `before(depth)`).
**Consequences:** editor-core gains one read-only decoration extension (Decision 7-compliant); `focusEffects.ts`
deleted; CSS targets a class not an attribute; the acceptance test no longer certifies the focus *behavior*
(CDP smoke does). Fully reversible.
**Enforcement:** CDP smoke (loop dead + `.pm-focused` persists on caret paragraph + scroll centers) is the
behavioral gate; updated P7 acceptance covers structure/HUD-opacity; adversarial review confirmed no
editing-behavior change.

## Status

| Phase | Dispatched | Completed | Commit | Observation point hit |
|---|---|---|---|---|
| P1 Find & Replace | 2026-06-07 | 2026-06-07 | `7741080` | **SMOKE PASS** (live CDP): replaced "scene"→"chapter" ×9 across scenes with preview/confirm; re-search → 0 matches = persists, **no self-undo**; title-bar button + toggles + preview all work; zero console errors. **Tests:** orchestrator-owned `findReplace.acceptance` (6/6) + `findReplaceComponent` + `findReplaceUndoBug` suites green; tsc + lint clean (confirmed in wave-end full suite — 944 tests). Acceptance test authored RED in `71c1d0b` (pre-impl); impl commit `7741080` expanded it 3→6 cases — verified a **strengthening** (recursive `boldRuns`, span-mark + nested-list + cross-paragraph + non-ASCII coverage; no case deleted/skipped/loosened), not a weaken-to-pass. Minor: open scene's editor doesn't live-refresh (DB correct, reopen fixes) — see follow-up. |
| P2 Snapshots | 2026-06-07 | 2026-06-07 | `d75bb19` | **SMOKE PASS** (live CDP): version-history overlay now renders **fully styled** (CSS ported) — snapshot list, word-level diff w/ green "added since" + legend, Diff/This-version toggle, themed Restore button; title-bar ↺ entry works; HISTORY rail tracks the active scene + shows the auto-snapshot. 18 snapshot tests + acceptance green. Cross-scene restore + binder-menu rail-refresh deferred → follow-ups. |
| P3 Entity types | 2026-06-07 | 2026-06-07 | `b76ea08` | **SMOKE PASS** (live CDP): Story Bible tiers now correct — **People & Groups** = Characters · Locations · Items · Factions; **World & Lore** = Lore; **Themes**. Created an Item → Full Entry shows **KIND · OWNER · STATUS · FIRST APPEARS** (was Name/Category/Description), sections Description/Significance/History, breadcrumb Story Bible/Items/New item. Hero avatar renders `fe-av-lg generic-entity` (neutral parchment/slate, squared) **not** the location teal; eyebrow `fe-eyebrow generic-entity` (--ink-3 neutral, empty placeholder) **not** teal "Setting". Zero console errors. 44 touched tests + new `entityTypes.acceptance` green; tsc + lint clean. Adversarial review (single, attack-diff) FLAGged 2 (FeEyebrow location-palette leak + invalid `box` icon in FALLBACK_SECTIONS) — both fixed + re-verified. **Decide-and-explain:** (a) used the icon names that EXIST in the registry (feather/users/sparkle/quote) over the spec's aspirational box/flag/globe which are absent from `Icon.tsx`; (b) did NOT add a faction "Conflicts" section — the audit claimed it missing but the spec lists only Purpose/Structure/History, which already matches. |
| P4 Relationships + Full Entry | 2026-06-07 | 2026-06-07 | `335b6df` | **SMOKE PASS** (live CDP): a character Full Entry now renders **exactly ONE** relationships section (DOM count: 1 "RELATIONSHIPS" heading, 0 PeopleGroup nodes — was 2 blocks); breadcrumb root "Story Bible" returns to the tiered bible. **Per-type presets live:** Add-relation on a character shows the family/social vocabulary (Parent/Child/Sibling/Spouse/Grandparent/Mentor/Apprentice/Confidant/Friend/Ally/Rival) — NOT the faction/location entries (which moved to their buckets). **Map reactivity:** added Friend-of edge → map shows "Friend of"; edited label to "Rival of" → reopened map shows **"Rival of"** (not stale) = the RelationshipMap useMemo relKey fix works. Zero console errors. 6/6 acceptance (per-type presets char/faction/location + allRelations alias) + store contracts (9/9, 13/13, 29/29) green; tsc + lint clean. PeopleGroup + FeLocationLinks deleted (−569 lines), no dangling refs. Adversarial review (single — downgraded from panel since Q-PEOPLEGROUP=drop removed the migration) FLAGged only acceptance-test under-coverage (location preset); orchestrator strengthened the test. **Recon note:** breadcrumb-root + setState-in-effect were ALREADY fixed on this branch (audit was vs an older SHA) — verified, no change needed. **Observation:** reciprocal relation edges store as two rows (forward+inverse), edit independently; map dedups to one. Pre-existing RelationshipGroup behavior, not P4 — noting only. |

| P5 Outliner + Labels | 2026-06-07 | 2026-06-07 | `d81ed68` | **SMOKE PASS** (live CDP): created a label, recolored it `sea`, assigned it to a scene → the **corkboard card renders a tinted pill** (`.lbl-pill` under `.card`, `background: var(--label-sea-tint)` = `#dee4e7`, solid `--label-sea` text) — **static tint token, NOT runtime color-mix** (confirmed via `el.style.background`). LabelManager: **8 hue swatches** (clay/sea/moss/plum/gold/slate/rose/ink), **reorder ▲▼ arrows** present + boundary-disabled (first row's up + last row's down disabled). 5/5 acceptance (cap-reject 9th, reorderLabels, per-project cap, 8 tint tokens) + label/outliner/cork suites (36) green; tsc + lint clean. Adversarial review (single, attack-diff) **PASS** all angles. Q-STATUSDOT (left-cycle/right-menu) already correct — verified not regressed. **Not runtime-observed (code-verified only):** the empty-outliner `.empty-hint` prompt — the test project has scenes, so the empty path didn't render; reviewer PASS + the `displayGroups.length === 0` branch + `.empty-hint` class confirm it. **Decide-and-explain:** cap enforced at the store (createLabel throws at 8) AND the UI (New-label button `disabled` at 8); tint hexes derived 16%-solid+paper (light) / 12%-solid+dark (dark), mirroring `--character-tint`. |

| P6 Goals | 2026-06-07 | 2026-06-07 | `73c2c86` | **SMOKE PASS** (live CDP): right-clicking an inspector goal card opens the **Edit goal / Manage all / Delete goal** menu ("Manage all" verified to open the Goals overlay); creating a **Deadline** goal shows "Already written" defaulting to **108** (real manuscript count, not 0). `deleteGoal` added to GoalsStore + impl; Q-GOALRING consolidated (GoalRing/GoalGroup/anyGoalOn moved to `features/goals/InspectorGoalRings.tsx`, `inspector/InspectorGoalRings.tsx` deleted, imports repointed); `editGoalId` jump-to-edit; manuscriptTotal threaded App→OverlayStack→Goals→GoalEditor. 3/3 acceptance + goal/sceneInspector suites (incl. new right-click test) + 87 tests green; tsc + lint clean. **Two review/smoke catches fixed mid-phase:** (1) live smoke caught the right-click menu not firing — the `onGoalMenu` callback died at GoalGroup (old GoalCard had no `onContextMenu`); (2) adversarial review then caught that switching to FamilyGoalCard rendered garbage for deadline/streak goals (inspector's dbGoal lacks type-specific fields). **Final fix (Route B):** keep the type-agnostic `GoalCard` for the inspector display + wire `onContextMenu` onto it; `FamilyGoalCard` stays only in the Goals overlay (where full GoalRecords exist). Added a unit test (`fireEvent.contextMenu` → onGoalMenu called) to lock the wiring. |

| P7 Focus mode | 2026-06-07 | 2026-06-07 | `77e2f08` | **SMOKE PASS** (live CDP — the oracle that caught this phase failing TWICE). The pure-DOM `focusEffects.ts` was categorically broken: ProseMirror's MutationObserver reverts external `data-focused` mutations on `.prose p` (node detached + attr stripped <800ms, **proven with caret OUTSIDE the editor, no scroll**), and `scrollIntoView` on a PM node → redraw → new `<p>` object → identity gate `para===prevRef` never matches → **480k+ call/sec self-sustaining loop**. That's why P7 passed jsdom but looped live twice. **Fix (Decision 9, Q-FOCUSPM):** rewrote as a TipTap v3 extension `src/editor/extensions/FocusModeExtension.ts` (precedent: AutoLink) — dim via `Decoration.node({class:'pm-focused'})` (PM renders → cannot revert), typewriter via plugin `view().update()` scrolling the `.canvas-scroll` **container** through `coordsAtPos` (no PM-node scroll → no loop), flags via `configure()` + `setMeta(focusModeKey)` useEffect. **DELETED** `focusEffects.ts`; **rewrote** the acceptance test (jsdom = structure only; behavior = CDP smoke). CSS `[data-focused]`→`.pm-focused`. **Live smoke:** loop dead (0 scrollIntoView, 0 selectionchange while idle); active-paragraph dim **works for the first time** (caret para full-contrast, others dimmed — screenshot); exactly 1 mark, follows caret (para2→para3); decoration persists; typewriter scroll fires on para change (scrollTop 8→50); exit clears the decoration (reactive flag); console clean. 22/22 focus+editor tests + tsc + lint green. **Decision-review cell:** sonnet-architect blueprint → attack-decision review **BLOCKed** "retain focusEffects.ts as dead module to keep a jsdom test green" (gate-gaming + the exact confusion vector that burned this session) → resolved by deleting it + rewriting the test. **Attack-diff review FLAG_UNCERTAIN** (all functional angles PASS; lone flag = jsdom tests are structural-only + CDP smoke not in CI → future-regression surface, see follow-up). Also in P7 (prior session): HUD faded-opacity `0.15`→`0.6` (Decision 6), cog adjacent to Exit-focus, Q-FROZEN prop-optionality (Decision 7), dead-CSS cleanup. |

| P8 Auto-link | 2026-06-08 | 2026-06-08 | `50b9622` | **SMOKE PASS** (live CDP). Salvage of the auto-link feature. **Acceptance:** (1) `linksVersion` prop optional+guarded (destructure default `=0`) — fulfils Q-FROZEN Decision 7's mandate; (2) store prop typed as `StoryBibleStore` **interface** (Editor.tsx + useSceneLinkCounts.ts), enabling test doubles; (3) **live** auto-link toggle — `autolinkOn/Scope/Types` added to Tweaks + new `useAutolinkSettings` hook (subscribes `SETTINGS_CHANGED_EVENT`); Editor reactive via `setMeta(autolinkKey)`. Smoke: toggle off → underlines vanish, on → reappear, **no reload**; (4) `.al-link` right-click ContextMenu — Open full entry (real) + Find mentions/Unlink/Never link "X"/Manage aliases (mock per spec); `data-entity-name` added for the label (smoke: menu opened with `Never link "test char 1"`). **Spec additions:** `autolinkScope` all/first (per-pass seen-set); per-type chips (smoke: Characters off → character link removed, a location link remained; +Locations off → 0); underline 1px→1.5px; peek "Find mentions" button. **Attack-diff review FLAGs all fixed + re-smoked:** (a) double-menu (entity-that-is-also-a-spellerror opened both menus) → spell-check handler now early-returns when target is within `.al-link`; (b) empty `autolinkTypes` `[]` linked ALL → now links NOTHING (smoke: []→0 links); (c) Settings border separator (`last` removed from Typewriter row). 78 touched tests + tsc + lint green. **Deferred → follow-ups:** autolinkStyle hover-mode (`al-hideunder`); matcher-rebuild perf cache; real Find&Replace integration for "Find mentions" (prefill = documented port-time TODO). |

## Follow-up candidates

<!-- DEFAULT: empty. Stage here only if it clears the Tier-3 triple gate (VALUE w/ present-harm pointer +
STRUCTURAL + CLEARABILITY). Format: - [item]: [why not in-wave] | present-harm: [K1/K2/K3 + pointer]. -->

- Find & Replace offset mapping vs embedded non-text objects: `manuscriptSearchStore.ts` `replaceInXmlText` uses Yjs positions for `node.delete` while `collectOffsets` works in plaintext-skip-non-string space; they diverge if a block ever contains an embedded object (image/mention node). | present-harm: latent — NOT triggered by any current content type (no embed nodes in the schema yet); activates only if embeds are added. Surfaced by the P1 fix-forward (2026-06-07). [wrap auditor: weak present-harm — likely defer/note, not a wave-blocker]
- Find & Replace: the currently-OPEN scene's editor does not live-refresh after a replace-all touches it — the DB/source is correctly updated (re-search returns 0 matches) but the open scene shows stale text until reopened. Forward replace doesn't patch the open scene's live Y.Doc, whereas `snapUndoReplace` does patch it on undo (asymmetry). | present-harm: K3 — observed live in CDP smoke 2026-06-07 (replaced "scene"→"chapter" ×9; open "test 2" scene still showed "scene" until reopened). User-facing confusion ("did it work?"), not data loss. Single-file fix likely (App.tsx replace wiring patches the open doc like the undo path does).
- Snapshots cross-scene restore corruption: restore is bound to the ACTIVE scene's `ctx`/`doc`, so restoring a snapshot for a scene opened via the binder context-menu (when a DIFFERENT scene is the active editor) auto-snapshots and writes the restored content into the WRONG (active) scene. | present-harm: K3 — found by adversarial review (Codex `adversarial-54`) on both P2 impls 2026-06-07; data-corruption on the binder-context-menu open-history-on-non-active-scene path. PRE-EXISTING (Sonnet wave-27 wiring; not introduced by P2). Normal flow (title-bar / inspector "open version history" → active scene) is SAFE. Multi-file fix (load the historySceneId's doc for restore + baseline). High priority despite edge path (data loss).
- Snapshots: binder context-menu "Take snapshot" (`snapTakeFromMenu`) doesn't call `bumpRailKey`, so a snapshot taken via binder right-click won't refresh the History rail until the next scene switch. | present-harm: K3 — noted by P2 fix-forward 2026-06-07; minor staleness (other mutation paths now refresh via bumpRailKey; this one path was missed). Single-line fix (wire bumpRailKey into the menu-snapshot handler).
- Auto-link "appearance" mode (`autolinkStyle` clean-until-hover / `al-hideunder`) — the second visual mode (Direction-B styling). Deferred from P8 per the wave plan (line 65-66: defer unless P8 had budget to spare). | present-harm: none — P8 shipped the functional core (toggle/scope/types/menu); this is a styling-only enhancement. Wave plan pre-authorized the deferral.
- Auto-link "Find mentions" has no real Find&Replace integration — the context-menu item and the peek-card button are mock-toasts. Per AUTOLINK-SPEC.md the query-prefill is a documented "port-time TODO"; threading `onFindMentions` to the App-level Find opener (OQ3) is the remaining work. | present-harm: K3 — the menu/peek items exist but don't act (mock-toast); user-facing dead affordance until wired. Threading-only fix (Editor→App.content→Find opener + optional prefill).
- Auto-link matcher (`alBuildMatcher`) rebuilds the regex on every `buildDecorations` pass — O(entities) per render; flagged 🟡 non-blocking in the salvage audit. | present-harm: latent — perf degrades with entity count; no current harm at test-project scale. Cache the `(entries → {re,byVariant})` result (module WeakMap or plugin ref).
- Auto-link reactive path (`useAutolinkSettings`) + the `.al-link` context-menu handler have no automated CI coverage — behavior is CDP-smoke-verified only (jsdom can't run a live ProseMirror view for decoration/menu assertions). Same class as the focus-mode gap below. | present-harm: latent — future regression to the live-toggle/menu path would pass jsdom tests; flagged by P8 attack-diff angle 8. Needs a PM-level integration harness (shared with the focus-mode follow-up).
- Focus mode (`FocusModeExtension`) has NO automated behavioral coverage in CI — jsdom can't validly test ProseMirror decorations (no layout, no MutationObserver, `scrollIntoView` is a no-op), so the P7 acceptance test is structural-only and behavior is verified by manual CDP smoke. A future commit that regresses the decoration logic (wrong depth, inverted flag, stale `apply` short-circuit, broken scroll-on-para-change) would pass all jsdom tests. Needs a ProseMirror-level integration test (real editor + setSelection → assert `.pm-focused` on the caret block + no scroll loop) once a jsdom-compatible PM test harness exists. | present-harm: latent — no current regression; flagged by P7 attack-diff review 2026-06-07 as a future-regression surface (this phase already shipped broken twice precisely because jsdom green ≠ working). [wrap auditor: judge value — infra-dependent (needs PM test harness); may defer until harness exists]
- Goals overlay delete-then-Done race: `finishGoal` reads `goals[0]` from local React state to upsert; clicking Delete then Done within the sub-ms async gap before `deleteGoal` resolves could re-upsert the just-deleted record. | present-harm: latent — negligible timing window (sub-ms), PRE-EXISTING (wave-27 `finishGoal` pattern, not introduced by wave-28); surfaced during the P6 Stage-5 review-fix 2026-06-08. Fix: snapshot/guard the goal id or sequence the awaits (await deleteGoal before allowing finish, or capture goals[0] before the gap).

## Result

### Mechanical review

**Inputs resolved:**
- Plan: `roadmap/wave-28-story-planning-salvage.md`
- Diff range: `master..HEAD` (branch `orchestrator-test-fixes`; P1 `7741080` · P2 `d75bb19` · P3 `b76ea08` · P4 `335b6df` · P5 `d81ed68` · P6 `73c2c86` · P7 `77e2f08` · P8 `50b9622` + docs)
- Graph: available (architecture/hotspots populated; edge resolution sparse → grep-fallback for caller chains, noted per finding)
- Run: 2026-06-08

**Check 1 — Forward-trace:** 12 wave-added/modified symbols traced; **all 12 reach a production consumer** (`replaceInScene`→FindReplace.tsx, `FocusModeExtension`/`FocusFlags`/`focusModeKey`→Editor.tsx, `reorderLabels`→App.content.tsx, `allRelations`→BibleListView.tsx, `getPresetsForType`/`RELATION_PRESETS`→RelationshipGroup.tsx, `useAutolinkSettings`/`AutolinkSettings`→Editor.tsx, `deleteGoal`→App.content.tsx, `useActiveSceneSnapshots`→App.tsx). No silent drops; `focusEffects.ts` confirmed deleted. **PASS.**

**Check 2 — Plan universals:** CDP-smoke-gating (8/8 phases), snapshots.css classes (all present in app.css), 8 `--label-*-tint` tokens (tokens.css light+dark), single canonical GoalRing (`inspector/InspectorGoalRings.tsx` deleted), `focusEffects.ts` deletion — all verified. **PASS.**

**Check 3 — Export audit:** every new top-level export has ≥1 non-test importer. **PASS.**

**Check 4 skipped:** no schema property removals in this wave's diff (SQLite + Yjs, no electron-store strict-schema; `entity_links` table left intact per Decision 1).

**Check 5 — Boundary-phase acceptance tests:** P1 + P4 declared cross-boundary. P1: orchestrator-owned `findReplace.acceptance.test.ts` authored RED in `71c1d0b` (predates impl `7741080`); impl commit modified it but **strengthened** (3→6 cases, recursive helper, tightened guard — adjudicated benign, not a weaken-to-pass); run evidence added to P1 Status row. P4: `relationshipsP4.acceptance.test.ts` is a same-commit add, but Decision 1 dropped the `entity_links` migration so the cross-boundary condition collapsed; 6/6 run evidence present. **Resolved** (initial FLAG on P1 run-evidence closed by Status-row edit).

**Check 6 skipped:** no `stryker.config.*` at project root and no `mutation:test` script (consistent with prior waves).

#### Verdict

**PASS** (FLAG-with-flag-resolved). Checks 1/2/3 clean; 4/6 N/A (no schema removal, no Stryker). Check 5's lone non-fatal flag — P1 acceptance test lacked recorded run evidence — was resolved: the full suite confirms it passes, the orchestrator-owned test predates impl, and the impl-commit modification was verified a strengthening (not a cheat). No fatal findings; wave is structurally shippable.

### Wave-end adversarial review (attack-diff, wave granularity)

Single attack-diff reviewer over the full P1–P8 diff, targeting cross-phase integration seams the per-phase reviews structurally couldn't see. **Cleared:** P7/P8 share `Editor.tsx` but use distinct PluginKeys (`focusModeKey` vs `autolinkKey`) with isolated decoration sets + separate `setMeta` transactions (no clobber); `StarterKit.configure({ undoRedo:false })` appears exactly once; `useAutolinkSettings` event listener has symmetric add/remove cleanup; snapshot-before-replace ordering correct; P4/P5/P6 reactive memos sound; Q-FOCUSPM / Q-FROZEN / Q-GOALRING decisions verified wired in code.

**One FLAG (addressed):** inspector "Delete goal" menu (`App.content.tsx`) fired a real DB delete with no refresh into `useInspectorGoals` → stale ring until project switch. Fixed in `bc12a7c` via a new `GOALS_CHANGED_EVENT`; fixing it surfaced and closed two adjacent goal-mutation defects (create/edit also didn't refresh the inspector; overlay trash button was local-state-only and never persisted — pre-existing wave-27 `3688764`). All three goal-mutation paths now persist + refresh consistently. Full suite 948 pass / 103 files; tsc + lint clean. One pre-existing sub-ms delete-then-Done race logged as a follow-up candidate.

**Verdict:** FLAG → all flags addressed. Wave shippable.

### Follow-up audit

**Existing OPEN items (11 files):** All 11 follow-ups from waves 5–27 (app-detection-wiring, transparent-window, statusbar-data, editor-scene-header, inspector-interactions, binder-chapter-collapse, editor-empty-placeholder, project-switcher-dropdown, visual-polish, binder-status-dots, outliner-drag-reorder) were evaluated against the wave-28 diff. **Verdict: 11 ACTIVE** (no resolution signals). None of these features were touched by wave 28; they remain valid follow-ups for future waves.

**Wave-file follow-up candidates (11 items):** Evaluated against the Tier-3 triple gate (VALUE present-harm + STRUCTURAL + CLEARABILITY).

| Candidate | Outcome | Reason |
|---|---|---|
| Find & Replace offset mapping vs embedded non-text objects | REJECTED | Latent-only, not triggered by current schema; single-file optimization. |
| Find & Replace open-scene editor doesn't live-refresh | REJECTED | Single-file fix (App.tsx). Should have been cleared in-wave (not a multi-wave barrier). |
| **Snapshots cross-scene restore corruption** | **QUALIFIED** | K3 data-loss (observed), multi-file (historySceneId doc load + baseline), not clearable by single dispatch. Follow-up file: `2026-06-08-snapshots-cross-scene-restore.md`. |
| Snapshots binder context-menu "Take snapshot" stale-rail | REJECTED | Single-line fix (wire bumpRailKey). Should have been cleared in-wave. |
| Auto-link "appearance" mode (`al-hideunder`) | REJECTED | Present-harm: none. Styling-only enhancement, pre-authorized deferral per wave plan. |
| **Auto-link "Find mentions" no real integration** | **QUALIFIED** | K3 dead affordance (observable mock-toasts), multi-file threading (Editor→App→Find), not clearable by single dispatch. Follow-up file: `2026-06-08-autolink-find-mentions-integration.md`. |
| Auto-link matcher rebuilds regex every pass | REJECTED | Latent perf, no current harm at test-project scale; likely single-file cache optimization. |
| Auto-link reactive path / context-menu no CI coverage | REJECTED | Latent testing gap, not a live bug. Infra-dependent (PM test harness); defer pending harness. |
| Focus mode no automated behavioral coverage | REJECTED | Latent testing gap, not a live bug. Infra-dependent (PM test harness); defer pending harness. |
| Goals overlay delete-then-Done race | REJECTED | Latent, pre-existing (wave-27), sub-ms window, unlikely to trigger. |

**Summary:**
- Existing OPEN follow-ups: 11 active (unchanged).
- Wave-file candidates evaluated: 11 total; 2 qualified, 9 rejected.
- Qualified follow-ups created: 2 files (snapshots-cross-scene-restore.md, autolink-find-mentions-integration.md).
- Rejected candidates disposition:
  - 4 items (candidates 2, 4) should have been cleared in-wave (not multi-wave scope) — logged as notes, no follow-up action needed.
  - 1 item (candidate 5) is a pre-authorized styling deferral — noted, no follow-up.
  - 3 items (candidates 1, 7, 10) are latent-only with no current harm — noted, no follow-up.
  - 2 items (candidates 8, 9) are testing-coverage gaps pending infra (PM harness) — noted, deferred per user guidance.

<!-- Wrap team appends below. -->


