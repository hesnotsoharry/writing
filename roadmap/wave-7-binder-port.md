---
status: COMPLETE (pending merge to master via lead)
created: 2026-06-03
---

# Wave 7: binder-port

## Plan

### Status

PLANNED · style-only port · parallel screen-port batch (lane: Binder, heaviest) · drafted 2026-06-03 · worktree `C:\Web App\writing-wave7-binder` branch `wave-7-binder-port`

### Goal

After this wave, `src/binder/**` renders entirely through the existing design-token CSS classes in `src/styles/app.css` instead of the hardcoded inline styles and JS style-constants it carries today. The Binder's root element drops its `navStyle` (`background:#fafafa` + `border-right:1px solid #e0e0e0`) in favor of `.panel-binder`, which fixes the wave-5 smoke finding: the Binder pane stops rendering as a white box with a doubled right border, and instead inherits the parchment background + single shared `--line` border of the app shell. Scene rows, chapter headers, section headings, the project switcher, the rename input, and the drag "lift" affordance all move to tokens. No hardcoded hex colors remain in `src/binder/**` except the dnd-kit `transform`/`transition` values (which are library-computed and must stay inline). Zero changes to `app.css`, `App.tsx`, `App.state.ts`, or `src/db/`.

### Scope

**In scope:**

- `src/binder/Binder.tsx` — root `<nav>` → `className="panel-binder"` (delete `navStyle`); `BinderContent`/`EmptyBinderHint` wrappers; section headings → `.bsection-head`; add buttons → `.add`; "+ Chapter" → `.add-chapter`; empty hint → `.empty-hint`; the `paddingTop:8` / `padding:"0 8px 8px"` wrappers retokenized or class-adopted.
- `src/binder/BinderCrud.tsx` — `SceneDisplay` row → `.scene-row` (+ `.scene-row.active` for selection, replacing the button-level `#e8eaf6`/`#1a237e`), `.scene-title`, `.scene-words`; `ChapterDisplay` heading → `.chapter-row`/`.ch-title`/`.ch-count`/`.twist`; `InlineRename` `<input>` → `.rename-input`; per-row CRUD icon buttons (`iconBtnStyle`) retokenized in place (no app.css class covers them — see Decision 3).
- `src/binder/BinderDrag.tsx` — retokenize the `dropSlot` lift constant to design tokens; keep `useSortableScene`/`useSortableChapter` `transform`/`transition` inline (non-negotiable); `SortableSceneList` `<ul>` reset retained or → `.scene-list`; preserve the intentionally-empty `<DragOverlay>{null}</DragOverlay>`.
- `src/binder/ProjectSwitcher.tsx` — `containerStyle` → `.project-switch`; the plain `<select>` retokenized (hardcoded hex → token vars).

**Out of scope:**

