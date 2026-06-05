---
status: PLANNED
created: 2026-06-04
---

# Wave 26 — DRAFT TITLE

## Plan

### Status

DRAFT · target v0.5.1 · drafted 2026-06-04.

### Goal

After this wave the issues Cole's first live `tauri dev` smoke surfaced are fixed against the running app,
not just against unit tests. The corkboard, story bible, and full-entry views render with their side
panels actually gone (not blank shells); the bottom status bar and the manuscript-dropdown subtitle show
the true whole-manuscript word total (constant across scene switches) and every binder scene row shows its
own non-zero word count; quick-notes is pinned to the bottom of the left panel and the empty-chapter /
empty-short-pieces hint has no blank gap; corkboard cards drag-and-drop to a new order that holds on
release and mirrors to the binder; the editor right-click menu and the Export modal are app-canon styled;
the inspector synopsis edit box is clay (not black) and clicking a linked entity opens its full entry; the
story-bible cards are canon (white "Character/Location Sketch", right-click-only menu, editable+linked
role); and the full-entry "+ Add field" / detail-box editing / entity-link flows actually work. Goals and
backup are deliberately untouched (separate waves).

### Scope

**In scope:**

- **Phase 1 — Blank-panel layout (`src/App.content.tsx`, `src/App.entryView.tsx`):** corkboard / story
  bible / full-entry must render with NO left or right panel — the slots must be absent, not empty shells.
- **Phase 2 — Word-count data (`src/lib/manuscriptWords.ts`, `src/shell/StatusBar.tsx`,
  `src/binder/ProjectSwitcher.tsx`, `src/binder/BinderCrud.tsx`):** status-bar + subtitle show the real
  whole-manuscript total (constant across scenes); per-scene `.scene-words` shows each scene's real count
  (not 0). Diagnose the runtime data feed.
- **Phase 3 — Binder polish (`src/binder/*`):** quick-notes footer pinned to the panel bottom; remove the
  blank gap above the "No scenes yet — add one" hint (chapters + short pieces).
- **Phase 4 — Corkboard DnD (`src/features/corkboard/*`):** drag-reorder holds on release + persists +
  mirrors to the binder, modeled on the binder's working `@dnd-kit` drag. Diagnose the snap-back.
- **Phase 5 — Inspector (`src/inspector/*`):** synopsis edit box clay-themed (not black); clicking a
  linked character/location chip opens that entity's full entry (existing-link click → `openEntry`).
- **Phase 6 — Menu/modal canon styling (`src/editor/*`, `src/features/export/*`):** theme the editor
  right-click menu to the app's `ContextMenu`; restyle the Export modal to `design-reference/dialogs.jsx`.
- **Phase 7 — Story-bible cards + role (`src/storybible/*`, `src/storybible/fullEntry/*`,
  `src/db/storyBibleStore.ts`):** white sketch area labeled "Character Sketch" / "Location Sketch";
  interaction via right-click only (Edit name / Edit role / Edit sketch / Open full entry / Delete);
  the role field becomes editable + linked between the card row and the full-entry eyebrow.
- **Phase 8 — Full-entry detail fields + links (`src/storybible/fullEntry/*`):** "+ Add field" adds two
  editable detail-box rows (editable title + body); the default 4 boxes are editable; fix the edit-box
  overlapping the box title; wire the link controls so character→scene, character→location, and
  location→scene links are created and shown.
- **Phase 9 — Trivial (`src-tauri/src/lib.rs`):** silence the `unused variable: app` warning in `open_path`.

**Out of scope:**

- **Goals** — all goal work (management UI, cross-scene persistence, scope dropdown) deferred to a
  dedicated goals wave pending Cole's designer (tracked: goals-redesign follow-up).
- **Backup** — the Settings "Backup & data" section (no completion confirmation, hardcoded "2 min ago")
  is deferred to the targeted backup wave (with the R2 infra); referenced as known issues only.
