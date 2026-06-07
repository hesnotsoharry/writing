---
project: writing
created: 2026-06-07
kind: discovery / audit
subject: Wave-27 (Sonnet-orchestrated story-planning batch) — salvage audit vs canon design-reference
branch: orchestrator-test-fixes (@89e66c8, = sonnet-orchestrator-test)
---

# Sonnet wave-27 salvage audit

## Why this doc exists

A prior Sonnet-orchestrated session built the 8-feature story-planning wave ("wave-27") on top of
`master`. The build was structurally sound but unfinished and buggy. This doc is the per-feature
damage map produced by 7 parallel static audits (one per feature), comparing each against its canon
spec in `design-reference/`. It is the grounding input for the salvage wave plan.

**Method + limits.** Static code-vs-spec audit. It catches spec divergence, missing pieces, broken
wiring, missing store/schema, and *suspected* runtime breakage. It does **NOT** confirm runtime/visual
behavior — the exact failure class that bit Wave 26 ("green tests, broken render"). **Every fix MUST be
smoke-verified via the CDP tool** (`npm run tauri dev` → `tauri-devtools` MCP) before a phase is done.
See memory `app-can-be-smoked-via-cdp-port`.

## Headline

**All 8 features = SALVAGE (fix-forward), none rebuild.** Sonnet built correct schemas, working stores,
sensible component trees, and real tests, then skipped the finish work. Damage concentrates in four
cross-cutting patterns + a few real logic bugs.

### Cross-cutting patterns (fix these mindsets, not just instances)

1. **CSS porting systematically skipped.** Logic + JSX ported; prototype stylesheets were not. Snapshots
   overlay is fully unstyled; labels/avatars/autolink partially unstyled. #1 reason it "looks butchered."
2. **Entry points not wired into chrome.** Components exist; title-bar buttons to reach Snapshots and Find
   were never added.
3. **Integration-contract names drifted.** `editRelation`→`updateRelationLabel`, `capture`→`takeSnapshot`,
   `listTypes`→`listCustomTypes`, `allRelations` missing. Cosmetic but contracts weren't followed literally.
4. **"Frozen editor" constraint bent twice.** Autolink + focus both modified `src/editor/Editor.tsx`
   (autolink added a *required* prop). Needs a ruling (see Open Questions Q-FROZEN).

### Per-feature scorecard

| # | Feature | Spec met | Verdict | Phase order (user-visible impact) |
|---|---|---|---|---|
| 5a | Find & Replace | ~40% | FIX (heavy) | **P1 — critical: non-functional at runtime** |
| 2 | Snapshots | ~75% | FIX | **P2 — fully invisible (no CSS)** |
| 4 | Entity types | ~55% | FIX | P3 — wrong data, visible on every non-char/loc entry |
| 3 | Relationships + Full Entry | ~72% | FIX | P4 — double section, product decisions needed |
| 3b | Outliner + Labels | ~78% | FIX | P5 |
| 1 | Goals | ~87% | FIX | P6 — most complete |
| 5b | Focus mode | ~75% | FIX | P7 |
| 8 | Auto-link | ~55% | FIX | P8 — most missing UI |

(Phase order is a proposal; finalize in the wave plan.)

---

## Feature 5a — Find & Replace  (~40%, FIX-heavy)

🔴 **CRITICAL — feature is non-functional.** `FindReplace.tsx:175` calls `onUndoReplace?.(touchedIds)`
*immediately* after the replace loop, then `onClose?.()`. `App.tsx:301` wires `onUndoReplace` →
`snapUndoReplace` (`App.snapshots.ts:62-80`), which instantly restores every touched scene from its
pre-replace auto-snapshot. **Replace-all writes the change, then silently self-undoes it.** No Toast.
Fix: remove the immediate call; show a Toast with an Undo button whose onClick fires the restore.

Other fixes:
- **Formatting destroyed on replace.** `manuscriptSearchStore.ts:84-97` `buildDocFromText` rebuilds a
  new Y.Doc from plain text split on `\n` → strips all TipTap marks (bold/italic/links/autolink). Switch
  to in-doc YText surgery (delete+insert at offsets), not full rebuild.
- **Race: in-memory Yjs vs DB.** `replaceInScene` reads/writes `scene_docs` DB; active scene's live Y.Doc
  may overwrite the replaced DB state on next sync. Operate on the live Y.Doc when loaded.
- ❌ Match-case / whole-word toggles missing (`manuscriptSearchStore.ts:44-55` always lowercases).
- ❌ Preview (swap hits to replacement inline, green) missing.
- ❌ Title-bar search button missing (`TitleBar.tsx:68-93`); only the Cmd+Shift+H keybinding reaches it.
- ✅ Correct: overlay shell (portal), chapter→scene grouping + counts, jump-to-scene, snapshot-first
  ordering (`manuscriptSearchStore.ts:197-199`), one-doc-per-scene preserved, editor untouched, Cmd+Shift+H.

