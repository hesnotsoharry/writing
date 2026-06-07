---
status: PLANNED
created: 2026-06-07
---

# Wave 28 — DRAFT TITLE

## Plan

### Status

DRAFT · target v0.2.1 (fix-sweep, patch) · drafted 2026-06-07.

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

**REQUIRES USER LOCK:** The Full Entry currently renders BOTH the old `PeopleGroup` (reads `entity_links`)
and the new `RelationshipGroup` (reads `entity_relations`) → two relationship blocks. Canon says *upgrade*
the existing group to one.
- **Industry-standard (recommended):** migrate existing `entity_links` rows into `entity_relations` (one
  forward edge each, generic label like "related"), then remove `PeopleGroup` so there's a single typed
  relationships section. Preserves user data; one source of truth.
- **Emerging:** keep both temporarily behind a flag, migrate later. (More code, defers the cleanup.)
- **Cutting-edge / cheapest:** drop `PeopleGroup` and abandon `entity_links` data. (Data loss — only OK if
  `entity_links` was never populated in real use.)
**Recommendation:** migrate-then-remove, unless you confirm `entity_links` has no real user data, in which
case the cheap drop is fine. **Enforcement:** P4 acceptance test asserts single section; migration tested.

### Decision 2 (Q-PRESETS): RELATION_PRESETS per-type vocabulary

**REQUIRES USER LOCK:** Presets currently have only a `'*'` catch-all (no per-type vocab). Canon shows
per-type lists (characters: sibling/parent/child/ally/rival; factions: member-of/has-member).
- **Recommendation (industry-standard):** build the per-type `RELATION_PRESETS: Record<EntityType,{label,inverse}[]>`
  now — it's small, it's the spec intent, and relationships are a headline feature. Accept the `'*'` list as a
  fallback for custom types.
- **Alternative:** ship `'*'` only this wave, defer per-type to a follow-up (faster, less canon-faithful).
**Enforcement:** P4 acceptance check on preset shape per type. Defer-fallback acceptable if you want P4 lean.

### Decision 3 (Q-MAPVIEW): RelationshipMap as Bible sub-view vs new AppView

**PROPOSED — decide-and-explain (lock at P4):** Sonnet built the map as a `BibleSubView` inside
`StoryBibleView` rather than a new `AppView "map"`. **Pick:** keep the sub-view. **Rationale:** the binder
stays visible, no AppView-enum churn, and the spec's "new AppView `map`" was descriptive of placement, not a
hard contract. **Consequences:** any future `view === "map"` check won't exist; not currently needed.
**Enforcement:** none (convention) — documented here.

### Decision 4 (Q-LABELCAP): curated/capped labels vs unlimited

**REQUIRES USER LOCK:** `FEATURE-WAVE-PLAN.md` says "curated count, not infinite labels"; `OUTLINER-SPEC.md`
says "adds labels" (open-ended). The two canon docs disagree.
- **Recommendation:** curated/capped to the 8-hue palette (one label per hue, renamable, recolorable) —
  matches the "stay cohesive, no free picker" design philosophy and the 8-token palette. Cap = 8.
- **Alternative:** unlimited labels reusing palette colors (more flexible, less cohesive).
**Enforcement:** P5 LabelManager enforces the cap (or not) per your call.

### Decision 5 (Q-STATUSDOT): outliner status-dot click behavior

**PROPOSED — decide-and-explain (lock at P5):** Spec says the status dot opens the status menu; Sonnet made
single-click *cycle* status (menu still on right-click). **Pick:** keep cycle-on-left-click + menu-on-right-click
(best of both). **Rationale:** cycling is a faster triage gesture and the menu is still reachable; matches the
corkboard's quick-status pattern. **Consequences:** minor divergence from the literal spec sentence.
**Enforcement:** none (convention).

### Decision 6 (Q-HUDOPACITY): focus HUD faded opacity

**PROPOSED — decide-and-explain (lock at P7):** Impl is `0.15`; spec says `0.6`. **Pick:** `0.6` per spec.
**Rationale:** 15% is near-invisible and reads as "HUD disappeared"; the spec value keeps it glanceable while
faded. Almost certainly a `0.15` vs `0.6` transcription error. **Enforcement:** P7 acceptance criterion.

### Decision 7 (Q-FROZEN): "editor frozen — additive only" ruling

**REQUIRES USER LOCK:** This is Cole's constraint, so the ruling is his. Two features touched
`src/editor/Editor.tsx` (focus effects; autolink added a *required* `linksVersion` prop).
- **Recommendation:** treat "frozen — additive only" as *no change to editor-core behavior*, NOT literally
  zero new lines in `src/editor/`. So: additive hooks/decorations that don't alter editing behavior are
  COMPLIANT and may stay in `Editor.tsx`. BUT the **required `linksVersion` prop IS a violation** (it breaks
  isolated callers/tests) — make it optional+guarded, and type the store prop as the `StoryBibleStore`
  interface, not the concrete class. That restores the lane-boundary contract without an extraction churn.
- **Stricter alternative:** extract `useFocusEditorEffects` + autolink wiring into `src/features/*` wrappers
  so `src/editor/` is byte-frozen. (More churn, marginal functional gain.)
**Enforcement:** P7/P8 review checks prop optionality + no editor-core behavior change.

### Decision 8 (Q-GOALRING): duplicate GoalRing implementations

**PROPOSED — decide-and-explain (lock at P6):** Two rings exist (`inspector/InspectorGoalRings.tsx` old vs
`features/goals/InspectorGoalRings.tsx` family-scoped). **Pick:** keep the `features/goals` family-scoped
ring, delete the old `inspector/` one, migrate its tests to the survivor. **Rationale:** the family-scoped
ring is the newer canon-correct viz; one implementation prevents drift. **Consequences:** test imports move.
**Enforcement:** P6 acceptance criterion (one ring remains).

## Status

<!-- Per-phase rows added as work progresses: Phase | Dispatched | Completed | Commit SHA | Observation point hit -->

## Follow-up candidates

<!-- DEFAULT: empty. Stage here only if it clears the Tier-3 triple gate (VALUE w/ present-harm pointer +
STRUCTURAL + CLEARABILITY). Format: - [item]: [why not in-wave] | present-harm: [K1/K2/K3 + pointer]. -->

## Result

<!-- Filled at ship by wrap team. -->
