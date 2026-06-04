# Canon-polish sweep — parallel execution runbook

Turnkey runbook for the canon-design polish batch (the post-merge smoke punch-list, 2026-06-04).
Strategy mirrors the prior feature batch: **one SERIAL foundation wave first (Wave 17, run by the
lead on master), then 4 parallel lanes fan out** consuming the shared contracts the foundation stamps.

Lead session = **merge master** (the human opens a session per lane; the lead feeds each its prompt,
each lane implements end-to-end + writes a handoff, lead merges each back to `main`).

The whole sweep fixes the gap the post-wave-16 smoke surfaced: the canon prototype (`design-reference/`),
the CSS, and the data layer are all built — but the **React interaction layer that connects them was
mostly never wired**. This is overwhelmingly a *wiring* batch, not a build-from-scratch batch.

---

## GLOBAL RULES (every lane — read before touching code)

1. **`npm install` FIRST.** Each lane runs in a fresh git worktree with no `node_modules`. Run
   `npm install` before anything else. (Deps already exist in `package.json`/lockfile; you're hydrating.)
2. **NO human UI smoke is available.** The user (Cole) cannot test any lane's UI until ALL lanes are
   merged to `main`. You also cannot visually see the rendered Tauri app yourself (it needs the Tauri
   runtime; browser-smoke hangs). Therefore:
   - Verify via **automated gates** (`npm run lint`, `tsc`/`npm run build`, `npm run test` on touched files)
     AND **line-by-line code review against the matching `design-reference/*.jsx` file**.
   - Do NOT claim "verified in the UI." Your handoff MUST contain a **"Needs Cole's eyes post-merge"**
     section listing every behavior that only a human can confirm (animations, layout, hover states,
     right-click menus rendering correctly, etc.).
3. **Disjoint directories.** Each lane owns the dirs in its row and touches ONLY those. If you need to
   change a file outside your dirs, STOP and flag the lead — it's a foundation gap, not yours to patch.
4. **`src/styles/app.css` + `src/styles/tokens.css` = CONSUME-ONLY.** Every canon class already exists
   (`.scene-dot`, `.scene-words`, `.ch-count`, `.twist`, `.binder-foot`, `.foot-btn`, `.add-chapter`,
   `.page-turn-layer`, `.page-leaf`, `.chip`, `.be-foot`, `.goal-mini`, …). Never write CSS. If a class
   you need is missing, flag the lead — do not invent one.
5. **`src/App.tsx` / `src/App.content.tsx` / `src/App.overlays.tsx` / `src/App.state.ts` /
   `src/shell/TitleBar.tsx` are FROZEN.** Wave 17 stamps every prop/state/mount point the lanes need.
   Consume them; do not edit them. (Exception: Lane 21 owns `src/shell/StatusBar.tsx` — that's a
   component file, not the App wiring.)
6. **`src/db/` is FROZEN.** No migrations this sweep (Wave 17 confirmed the status column is free-text;
   goal progress lives in localStorage). The store methods you need already exist and are tested.
7. **Plan with the cmd in your row** (`/wave-plan` or `/wave-plan-lite`). Honor the wave-process.
8. **Report a handoff** (format at the bottom) so the lead can merge. Do not push to `main` yourself —
   you push your lane branch; the lead merges.

---

## WAVE 17 — Foundation (SERIAL, lead runs on master, FIRST)

Additive only — new files + small wiring edits, NO component rewrites. Establishes the shared contracts
the lanes import. **The exact exported contracts are specified here so lanes can be written against them.**

### New file: `src/lib/status.ts`
```ts
export type SceneStatus = "blank" | "outline" | "draft" | "revise" | "final";
export interface StatusMeta { id: SceneStatus; label: string; dot: string; isFinal: boolean; }
// labels: blank="To write", outline="Outlined", draft="Drafting", revise="Revising", final="Final"
// dot colors (from design-reference STATUS_META): blank=var(--ink-4), outline=var(--note),
//   draft=var(--accent), revise=#6a86a8, final=var(--good) (final renders a CHECK, not a dot)
export const STATUS_META: Record<SceneStatus, StatusMeta>;
export const STATUS_ORDER: SceneStatus[]; // ["blank","outline","draft","revise","final"]
export function normalizeStatus(raw: string): SceneStatus; // legacy "done" -> "final"; unknown -> "blank"
```
Wave 17 also widens `src/db/binderStore.ts` `SceneStatus` + `setSceneStatus` to the 5-value union
(reading via `normalizeStatus` so legacy `'done'` rows display as Final). `src/db/` stays frozen for lanes.

### New file: `src/components/menu/sceneMenu.ts`
```ts
import type { MenuItem } from "./ContextMenu";
import type { SceneStatus } from "../../lib/status";

export interface SceneMenuCallbacks {
  onRename: () => void;
  currentStatus: SceneStatus;
  onSetStatus: (s: SceneStatus) => void;
  onDuplicate: () => void;
  onExport: () => void;   // lanes pass () => showToast("Export — coming in a later wave")
  onArchive: () => void;
  onDelete: () => void;
}
export function buildSceneMenu(cb: SceneMenuCallbacks): MenuItem[];
// Order: Rename / Set status (submenu: STATUS_ORDER, each swatch+label, tick on currentStatus)
//        / Duplicate / Export scene… / {sep} / Archive / Delete(danger)

export interface ChapterMenuCallbacks {
  onRename: () => void;
  onNewScene: () => void;
  onExport: () => void;   // lanes pass the same "coming soon" toast stub
  onArchive: () => void;
  onDelete: () => void;
}
export function buildChapterMenu(cb: ChapterMenuCallbacks): MenuItem[];
// Order: Rename chapter / New scene / {sep} / Export chapter… / Archive chapter / {sep} / Delete chapter(danger)
```
Consumers render `<ContextMenu menu={{ x, y, items: buildSceneMenu(cb) }} onClose={…} />`.

### New file: `src/lib/manuscriptWords.ts`
```ts
import type { BinderTree } from "../db/binderStore"; // or the actual tree type
// Live manuscript total = sum of cached scene.words across the active project,
// with the active scene's cached count swapped for its LIVE count.
export function useManuscriptWordCount(args: {
  tree: BinderTree; activeSceneId: string | null; liveActiveWords: number;
}): number;
```

### New files: `src/features/goals/goalModel.ts` + `src/features/goals/useDailyGoalProgress.ts`
Daily / whole-manuscript goal, **persisted to localStorage (no migration).** Target + on-flag reuse the
existing `goalStorage` keys (`readGoalTarget`/`readGoalsOn`).
```ts
// goalModel.ts — daily baseline keyed by project + date
// localStorage key: `writing.goal.baseline.<projectId>.<YYYY-MM-DD>`
export function dailyWords(projectId: string, currentTotal: number): number;
//   baseline = total at first observation today (persist on first call/day); words = max(0, currentTotal - baseline)
export function recordGoalMet(projectId: string): void;   // stamps today for streak
export function goalStreak(projectId: string): number;     // consecutive days met

// useDailyGoalProgress.ts
export function useDailyGoalProgress(args: {
  projectId: string; currentTotal: number;
}): { words: number; target: number; pct: number; on: boolean; streak: number };
```
Consumed by Lane 20 (inspector "Today's goal" ring) AND Lane 21 (status-bar goal section + Goals modal).

### New file: `src/theme/useEditorStyle.ts`  (mounted by Wave 17 in `App.content.tsx`)
Reads the settings store (`proseFont`, `proseSize`, line-spacing, editor-width) and sets the CSS custom
properties (`--font-prose`, `--prose-size`, …) on `document.documentElement` on mount + on
`SETTINGS_CHANGED_EVENT`. **This is what makes font/size/spacing changes apply** — Lane 21's settings UI
already writes the keys; this hook bridges them to CSS. Wave 17 creates AND mounts it.

### Rust: `open_path` command (`src-tauri/src/lib.rs` + `src/lib/ipc.ts`)
`#[tauri::command] fn open_path(path: &str) -> Result<(), String>` via `tauri-plugin-opener` (already a
dep). Register in `generate_handler!`; wrap in ipc.ts as `openPath(path: string): Promise<void>`.
Consumed by Lane 21's Reveal button. (Rust lives in foundation so frontend lanes stay pure-JS.)

### App freeze-wiring (Wave 17 stamps; lanes consume)
- `<Binder>` gains props: `quickCount`, `archivedCount`, `onOpenQuickNotes`, `onOpenArchive` (footer).
- `<StatusBar>` gains: `goalsOn`, manuscript-total source, daily-goal source.
- `<Settings>` gains: `onOpenGoals` (so Configure opens the Goals overlay).
- `App.state.ts`: initialize `goalsOn` from `readGoalsOn()` instead of hardcoded `false`.
- Mount `useEditorStyle()` in `App.content.tsx`.

### Wave 17 locked decisions
- **No migration** — status column is free-text TEXT (verified); goal progress → localStorage. `src/db/` frozen.
- **Export menu items = stub** (`showToast("Export — coming in a later wave")`). Full Export is deferred Wave 23.
- **Goal model = Daily, whole-manuscript, persisted** (Cole, 2026-06-04).
- **App name "Writers Nook"** in About + window title only; titlebar logo stays; wordmark deferred.

---

## THE 4 PARALLEL LANES (fork from post-Wave-17 master)

```
git worktree add "C:/Web App/writing-wave18-binder"   -b wave-18-binder-canon
git worktree add "C:/Web App/writing-wave19-editor"    -b wave-19-editor-canon
git worktree add "C:/Web App/writing-wave20-story"     -b wave-20-story-bible-canon
git worktree add "C:/Web App/writing-wave21-settings"  -b wave-21-settings-goals-status
```

| Wave | Worktree / branch | Owns (disjoint) | Source | Plan cmd | Reviewer |
|---|---|---|---|---|---|
| 18 Binder | writing-wave18-binder / wave-18-binder-canon | `src/binder/*` | `design-reference/binder.jsx`, `menu.jsx`, `treeops.jsx` | `/wave-plan-lite` | single |
| 19 Editor | writing-wave19-editor / wave-19-editor-canon | `src/editor/*` | `design-reference/canvas.jsx`, `shell.jsx` (page-flip) | `/wave-plan` | single |
| 20 Story | writing-wave20-story / wave-20-story-bible-canon | `src/inspector/*` + `src/features/corkboard/*` + `src/storybible/*` | `design-reference/inspector.jsx`, `views.jsx`, `menu.jsx` | `/wave-plan` | single |
| 21 Settings/Goals/Status | writing-wave21-settings / wave-21-settings-goals-status | `src/features/settings/*` + `src/features/goals/*` + `src/shell/StatusBar.tsx` | `design-reference/settings.jsx`, `data.jsx`, `dialogs.jsx`, `chrome.jsx` | `/wave-plan-lite` | single |

### Lane 18 — Binder (consumes status.ts + sceneMenu.ts)
- Replace native `<select>` ProjectSwitcher with canon `ProjectSwitch` (cover graphic + title +
  "type · N words" subtitle + dropdown: projects w/ checkmark on active + "New manuscript…").
- Status **dots** on scene rows (`.scene-dot`, color via `STATUS_META`; Final → check icon).
- Scene **word-counter** (`.scene-words`, opacity 0 → 1 on hover/active).
- Chapter **scene-count** (`.ch-count` = `scenes.length`, not line/word count), always visible.
- Chapter **collapsibility** (`.twist` rotate -90° closed; open/closed state; scenes render only when open).
- Move "New chapter" to bottom dashed `.add-chapter` button + small `+` in section head.
- **Remove always-visible inline ✎/× icons**; all mutations behind right-click (`buildSceneMenu`/`buildChapterMenu`); keep double-click-to-rename.
- **Quick-notes footer** (`.binder-foot` + `.foot-btn` "Quick notes" + inbox icon + count badge from
  `quickCount`; "Archived" button when `archivedCount > 0` → `onOpenArchive`).
- Wire archive via the existing `onArchiveScene`/`onArchiveChapter` store path.

### Lane 19 — Editor
- **Header/byline** above the prose: chapter eyebrow (chapter title · status button) + scene `<h1>` +
  byline line (`word count · N characters · N locations present`). Read link counts from the existing
  scene-links store (counts only — linking UI is Lane 20; 0/0 is fine if unlinked).
- **Formatting bubble menu** on text selection (Bold / Italic / {sep} / Heading / Quote / List) — TipTap.
- **Page-flip animation** — wire the dead CSS (`.page-turn-layer`/`.page-leaf`, `app.css:659-706`):
  mount a leaf showing the OUTGOING scene on scene change; direction by scene-order index (earlier→"back",
  later→"fwd"); 1170ms; gated on motion tweak + `prefers-reduced-motion` + view==="write"; self-cleanup ~1250ms.
  Study `design-reference/shell.jsx:83-148` for the exact mechanics. **This is a new architectural surface
  — Phase 1 should be a walking skeleton (one scene-change triggers one leaf end-to-end) before polish.**
- **Spelling/grammar fix** (also `src/editor/*`): the "weird blue mark" is grammar decorations stacking
  on spelling decorations on overlapping ranges — de-conflict them. Grammar currently defaults OFF with no
  affordance ("doesn't work"); make it discoverable (default-on is acceptable — it's a toggle). Verify the
  harper IPC path actually renders.

### Lane 20 — Story (inspector + corkboard + storybible; consumes sceneMenu.ts + useDailyGoalProgress)
- **Inspector**: wire "Link a character"/"Link a location" buttons → `replaceSceneLinks`; **editable
  synopsis** (the dead pencil button → inline edit → persist); **role-only entity display** (avatar
  initial + name + role, per canon — not the full notes); fix the **notes/description text-wrap →
  horizontal-scroll bug**; wire the "Today's goal" ring to `useDailyGoalProgress` (render only when on).
- **Corkboard**: right-click menu (`buildSceneMenu`); **footer chips** (≤2 chars + 1 location, `.chip`);
  **editable synopsis** on cards. ⚠ **Already done by Wave 17 — do NOT rebuild:** the corkboard status-dot
  cycle now uses the canonical `STATUS_META`/`STATUS_ORDER` import with the 5-step cycle
  (`blank→outline→draft→revise→final`). Your corkboard work is ONLY the three items above (menu, chips,
  synopsis). Leave the existing status-dot rendering + `nextStatus` cycle intact.
- **Storyboard / Story Bible**: "New character"/"New location" add (type by column, no picker, enter
  rename on create); **remove the click-drag resize** (canon = auto-size by content); **scene-count
  footer** (`.be-foot`, "N scenes" from scene-links).

### Lane 21 — Settings / Goals / Status (consumes openPath + useDailyGoalProgress; useEditorStyle already mounted)
- **Settings**: Reveal-in-folder button → `openPath(libraryPath)`; **Configure → Goals** (the `onOpenGoals`
  prop is now passed by Wave 17 — wire the button to it). Confirm the font/size/spacing/width selects
  write the keys `useEditorStyle` reads (application is handled by the foundation hook).
- **Goals modal** (`design-reference/dialogs.jsx`): global enable toggle, goal-type grid, target input, Done.
- **Status bar** (`src/shell/StatusBar.tsx`): manuscript word count (left), goal section on the right when
  `goalsOn` (target icon + `words / target today` + 90px progress bar), and the backed-up/clock area
  (real-ish backup status + time, not the hardcoded placeholder). Hidden in focus mode. ⚠ **Data props are
  already threaded by Wave 17** — `StatusBar` receives `manuscriptTotal?: number` and
  `goal?: {words,target,pct,streak}` props (computed in `App.content.tsx` via the foundation hooks). Your
  job is to RENDER them in the StatusBar markup; do NOT edit `App.content.tsx` to thread them (it's frozen).

---

## MERGE ORDER (lead)
Wave 17 (lead, on master) → **[18 · 19 · 20 · 21 in parallel]** → 22 Archive → 23 Export.
Disjoint dirs ⇒ near-zero conflicts. After each lane merge: combined gates (lint + tsc + full suite, run
**in the worktree/merged tree**, not a stale shell). After all 4 merged: one integrated `npm run tauri dev`
smoke (Cole drives — first chance for human UI verification).

Deferred (unchanged scope, renumbered): **22 Archive** (archive-bin browsing UI), **23 Export**
(Markdown + docx + PDF; resolve jsPDF-vs-Tauri-sidecar at its own `/wave-plan`).

---

## HANDOFF FORMAT (each lane returns this to the lead)
```
## Wave NN <lane> — handoff for merge
- Branch: wave-NN-slug   ·   Plan: roadmap/wave-NN-slug.md
- Gates: lint <PASS/FAIL> · tsc <PASS/FAIL> · touched tests <N pass>
- Reviewer verdict: <PASS/FLAG/BLOCK + one-line>
- What shipped: <2-4 bullets>
- Files touched: <list — confirm all within owned dirs>
- Contracts consumed: <which Wave-17 exports you imported>
- ⚠ Needs Cole's eyes post-merge: <every behavior only a human can confirm — animations, layout,
  hover/right-click rendering, etc.>
- Flags / deviations / anything the lead should know before merging: <…>
```
```