## Feature 2 — Snapshots / version history  (~75%, FIX)

🔴 **CSS never ported — UI renders as an unstyled pile.** All snapshot classes (`diff-add`, `diff-del`,
`vh-*`, `snap-*`) return zero hits in `src/styles/app.css` / `src/App.css`; they exist only in
`design-reference/snapshots.css`. Port them.

🔴 **HistoryRail shows wrong/stale scene's snapshots.** `App.tsx:244-250` `useSnapshotState` only fetches
when `showHistory===true`; `historySceneId` is set only when the overlay opens and does NOT update on
scene switch. Rail shows scene A's snapshots for scene B; shows empty until overlay opened once. Fix the
data-load gating + reset on scene change.

Other fixes:
- ❌ Title-bar ↺ entry point missing (`TitleBar.tsx:68-92`); scene context menu entry IS wired (✅).
- ⚠️ "Restoring" view state is a confirm dialog only — no spinner/disable during async restore.
- ⚠️ Store method names differ from contract (`takeSnapshot`/`listSnapshots`/`getSnapshot` vs
  `capture`/`list`/`get`); `restore` moved to app layer (`App.snapshots.ts:48`) — defensible, undocumented.
- LOW: `pruneAuto` uses parameterized `LIMIT $2` in a subquery (`sqliteSnapshotStore.ts:100-106`) — verify
  tauri-plugin-sql/SQLite version tolerates it. `formatWhen` duplicated. `sceneId` prop unused in component.
- File placement oddity: `VersionHistory.tsx` lives under `src/storybible/` with no Story Bible dependency.
- ✅ Correct: base64 TEXT (no BLOB), restore takes safety auto-snapshot first, diff is a pure util, editor
  frozen, comprehensive tests (snapshotStore 13 cases, diffWords 12 cases).

## Feature 4 — Entity types  (~55%, FIX — pure data errors)

Damage is concentrated in two constant files; infra (migration, store, N-column architecture, custom-type
creator) is solid.

- ⚠️ **DEF_FIELDS all wrong** (`src/storybible/fullEntry/defs.ts:22-25`): item/faction/lore/theme field
  labels don't match the spec per-type table (e.g. item should be Kind/Owner/Status/First-appears, got
  Name/Category/Description/First-appears). Visible on every non-char/loc entry.
- ⚠️ **Icons all wrong** (`BibleTypes.tsx:25-30`): spec item=feather faction=users lore=sparkle theme=quote;
  got archive/pin/book/sparkle. (`feather`+`quote` WERE added to Icon.tsx — just misassigned.)
- ⚠️ **Accents wrong**: item should be gold (got clay), theme should be rose (got gold).
- ⚠️ **Tiers wrong**: spec puts Locations + Items in "People & Groups"; Sonnet put both in "World & Lore"
  — pre-existing Locations will jump tiers on upgrade.
- ⚠️ Faction missing the "Conflicts" DEF_SECTION (`defs.ts:54-58`).
- ⚠️ `EntityTypeDef` interface shape diverges from spec (no inline facts/sections/seedKey; split into defs.ts).
- 🟡 Runtime: `.avatar.generic-entity` CSS rule absent → new-type rows render unstyled (`EntityRow.tsx:17,75`);
  full-entry avatar falls back to `type="location"` palette for new types (`FeTopbarHero.tsx:78,86`).
- 🟡 `createCustomType` hardcodes empty `fields_json`/`sections_json` (`sqliteEntityTypeStore.ts:48-52`) →
  custom types always get fallback fields/sections. `deleteCustomType` orphans entity rows (no cascade).
- ✅ Correct: EntityType widened to string, N-type collapsible columns, custom-type creator modal,
  detection.ts type-agnostic, char/location untouched, migration schema.

## Feature 3 — Relationships + Full Entry  (~72% / ~78%, FIX)

🔴 **Double relationship section.** `FullEntry.tsx:108-117` renders BOTH the old `PeopleGroup` (reads
`entity_links`) AND the new `RelationshipGroup` (reads `entity_relations`) for character/location entities
— two unrelated relationship blocks from two tables. Spec says *upgrade* the existing group. → product
decision Q-PEOPLEGROUP.
- ❌ Breadcrumb root not clickable (`FeTopbarHero.tsx:36-40` static text; `onExit` available but unwired).
- ⚠️ `setState`-in-effect violation (`App.entryView.tsx:105-107` resets `setEntityOverride(null)` on
  `top?.id` change) — redundant: `key={top?.id}` at :117 already remounts. Remove the effect.
