---
project: writing
updated: 2026-06-04
---

## Current state
- Branch/trunk: **`master`** (HEAD `e304e83`). `main` is a stale git-default — DO NOT use it; everything lives on master.
- **Canon-polish sweep IN FLIGHT** (merge-master model). Origin: the post-wave-16 live smoke found the app boots but is missing a large amount of canon-design polish/wiring (~32 items). Root insight: the canon prototype (`design-reference/`), the CSS, and the data layer are all built — the **React interaction layer that connects them was mostly never wired**. So this is a *wiring* sweep, not build-from-scratch.
- **Wave 17 — Foundation: MERGED to master** (`7addfa4` + merge `e304e83`). Shared contracts the lanes import: `src/lib/status.ts` (5-value `SceneStatus`+`STATUS_META`/`ORDER`/`normalizeStatus`), `src/components/menu/sceneMenu.ts` (`buildSceneMenu`/`buildChapterMenu`), `src/features/goals/goalModel.ts`+`useDailyGoalProgress.ts` (daily whole-manuscript goal, localStorage, **local-date** keyed), `src/lib/manuscriptWords.ts`, `src/theme/useEditorStyle.ts` (font/size CSS-var bridge, mounted), `open_path` Tauri cmd + `openPath` ipc, App freeze-wiring (goalsOn/onOpenGoals/Binder-footer/StatusBar data props), Corkboard migrated to canonical 5-step status cycle. Gates: lint+tsc clean, **381/381 tests**. Adversarial FLAG resolved (UTC date-key, useMemo side-effects, StatusBar mount points, hook tests).
- **Lanes 18–21 running in parallel worktrees** (Cole opens a session per lane; lead merges). NOT yet merged. Forked from `e304e83`.

## Next 3 steps (merge-master procedure)
1. **As each lane handoff lands** (handoff format in `canon-polish-coordination.md` § HANDOFF FORMAT): from the main repo on master — `git merge --no-ff <lane-branch>`, then run combined gates **in the merged tree** (`npm run lint` + `npx tsc --noEmit` + `npm run test` — NOT in a lane's stale shell), eyeball the diff stays within the lane's owned dirs, resolve any conflict (disjoint dirs ⇒ near-zero; app.css is consume-only so collisions there = a lane broke a rule → flag). One lane = one merge.
2. **After all 4 merged:** back up `writing.db`, then one integrated `npm run tauri dev` smoke — **Cole's first chance to see the canon UI** (no human UI smoke was possible during the lanes). Expect small integration bugs at the seams (props that don't quite line up, double-rendered menus, etc.).
3. **Then the deferred waves** — sequence TBD after the smoke:
   - **Likely a SMALL FIX wave first** (Lane B / fix-sweep) to clean up integration bugs the smoke surfaces. May take the **Wave 22** slot, shifting the features below by one. Decide after smoke.
   - **Archive** (archive-bin browsing UI; `onArchiveScene`/`onArchiveChapter` store path already exists) and **Export** (Markdown + docx + PDF; resolve jsPDF-vs-Tauri-sidecar at its own `/wave-plan`) — the two features deferred all sweep. Right-click "Export…" items are currently a "coming soon" toast stub until Export ships.

## Active work
- **THE runbook: `roadmap/canon-polish-coordination.md`** — foundation contracts, global rules (disjoint dirs · app.css/tokens.css consume-only · App.*/`src/db/` frozen · npm install first · NO human UI smoke), lane table, merge order, handoff format. Read this first to resume as merge-master.
- Lane worktrees / branches (all at `e304e83` until they commit):
  - `C:/Web App/writing-wave18-binder` → `wave-18-binder-canon` (`/wave-plan-lite`)
  - `C:/Web App/writing-wave19-editor` → `wave-19-editor-canon` (`/wave-plan`, page-flip)
  - `C:/Web App/writing-wave20-story` → `wave-20-story-bible-canon` (`/wave-plan`)
  - `C:/Web App/writing-wave21-settings` → `wave-21-settings-goals-status` (`/wave-plan-lite`)
- Locked product decisions (Cole, 2026-06-04): goal model = **daily / whole-manuscript / persisted**; Export menu items = **stub**; app name **"Writers Nook"** in About + window title only (titlebar logo stays, wordmark deferred).
- **No migrations this sweep** (status column free-text TEXT verified; goal progress → localStorage). `src/db/` frozen. Still: back up `writing.db` before the integrated smoke (live DB).
- Housekeeping (non-blocking): stale prior-batch worktrees (`writing-wave12…wave17-archive`) to `git worktree prune` after the sweep; 3 untracked `.ps1` scripts at repo root (dead-session scratch — decide keep/remove); `Cargo.toml` CRLF churn keeps recurring — a `.gitattributes` normalization is a good small follow-up.

## Reference index
- Runbook: [canon-polish-coordination.md](canon-polish-coordination.md) · Foundation: [wave-17-foundation.md](wave-17-foundation.md)
- Canon design source: `design-reference/*.jsx` (binder/canvas/inspector/views/settings/chrome/menu/dialogs/treeops + app.css/tokens.css)
- Prior batch runbooks (pattern precedent): [parallel-feature-waves-coordination.md](parallel-feature-waves-coordination.md) · [feature-waves-plan.md](feature-waves-plan.md)
- Decisions: [decisions/](decisions/) 0001–0007
- Build: `npm run tauri dev` · Test: `npm run test` · Lint: `npm run lint:fix`