- **Export rich-text + native Save-As** — deferred follow-up (#25); this wave only canon-styles the
  Export modal, it does not change export output or the save path (blob fallback stays).
- **DB migrations** — prefer reusing Lane 24's `entity_fields` (reserved key for role) over a new column;
  no new migration this wave (Decision 2).

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Blank-panel layout (cork/bible/entry) | sonnet-implementer | trophy · internal-only · reviewTier single. **Diagnose-first**: the panel slots render empty shells when showSidePanels=false instead of being absent. One root cause across 3 views. Make the slot render null. Canon: full-bleed views. | Opening Corkboard, Story Bible, or a full entry shows no left/right side panels at all — the view is full-bleed with no empty panel shells. |
| 2 | Word-count data: manuscript total + per-scene | sonnet-implementer | pyramid+trophy · internal-only · reviewTier single. **Diagnose-first**: status bar + subtitle show current-scene count not the manuscript sum; per-scene rows show 0. Trace useManuscriptWordCount feed + the scene word_count source at runtime. | The status bar and the manuscript-dropdown subtitle both read the whole-manuscript total and stay constant when you switch scenes; each binder scene row shows its own non-zero word count. |
| 3 | Binder polish: quick-notes pin + empty-state gap | sonnet-implementer | trophy · internal-only · reviewTier single. Pin .binder-foot to panel bottom; remove the blank gap above the empty-state "add one" hint (chapters + short pieces). Canon: `binder.jsx`. | The quick-notes button sits pinned at the bottom of the left panel, and a new/empty chapter (and empty short-pieces) shows the "No scenes yet — add one" line with no blank gap above it. |
| 4 | Corkboard drag-reorder | sonnet-implementer | trophy · internal-only · reviewTier single. **Diagnose-first**: drag previews then snaps back on release (no persist). Model on the binder's working @dnd-kit sortable; persist via the existing reorder path + reloadTree. Canon: binder DnD. | Dragging a corkboard card to a new position holds on release (no snap-back), the new order persists, and the same order appears in the binder's left panel in writing view. |
| 5 | Inspector: synopsis box + linked-entity open | sonnet-implementer | trophy · internal-only · reviewTier single. Synopsis edit textarea → clay token (not black); the existing-link chip click fires onOpenEntry→openEntry (not only the create path). Canon: `inspector.jsx`. | Typing in the inspector synopsis shows a clay edit box (not black); clicking a linked character/location chip opens that entity's full entry with a back-to-writing nav. |
| 6 | Canon-style editor menu + Export modal | sonnet-implementer | trophy · internal-only · reviewTier single. Route the editor right-click menu through the app ContextMenu styling; restyle ExportOverlay to `design-reference/dialogs.jsx`. Styling only — export logic unchanged. | Right-clicking the editor shows an app-themed context menu matching the app's other menus, and the Export modal renders in the canon sheet style. |
| 7 | Story-bible cards + editable linked role | sonnet-implementer | trophy · internal-only · reviewTier single. White sketch ("Character/Location Sketch" label); right-click-only menu (Edit name/role/sketch / Open full entry / Delete); role becomes editable + linked card↔full-entry eyebrow (stored as a reserved entity_field key — Decision 2, no migration). Canon: `views.jsx`, `menu.jsx`, `full-entry.jsx`. | A story-bible card shows a white sketch area labeled "Character Sketch"/"Location Sketch"; right-clicking shows Edit name / Edit role / Edit sketch / Open full entry / Delete; editing the role updates it on both the card row and the full-entry eyebrow. |
| 8 | Full-entry detail fields + entity links | sonnet-implementer | trophy · internal-only · reviewTier single (may escalate). "+ Add field" adds an editable detail box (editable title + body) via entity_fields — ONE box per click, both parts editable (Cole 2026-06-04, clarifying the earlier "two boxes" wording: SPEC models one entity_fields row per field); default 4 editable; fix edit-box overlapping the title; wire char→scene, char→location, location→scene link controls (entity_links + replaceSceneLinks). Canon: `full-entry.jsx`, FULL-ENTRY-SPEC §8. | On a full entry, clicking "+ Add field" adds an editable detail box (editable title + body), the default 4 boxes are editable, a saved box no longer overlaps its title, and the link controls add a character→scene, character→location, and location→scene link that then shows in the entry (incl. the linked character on the location's "Characters here"). |
| 9 | Trivial: Rust unused-var warning | haiku-implementer | trophy · internal-only · reviewTier skip. Prefix `_app` (or use it) in `open_path` at src-tauri/src/lib.rs:12. | The `tauri dev` / `cargo` build output no longer prints the "unused variable: app" warning. |

### Acceptance criteria

- [ ] In `view==="cork"`, `"bible"`, and the full-entry view, neither the binder panel nor the inspector panel element is mounted (no empty panel shell in the DOM).
- [ ] `StatusBar` manuscript total equals the sum of all scenes' word counts and does not change when the selected scene changes (verified across ≥2 scenes); the `ProjectSwitcher` subtitle shows the same total.
- [ ] Every binder scene row renders its own `word_count` (a scene with prose shows a non-zero count, not 0).
- [ ] The `.binder-foot` quick-notes control is rendered at the bottom of the binder panel (flex bottom-anchored); the empty-state "add one" hint renders with no empty spacer element above it, for chapters and short pieces.
- [ ] A corkboard drag-drop updates the rendered card order and persists via the existing scene-reorder store path; after the drop the binder tree reflects the same order (no snap-back).
- [ ] The inspector synopsis edit `<textarea>` uses the clay token background (not black/default); clicking a linked entity chip calls `onOpenEntry` → opens that entity's full entry.
- [ ] The editor right-click menu renders with the app `ContextMenu` classes/tokens; the Export overlay markup matches the canon `dialogs.jsx` sheet structure.
- [ ] Story-bible cards render a white sketch area labeled "Character Sketch" (characters) / "Location Sketch" (locations); the card has no click-to-edit handlers — interaction is via a right-click menu with Edit name / Edit role / Edit sketch / Open full entry / Delete.
- [ ] The role field is editable from the card row and from the full-entry eyebrow, and edits in one surface are reflected in the other (single stored value).
- [ ] On a full entry, "+ Add field" appends an editable detail box (editable title + body — ONE box per click; Cole 2026-06-04) persisted via `entity_fields`; the 4 default boxes are editable; the edit affordance does not visually overlap the box title.
- [ ] Full-entry link controls create a character→scene link, a character→location link (`entity_links`), and a location→scene link, and the new link appears in the entry.
- [ ] `cargo`/`tauri` build emits no `unused variable: app` warning.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the full `npm run test` suite pass at wave end.

### Files the next agent should read first

1. `roadmap/wave-26-canon-bugfix.md` `## Locked decisions` — the decisions governing this wave.
2. `roadmap/wave-25-canon-cleanup.md` `## Status` rows — what the prior wave's per-phase fixes did (several of those are the ones that tested green but broke at runtime; this wave re-diagnoses them).
3. `design-reference/` canon for the active phase: `views.jsx` (cards/cork/bible), `full-entry.jsx` + `full-entry.css` + `FULL-ENTRY-SPEC.md` §8 (detail fields + link flows), `dialogs.jsx` (export modal), `menu.jsx` (context menus), `binder.jsx` (binder), `app.css`/`tokens.css` (clay tokens, layout).
4. `src/App.content.tsx` + `src/App.entryView.tsx` — the view-stage builder + `showSidePanels` logic (Phase 1 root cause) + the FullEntry mount.
5. `src/lib/manuscriptWords.ts` (`useManuscriptWordCount`) + `src/shell/StatusBar.tsx` + `src/binder/ProjectSwitcher.tsx`/`BinderCrud.tsx` — the word-count feed (Phase 2).
6. `src/binder/BinderCrud.tsx` + `Binder.tsx` — the working binder `@dnd-kit` drag pattern to model the corkboard fix on (Phase 4).
7. `src/db/storyBibleStore.ts` — `entity_fields` / `entity_links` / `getEntity` + the additive methods (Phases 7–8); `src/storybible/fullEntry/*` (FullEntry view).

### Note to the implementer

This wave fixes what Cole's live smoke surfaced — and several items "passed tests" in Wave 25 yet broke in the running app (blank panels, manuscript total, scene word count, corkboard DnD). So for the diagnose-first phases (1, 2, 4), find the actual RUNTIME root cause before touching code — do not re-apply the prior wiring that already tested green. Resist scope creep into goals or backup (both are deliberately deferred to their own waves) and into Export's output/save path (only the modal styling is in scope). Prefer reusing Lane 24's `entity_fields` over new migrations. First step: verify the `## Locked decisions` section below has decisions filled in.

Before declaring a phase complete, restate the observation point from the Phases table Observation column
in your own words and describe what you actually observed there. If you could not observe it directly — no
live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass"
for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

**Decision 1 — Goals + backup are out of scope (LOCKED, Cole 2026-06-04).**
Context: smoke surfaced deep goal-management gaps + a non-functional backup section; both need dedicated work.
Pick: Wave 26 fixes everything else; goals wait on Cole's designer (goals-redesign wave), backup waits on the R2 infra (backup wave). The inspector goal rings + Settings backup section are left as-is this wave.
Consequences: no goal-model or backup changes in this wave; the deferred waves own them.
Enforcement: none (convention) — scope decision recorded by Cole.

**Decision 2 — Role + custom detail fields reuse Lane 24's `entity_fields`; no new migration.** `durable: candidate`
Context: the character/location "role" and the "+ Add field" detail boxes need persistence; Lane 24 already shipped the generic `entity_fields(entity_id, key, value, sort)` table + methods.
Pick: store the role as a reserved `entity_fields` key (e.g. `key="role"`) and the detail boxes as ordinary `entity_fields` rows — NO new column, NO new migration this wave.
Rationale: avoids a migration (and the migration-test-breakage gotcha), reuses tested infrastructure, and the role is conceptually just a pinned field.
Consequences: role + detail boxes are all `entity_fields` rows; the UI distinguishes the reserved role key + the 4 defaults from user-added ones.
Enforcement: advisory-only (Phase 7/8 reviewer checks no migration was added).

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point |
|---|---|---|---|---|
| 1 | 2026-06-04 | 2026-06-04 | ee1aeab | Cannot observe directly (no Tauri runtime in this context). Root cause confirmed from code: AppShell.tsx rendered `.panel-binder` and `.panel-inspector` wrapper divs unconditionally regardless of slot content. Fix: wrappers now elided when slot is null. Render-level tests added to appShell.slots.contract.test.tsx asserting the DOM element is absent. Cole re-smokes to confirm full-bleed at runtime. |
| 2 | 2026-06-04 | 2026-06-04 | bbca8cf | Cannot observe directly. Scene `word_count` now persisted on save + backfilled on project load from `scene_docs.plaintext_projection`; status-bar + subtitle read the manuscript sum (constant across scenes), per-scene rows show real counts. |
| 3 | 2026-06-04 | 2026-06-04 | 4d526e9 | Cannot observe directly (no Tauri runtime). `.binder-foot` bottom-pinned via flex-column (scroll flex:1 between flex:none switcher+footer). Empty-state gap removed by collapsing the empty `SortableSceneList` to minHeight:0 while keeping the dnd-kit drop target mounted (adversarial review caught + fixed a drop-target unmount race in the first pass); hints aligned to 28px. lint+tsc clean, 51/51 binder tests. Cole smokes the footer pin + empty-chapter gap + drag-into-empty-chapter. |
| 4 | 2026-06-04 | 2026-06-04 | 4cb99db | Cannot observe directly. Diagnosed (refuting the plan's first guess): persist was already wired; snap-back came from `onDragEnd` clearing optimistic `liveIds` synchronously before the async write+reload landed. Fix: hold `liveIds` on success; render-phase guard clears it only when committed `ids` MATCHES the held order (server caught up) — robust vs error-path reload. Attack-hypothesis + attack-diff reviews both ran; diff review BLOCKED on vacuous tests → replaced with a full-drag-cycle test, orchestrator teeth-verified it goes RED on revert. lint+tsc clean, 15/15 corkboard + 51/51 binder. Cole smokes drag-hold + persist + binder mirror. |
| 5 | 2026-06-04 | 2026-06-04 | 00e5f1f | Cannot observe directly. Synopsis textarea bg → `var(--parchment-deep)` (the token's own role is "recessed wells" — correct for an edit field; plan's "clay" was loose phrasing). Existing linked-entity card click → `onOpenEntry(id,type)` (same App adapter the create path uses); `handleCreate`→`useEntityCreate` hook (behavior-preserving, lint cap). Review FLAG on token + canon-faithful div-onClick a11y gap — both adjudicated acceptable. 17/17 inspector, lint+tsc clean. Cole smokes clay synopsis box + click-linked-chip-opens-entry. |
| 6 | 2026-06-04 | 2026-06-04 | da8a9b9 | Cannot observe directly. Styling-only. Editor spell/grammar popover (the only custom editor right-click surface; plain right-click = native OS menu by design) → canon `.cm`/`.cm-item` classes, dead `.spell-popover` CSS deleted; positioning verified non-regressive (`.cm` is position:fixed z-index:61, viewport coords hold). Export header → download-icon title + x-icon close; FormatPicker radio fieldset → canon `.fmt-grid`/`.fmt` cards (classes already in app.css) with role=radiogroup + arrow-key nav. Review FLAG on test-gap + body-canon → both addressed (`.cm` test assertions added, fmt-grid adopted). 56/56 spell+export, lint+tsc clean. Cole smokes editor right-click menu chrome + Export modal sheet. |
| 7 | 2026-06-04 | 2026-06-04 | 59f531d | Cannot observe directly. Cards: white "Character/Location Sketch" area; right-click-only (double-click rename removed) via canon ContextMenu (Edit name/role/sketch · Open full entry · Delete). Role editable+linked as a SINGLE `entity_fields` kind=fact key='role' value via existing methods — NO migration (Decision 2); card & FullEntry eyebrow share the row; mergeFacts excludes role from generic detail boxes. Review FLAG on FeEyebrow stale-draft → fixed with `key={role}` remount (project pattern); both round-trip directions now tested. StoryBibleView split → EntityCardParts.tsx. 105/105 storybible+fullentry+menu, lint+tsc clean. Cole smokes sketch label + right-click menu + role edits reflecting card↔eyebrow. |
| 8 | 2026-06-04 | 2026-06-04 | 1ea8242 | Cannot observe directly. '+ Add field' → ONE editable detail box (title+body) as entity_fields kind=fact (Cole clarified 1/click, not 2); default 4 editable; edit-box overlap fixed. Links: char→scene + location→scene (Appears-in picker), char→location (char's Locations group), and location 'Characters here' reverse-shows linked chars via NEW migration-free listLinksTo(toId). Rename now in-place via NEW updateEntityFieldKey (preserves sort; collision-guarded). 4 review rounds: BLOCK on box-count (Cole-resolved) + a real link-DIRECTION bug on location-side add (fixed, regression-tested). sqlite/inMemory parity verified vs DDL. NO migration. 63 fullentry + 31 storybible, lint+tsc clean. Cole smokes +Add field, the 3 link types both-sided, rename, no overlap. |
| 9 | 2026-06-04 | 2026-06-04 | 0f43522 | Verified directly via `cargo check` (Rust gate IS runnable here, unlike the JS UI): no `unused variable: app` warning after prefixing `_app` in `open_path` (src-tauri/src/lib.rs:12). Tauri still injects the AppHandle. Done out of order (independent file) while P8's fix round ran. |

## Follow-up candidates

<!-- DEFAULT: empty. Tier-3 triple-gate only. -->

## Result

### Mechanical review

**Inputs resolved:**
- Plan: `roadmap/wave-26-canon-bugfix.md`
- Diff range: `8657797..0f43522` (P3–P9; P1/P2 pre-session)
- Graph: fallback (grep + import-following)
- Run: 2026-06-04, full suite 799/799, lint+tsc clean

#### Check 1: Forward-trace — PASS
Net-new symbols all reach production consumers: `ROLE_KEY` → EntityCardParts/FullEntry/FeSubcomponents; `FeAppearsIn` → FullEntry; `LocationLinkGroup` → PeopleGroup; `listLinksTo` → `PeopleGroup.tsx:158` (usePeopleGroup); `updateEntityFieldKey` → `FeSubcomponents.tsx:239` (handleRenameLabel); EntityCardParts component exports → StoryBibleView; `FeEyebrow` → FullEntry. No dead paths.

#### Check 2: Plan universals — PASS
"both chapters and short pieces" (P3 empty-state) — both sections touched. "ALL interaction via right-click / no click-to-edit" (P7) — double-click removed, test-asserted. "the 4 default boxes are editable" + "character→scene, character→location, location→scene" (P8) — all covered. No narrowed quantifiers.

#### Check 3: Export audit — PASS
New exports (`ROLE_KEY`, `listLinksTo`, `updateEntityFieldKey`, `FeAppearsIn`, `FeLocationLinks`/`LocationLinkGroup`, EntityCardParts/FeEyebrow extractions) each have ≥1 production (non-test) consumer. No dead exports.

#### Checks N/A: 4–6 (no schema property removals; no cross-boundary phases — all internal-only; no stryker.config / mutation:test script)

#### Verdict

**PASS** — Checks 1–3 ran clean against the P3–P9 diff; 4–6 N/A. Per-phase adversarial reviews (attack-diff on every phase, attack-hypothesis on P4) all adjudicated and flags addressed during implementation. Full suite 799/799, lint+tsc clean. Wrap PARKED pending Cole's runtime smoke (plan directive).

### Wave-end adversarial review (integration layer)

Wave-granularity attack-diff (cross-phase seams; per-phase correctness already established). Verdict **FLAG → addressed**:
- P7↔P8 shared-file seam (`defs.ts` mergeFacts, `FeSubcomponents.tsx`, `FullEntry.tsx`): role exclusion + DEF rows + custom fields are mutually exclusive by predicate — compose correctly, no double-render. PASS.
- sqlite `listLinksTo`/`updateEntityFieldKey` parity vs inMemory + DDL column names verified. PASS.
- Nav consistency (P5/P7/P8 → `openEntry`/`pushEntry`) + cross-phase CSS: PASS.
- **FLAG (fixed `c84fbc0`):** guard asymmetry — `+ Add field` (P8) lacked the reserved/duplicate-key guard that the rename path had. Fixed by an exported `isReservedKey()` helper shared by both paths; tests rewritten to call the real guard. No data corruption pre-fix (UNIQUE constraint protected). 803/803, tsc+lint clean.

State at smoke handoff: master `c84fbc0`, 9 phases + guard addendum, 803/803 full suite, lint+tsc clean, cargo check clean.

<!-- Wrap team (HANDOFF collapse / decision-promote / vendor-gotcha) runs AFTER Cole's smoke confirms. -->>