- ⚠️ RELATION_PRESETS only has a `'*'` catch-all (`storyBibleStore.ts:128-144`); no per-type vocab. →
  product decision Q-PRESETS.
- ⚠️ Map is a `BibleSubView` inside StoryBibleView, not a new `AppView "map"` (spec said AppView). Sub-view
  is arguably cleaner (binder stays visible). → confirm acceptable.
- ⚠️ RelationshipMap `useMemo` deps `[entities.length, relations.length]` (`BibleListView.tsx:185,191`) go
  stale on label edits (length unchanged). EgoGraph already guards with a label hash — copy that.
- ⚠️ Naming: `editRelation`→`updateRelationLabel`; `allRelations()` absent (map uses `listRelations(projectId)`).
- ⚠️ Reciprocal is auto-applied (no opt-out toggle); RelationRow uses click-popover + X, not right-click.
- LOW: `useRelationGroup` + `useRelations` double-fetch identical data; EgoGraph runs 200 d3 ticks
  synchronously in render (perf risk at 30+ peers).
- ✅ Correct: entity_relations schema + UNIQUE + indexes, addRelation dedup + reciprocal cross-link,
  deleteRelation cascades reciprocal (tested), deleteEntity cascades relations (tested), EgoGraph render,
  RelationshipMap force layout, FullEntry split layout + nav stack + origin-aware root label.

## Feature 3b — Outliner + Labels  (~78%, FIX)

- ❌ **LabelBadges absent on corkboard cards** (`CorkCard.tsx` no import); spec says badges on cards AND rows.
- ⚠️ **`--label-*-tint` tokens missing** (`tokens.css:67-74` has solids only); `LabelBadges.tsx:13` works
  around with runtime `color-mix()`. Add the 8 tint vars mirroring `--character-tint`.
- ❌ `reorderLabels(ids)` store method missing (interface + both impls); LabelManager has no reorder UI.
- ❌ Empty-outliner quiet prompt missing (`OutlinerBody` renders nothing when no rows).
- ⚠️ Status-dot single-click cycles status; spec says it opens the status context menu (menu IS on
  right-click). → minor UX confirm.
- ⚠️ Right-click row menu is a curated subset (Open/Rename/Status/Labels); spec says full `buildSceneMenu`
  equivalent (missing Delete/Archive/Export). Test asserts the subset intentionally.
- ⚠️ `onRename` dropped the `kind` param vs contract; functional.
- 🟡 Runtime: `contentEditable` synopsis (`Outliner.tsx:183-188`) may clobber in-progress edits on
  re-render (no focused-guard); `new SqliteBinderStore()` per handler call (`App.content.viewstage.tsx:93-114`)
  bypasses the app store singleton.
- Drag-to-reorder correctly DEFERRED (follow-up `roadmap/follow-ups/2026-06-05-27-outliner-drag-reorder.md`).
- ✅ Correct: `outline` AppView, segmented toggle, chapter-preserving sort w/ asc→desc→manual cycle,
  inline title/synopsis edit, many-to-many labels, token-name color storage, LabelManager (no free picker),
  schema (migrations 010+011), no `any`, guarded optional handlers.

## Feature 1 — Goals  (~87%, FIX — most complete)

- ❌ **Inspector right-click context menu unimplemented** end-to-end (no menu component, no `openGoalMenu`,
  `onContextMenu` slot exists on `FamilyGoalCard` but never wired). Worse: `InspectorGoalRings.tsx:133`
  renders `title="Right-click to edit or remove"` → tooltip promises a dead feature.
- ⚠️ Overlay can't jump to a specific goal's edit screen (`Goals.tsx:296-298` takes scope only, always opens
  list mode); the right-click "Edit" entry point depends on this.
- 🟡 `projectWords={0}` hardcoded (`Goals.tsx:419`) → deadline/project goal defaults always wrong (finish
  line defaults 80k, already-written 0). Thread real manuscript word count through.
- 🟡 Duplicate `GoalRing` impls (`inspector/InspectorGoalRings.tsx:18-36` vs
  `features/goals/InspectorGoalRings.tsx`); tests cover only the old one. Decide which is canon.
- 🟡 `readStreak()` called synchronously in render (`Goals.tsx:310`) — stale if streak changes while open.
- ✅ Correct: full GoalRecord model, 3 families (amount/deadline/streak), 6 types, adaptive editors,
  calendar heat-map (no native date input), pace bar, streak viz, status-bar mini, localStorage+SQLite
  persistence, semantic pace pills via color-mix, goals table DDL.

## Feature 5b — Focus mode  (~75%, FIX)

