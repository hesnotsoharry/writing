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
| 8 | Full-entry detail fields + entity links | sonnet-implementer | trophy · internal-only · reviewTier single (may escalate). "+ Add field" adds 2 editable detail boxes (title+body) via entity_fields; default 4 editable; fix edit-box overlapping the title; wire char→scene, char→location, location→scene link controls (entity_links + replaceSceneLinks). Canon: `full-entry.jsx`, FULL-ENTRY-SPEC §8. | On a full entry, clicking "+" adds two editable detail boxes (title + body), the default 4 boxes are editable, a saved box no longer overlaps its title, and the link controls add a character→scene, character→location, and location→scene link that then shows in the entry. |
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
- [ ] On a full entry, "+ Add field" appends two editable detail boxes (editable title + body) persisted via `entity_fields`; the 4 default boxes are editable; the edit affordance does not visually overlap the box title.
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

<!-- Per-phase rows added as work progresses: Phase | Dispatched | Completed | Commit SHA | Observation point hit -->

## Follow-up candidates

<!-- DEFAULT: empty. Tier-3 triple-gate only. -->

## Result

<!-- Filled at ship by wrap team. -->