- `src/App.tsx`, `src/App.state.ts`, `src/styles/app.css`, `src/styles/tokens.css`, `src/db/**` — hard coordination-rule boundaries (CONSUME-ONLY / frozen). Deferral path: any needed class addition is flagged to the lead session, never edited unilaterally.
- `src/binder/buildTree.ts`, `src/binder/computeReorder.ts` — pure data transforms, no style surface, untouched.
- **Status dots** (`STATUS_META` → `span.scene-dot`): the `Scene` type (`src/db/binderStore.ts:21–29`) has no `status` field; wiring it needs `ALTER TABLE` + migration + store interface + App threading — a data-layer change forbidden to this DB-frozen lane. Deferral path: follow-up candidate (see `## Follow-up candidates`).
- **ProjectSwitcher custom dropdown** (reference's `div.proj-menu`/`.proj-item` overlay): the live component is a plain `<select>`; adopting the reference dropdown is a behavioral rewrite. Deferral path: follow-up candidate.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Binder.tsx shell → `.panel-binder` + section/header classes | `sonnet-implementer` | trophy (no new unit tests; existing render/behavior tests must stay green) · internal-only (style) · Delete `navStyle`,`sectionHeadingStyle`,`addBtnStyle`,`addChapterBtnStyle`; apply `.panel-binder` (keep `<nav>` tag), `.bsection-head` + child `.add`, `.add-chapter`, `.empty-hint`. This phase alone fixes the white-pane + double-border smoke finding. | Binder pane in `tauri dev` renders parchment bg + single right border (no white box, no doubled border) — verified at wave-end smoke. |
| 2 | BinderCrud.tsx rows → `.scene-row`/`.chapter-row` + row-level selection | `sonnet-implementer` | trophy · internal-only (style; selection model shifts button→row) · `SceneDisplay`→`.scene-row`(+`.active`)/`.scene-title`/`.scene-words`; `ChapterDisplay`→`.chapter-row`/`.ch-title`/`.ch-count`/`.twist`; `InlineRename`→`.rename-input`; retokenize `iconBtnStyle` (Decision 3). Selected scene reads as row-tint, not button-bg. | Selecting a scene highlights the whole row (parchment-tint + accent bar), rename input shows accent border — verified at wave-end smoke. |
| 3 | BinderDrag.tsx → retokenize drag lift, preserve dnd-kit internals | `sonnet-implementer` | pyramid (existing drag tests `BinderDrag`/`computeReorder` must stay green) · internal-only · Retokenize `dropSlot` → `var(--paper)`/`var(--line)`/token shadow; KEEP `transform`/`transition` inline; `<ul>` reset retained or `.scene-list`; keep `<DragOverlay>{null}`. | Dragging a scene/chapter shows a token-styled lift ghost; drop reorders correctly — verified at wave-end smoke. |
| 4 | ProjectSwitcher.tsx → `.project-switch` + token select | `sonnet-implementer` | trophy · internal-only · `containerStyle`→`.project-switch`; retokenize `<select>` hex→token vars. Do NOT port the reference custom dropdown. | Project switcher container matches binder header styling; switching projects still works — verified at wave-end smoke. |

Walking-skeleton rule: N/A — this wave introduces no new architectural surface (dnd-kit, React, the CSS class system, and the slot props are all already wired from waves 3–6). Phase 1 is sequenced first because it is the thinnest visible win and resolves the named smoke defect.

### Acceptance criteria

- [ ] `src/binder/Binder.tsx` contains no `navStyle`, `sectionHeadingStyle`, `addBtnStyle`, or `addChapterBtnStyle` constant; the root `<nav>` carries `className="panel-binder"`.
- [ ] No hardcoded hex color literal (`#rrggbb`) remains anywhere in `src/binder/**` EXCEPT inside dnd-kit `transform`/`transition` strings (which contain none anyway). Verified by grep.
- [ ] Scene selection renders as a row-level `.scene-row.active` treatment, not a button background.
- [ ] `InlineRename` input uses `.rename-input`; the `+`/add buttons that are `.bsection-head` children use `className="add"`.
- [ ] Drag-and-drop reorder still functions (existing `BinderDrag`/`computeReorder` tests green); the drag lift uses token colors; `<DragOverlay>` remains empty.
- [ ] `npm run test` (full suite), `tsc`, and `npm run lint` are all GREEN in the worktree.
- [ ] Zero diff to `src/App.tsx`, `src/App.state.ts`, `src/styles/app.css`, `src/styles/tokens.css`, `src/db/**` (verified by `git diff --name-only` against master).
- [ ] Wave-end UI smoke confirms: Binder pane has no white box and no doubled right border; binder visuals match `design-reference/binder.jsx` token treatment.

### Files the next agent should read first

1. `design-reference/binder.jsx` — the visual target: className structure + DOM hierarchy the port must match.
2. `src/styles/app.css` (lines ~136–250, ~552–637) — the binder CSS classes being adopted (READ-ONLY; do not edit).
3. `src/binder/Binder.tsx` — Phase 1 surface: root `<nav>`, section headings, add buttons, content wrappers.
4. `src/binder/BinderCrud.tsx` — Phase 2 surface: scene/chapter rows, selection model, rename input, row icon buttons.
5. `src/binder/BinderDrag.tsx` — Phase 3 surface: sortable hooks (keep their inline styles), `dropSlot`, `DragOverlay`.
6. `src/binder/ProjectSwitcher.tsx` — Phase 4 surface: container + `<select>`.
7. `roadmap/parallel-screen-ports-coordination.md` — the lane contract + forbidden-files rules.

### Note to the implementer

This is a style-only port: change *how it looks*, never *what it does*. The drag machinery, CRUD callbacks, and prop contract (`Binder`'s 9 props) are correct as-is — touch render output only. The single biggest temptation to resist: editing `app.css` to "add a missing class." Every class you need already exists (verified) — if one seems missing, you're misreading the selector; flag it to the lead, do not write the shared file. Second temptation: do NOT touch the dnd-kit `transform`/`transition` inline styles — they're library-computed and moving them to CSS breaks drag. Third: the per-row CRUD icon buttons (rename/delete/add-scene) have NO app.css class — retokenize their constant in place (`#888`→`var(--ink-3)`), don't force `.add` onto them (that selector only matches `.bsection-head` children). First step: verify the `## Locked decisions` section below has decisions filled in.

Before declaring a phase complete, restate the Observation point from the Phases table in your own words and describe what you actually observed. These are visual changes — per-phase you can only observe `tsc`/`lint`/existing-tests green plus the intent of the diff; the *visual* observation (white-pane gone, tokens applied) happens at the wave-end `sonnet-smoke-runner` UI smoke via `tauri dev`. Say so explicitly per phase — do not claim "looks right" without the running app, and do not substitute "tests pass" for the visual confirmation that the smoke run provides.

## Locked decisions

> Decisions below cleared the decision-review path (style-port calls; the three below are low-stakes consume-existing-pattern picks — skip-tier per `best-practice-spectrum.md`, sidecar written before authoring). They record the non-obvious choices so the next lane/wave doesn't relitigate them.

### Decision 1: Root element stays `<nav>`, adopts `.panel-binder` (256px design width)

**Context:** Reference uses `div.panel-binder`; live code uses `<nav style={navStyle}>` at 220px. **Pick:** Keep the `<nav>` tag, apply `className="panel-binder"`, delete `navStyle` — accept the 256px `--binder-w` width. **Rationale:** `<nav>` is the semantically correct element for the binder; a class applies to any tag. Adopting `--binder-w` is the whole point of "shed inline → tokens" — the 36px widening is the intended design-target match, not a regression. **Consequences:** Binder widens 220→256px; the white-pane + double-border smoke finding is resolved (the `#fafafa` bg and `border-right` are deleted; `.panel-binder`'s single `--line` border + parchment bg take over). **Enforcement:** acceptance-criterion grep (no `navStyle`) + wave-end UI smoke. advisory-only.

### Decision 2: Scene selection moves from button-level bg to row-level `.scene-row.active`

**Context:** Live code tints the select *button* (`#e8eaf6` bg / `#1a237e` text via `sceneBtnBase`/`btnStyle`); reference tints the whole *row* (`.scene-row.active`). **Pick:** Adopt the row-level `.scene-row.active` model. **Rationale:** Matches the design reference's selection affordance (full-row parchment tint + left accent bar) and removes two more hardcoded hex values; the `isSelected` boolean simply toggles the class instead of merging a style object. **Consequences:** Selection reads as a row highlight, not a button highlight — a deliberate visual change. **Enforcement:** acceptance criterion + wave-end smoke. advisory-only.

### Decision 3: Per-row CRUD icon buttons are retokenized in place, not class-adopted

**Context:** `BinderCrud.tsx`'s rename/delete/add-scene icon buttons (`iconBtnStyle`, hardcoded `#888`) have no matching app.css class — the only `.add` selector is scoped to `.bsection-head`/`.insp-label` descendants, and the static design-reference mockup has no per-row CRUD affordances. **Pick:** Retokenize `iconBtnStyle` in place (`#888`→`var(--ink-3)`, etc.) and keep it as a small token-based constant; reserve `className="add"` only for the section-level `+` buttons that are genuine `.bsection-head` children. **Rationale:** Satisfies the "no hardcoded hex / adopt tokens" goal without editing the frozen `app.css` or forcing a selector that won't match. **Consequences:** A small token-based style constant survives in `BinderCrud.tsx` for live-only CRUD buttons — acceptable; the alternative (new app.css class) violates the lane's CONSUME-ONLY rule. **Enforcement:** acceptance-criterion grep (no hardcoded hex) + code review. advisory-only. `durable: candidate` — future binder-affordance waves should reuse this token constant or promote it to a shared `.binder-row-act` class if/when the design system adds one.

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | yes | yes | `8d77d4b` | Deferred to lead post-merge `tauri dev` smoke (browser boot blocked — Tauri `invoke` undefined). Static: `.panel-binder` supplies parchment bg + single `--line` border (reviewer PASS). |
| 2 | yes | yes | `868a78a` | Deferred to lead post-merge smoke. Static: row-level `.scene-row.active` selection + `.rename-input` confirmed (reviewer PASS; FLAG 1a→Phase 3, 1b=design intent). |
| 3 | yes | yes | `d2027ca` | Deferred to lead post-merge smoke. Static: tokenized drag lift + `.scene-list` 28px indent fix confirmed (reviewer PASS). |
| 4 | yes | yes | `d35e24d` | Deferred to lead post-merge smoke. Static: `.project-switch` + tokenized `<select>` (reviewTier skip; gates green). |

## Follow-up candidates

- Binder scene-row status dots (`STATUS_META` → `span.scene-dot`): cannot be done in-wave — requires a new `status` column on the `scenes` table (`ALTER TABLE` + migration), `Scene`-interface change, `loadProject` SELECT + `createScene` INSERT updates, and a `setStatus` callback threaded App→Binder→row. Multi-file (≥5) + schema/migration change, cannot be cleared by a single sonnet-implementer dispatch, and `src/db/` is frozen for this lane. | present-harm: K2 — binder scene rows lack the design's status-color affordance shown in `design-reference/binder.jsx:50` (`span.scene-dot` driven by `STATUS_META`, `design-reference/data.jsx:128–134`); the `.scene-dot` CSS class exists unused at `src/styles/app.css:228`.
- ProjectSwitcher custom dropdown port (`div.proj-menu`/`.proj-item`/`.cm-backdrop` overlay): cannot be done in this style-only lane — the live component is a plain `<select>`; the reference is a custom click-outside dropdown, a behavioral rewrite (new state, keyboard handling, backdrop). | present-harm: K2 — the project switcher renders as a native `<select>` instead of the design's custom book-cover dropdown (`design-reference/binder.jsx` `ProjectSwitch`); the `.proj-menu`/`.proj-item`/`.proj-new` classes exist unused at `src/styles/app.css:612–634`.
- Chapter collapse/expand affordance (twist chevron): cannot be done in this style-only lane — the live binder has NO collapse functionality at all (verified: no `open` state, no chevron, scene lists render unconditionally in `Binder.tsx` `DraggableChapterSection`). The design reference (`design-reference/binder.jsx:59–96`) has the full affordance (`useState` open + `span.twist` chevron + `.chapter-row.closed` + conditional scene render). Wiring it is NEW FEATURE work spanning `Binder.tsx` + `BinderCrud.tsx` (state + toggle handler + conditional render + chevron icon), not a single-dispatch style change. | present-harm: K2 — chapters always render fully expanded with no way to collapse; the `.chapter-row.closed .twist` rotation rule exists unused at `src/styles/app.css` and the design's twist chevron is absent from every chapter heading.

## Result

**Delivered (4 phases, 4 commits on branch `wave-7-binder-port`):** `src/binder/**` fully shed of inline styles / JS style-constants in favor of the existing design-token CSS classes. Net **−127 lines** (style-constant deletion). **Zero hardcoded hex remains anywhere in `src/binder/`** (verified by grep). The wave-5 smoke defect is fixed at the source: `navStyle`'s `#fafafa` background + `border-right` are deleted; `.panel-binder` now supplies the parchment background + the single shared `--line` border (white-pane + doubled-border gone).

- **Phase 1** `8d77d4b` — Binder.tsx: `<nav>`→`.panel-binder`, `.binder-scroll`, `.bsection-head`+`.add`, `.add-chapter`, `.empty-hint`.
- **Phase 2** `868a78a` — BinderCrud.tsx: scene rows→`.scene-row`(+`.active` row-level selection, replacing button-bg), `.chapter-row`/`.ch-title`, `.rename-input`, `iconBtnStyle` retokenized.
- **Phase 3** `d2027ca` — BinderDrag.tsx: `dropSlot`→tokens (`--paper`/`--line`/`--r-xs`/`--shadow-sm`), `.scene-list` on the sortable `<ul>` (restores 28px indent + connector line); dnd-kit `transform`/`transition` + empty `DragOverlay` preserved.
- **Phase 4** `d35e24d` — ProjectSwitcher.tsx: `.project-switch` + tokenized `<select>` (plain `<select>` kept).

**Gates (final, full):** `tsc` clean · `eslint src/` clean · **144/144 tests** green. **Scope guard:** `git diff --name-only fc180bf HEAD` touches only `src/binder/**` + this wave file — **no `App.tsx` / `app.css` / `tokens.css` / `src/db/` writes** (coordination contract honored). **No app.css additions** (consume-only respected).

**Reviews:** Phases 1–3 ran `sonnet-adversarial-reviewer` (attack-diff, single). P1 FLAG (only flag = `dropSlot` hex → P3 scope). P2 FLAG (1a `.scene-list` → resolved in P3; 1b `.ch-title` non-uppercase = design intent, app.css verbatim from design-reference). P3 PASS. P4 reviewTier=skip (trivial retokenize). All flags adjudicated; none blocking.

**Verification status:** Live UI smoke **deferred to the lead's post-merge `tauri dev` run**. The app cannot boot in a plain browser (Vite dev) — `initializeProjectTree` calls Tauri `invoke`, undefined outside the Tauri runtime, so the app hangs at "Loading…". This is a useful gotcha for the other screen-port lanes (browser-shortcut smoke won't work; must use `npm run tauri dev`). The white-pane fix is also most meaningfully verified on the fully-merged tree where all four panes are ported.

**Merge:** Ready for the lead session to merge per the coordination order (Editor → Story Bible → **Binder** → Inspector). Branch `wave-7-binder-port`, base `fc180bf`, 5 commits (1 plan + 4 phases). `npm install` was run on the branch (clean, 0 vulnerabilities). Follow-up candidates (status dots, chapter collapse/expand, ProjectSwitcher custom dropdown) recorded above — recommend the lead's consolidated wrap files them.