- ⚠️ **HUD faded opacity is 15% (`app.css:853` `opacity:0.15`), spec says 60%** — near-invisible. Likely a
  0.15-vs-0.6 typo. Fix to spec unless intentional (Q-HUDOPACITY).
- ⚠️ **Editor-core touched**: `useFocusEditorEffects` (29 lines) added inside `src/editor/Editor.tsx:144-195`.
  DOM-decoration only, no Yjs mutation — honors spirit, violates letter of frozen-editor. → Q-FROZEN.
- 🟡 Dim-on-enter cold start: all paragraphs dim with none highlighted until first `selectionchange`
  (`useFocusEditorEffects`). Dispatch an initial dim-focus on mount.
- ⚠️ Settings cog placement: spec wants cog by "Exit focus"; impl puts it in the HUD (not adjacent).
- 🟡 `scroll-padding` + `scrollIntoView({block:"center"})` may double-center — visual confirm in WebView2.
- ✅ Correct: dim-but-current-paragraph, typewriter scroll (cursor-centred, reduced-motion aware), fading
  HUD w/ word count + goal ring + streak + timer, localStorage-only (no schema), 4 settings toggles,
  HUD gated on focusMode.

## Feature 8 — Auto-link  (~55%, FIX — most missing UI)

- ❌ Entire settings UI missing (toggle / appearance / scope / per-type chips) — spec requires a panel.
- ❌ Right-click context menu on `.al-link` missing (Open / Find mentions / Unlink here / Never link /
  Manage aliases).
- ❌ "Find mentions" button in peek card missing (`AutoLinkPeek.tsx:127-132` has only "Open entry").
- ❌ `autolinkScope` ("all" vs "first mention") not implemented (`AutoLink.ts:36-40`); always decorates all.
- ❌ `autolinkStyle` ("hover"/`al-hideunder` clean-until-hover) not implemented.
- ⚠️ Underline 1px, spec says 1.5px (`app.css:1253`).
- ⚠️ `autolinkOn` read once at mount, not in dep array (`Editor.tsx:103,127`) — toggle won't take effect
  without remount (matters once settings UI exists).
- ⚠️ **Editor-core touched**: added `AutoLink.ts` extension (fine) but modified `Editor.tsx` and added a
  *required* `linksVersion` prop + typed `storyBibleStore` as concrete `SqliteStoryBibleStore` →
  isolated Editor unit tests likely broken. → Q-FROZEN.
- 🟡 Double matcher rebuild per decoration pass (`AutoLink.ts:93-97`, no regex cache) — perf at 200+ entities.
- ✅ Correct: read-only ProseMirror decoration (no doc mutation, no schema change), index build, case-aware
  whole-word + possessive matching, longest-variant-first, stop-words, "The"-strip alias, 300ms debounce,
  reload on linksVersion, 230ms hover intent, viewport-clamped peek that flips above, per-type avatar color.

---

## Open product-intent questions (resolve during planning, per phase)

- **Q-PEOPLEGROUP** (P4): Remove the old `PeopleGroup`/`entity_links` entirely (migrate or drop that data?),
  or keep both sections? Spec says "upgrade the existing group."
- **Q-PRESETS** (P4): Build per-type RELATION_PRESETS vocab (sibling/parent for characters, member-of for
  factions) now, or accept the `'*'` catch-all for this wave?
- **Q-MAPVIEW** (P4): Accept Map as a Bible sub-view (binder stays visible), or force a true `AppView "map"`?
- **Q-LABELCAP** (P5): Curated/capped label count (FEATURE-WAVE-PLAN) vs unlimited createLabel (OUTLINER-SPEC) —
  docs disagree; which is canon?
- **Q-STATUSDOT** (P5): Outliner status-dot click — cycle status (Sonnet) vs open menu (spec)?
- **Q-HUDOPACITY** (P7): 15% (impl) vs 60% (spec) — typo or intentional?
- **Q-FROZEN** (P7/P8): Are additive in-`Editor.tsx` changes (focus effects, autolink prop) acceptable under
  "editor frozen — additive only", or must they be extracted to wrappers in `src/features/`? The required
  `linksVersion` prop is the sharpest case (breaks isolated Editor tests).
- **Q-GOALRING** (P6): Two `GoalRing` implementations — which is canon; delete the other?

## Audit provenance

7 `sonnet-explorer` audits, 2026-06-07, against branch @89e66c8. Agent IDs (for deep follow-up via
SendMessage): Goals a27653edefbe24725 · Snapshots a894522817a93d826 · Outliner ae1a6dd62f796f7f1 ·
Relationships a0a803c83c5820dd1 · Entity-types aed2e21f6ca53e1c8 · Find&Focus a801b061cb93a5d4c ·
Auto-link a90391b6d6ad4ec47.
