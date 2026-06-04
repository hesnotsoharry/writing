# Next batch — net-new feature waves (plan)

Planned 2026-06-03 while the screen-port batch (waves 7/9/10) was in flight. This is the batch AFTER
the screen ports land. Strategy mirrors wave-5: **one serial "wiring wave" creates stable feature
mount points, then parallel feature waves fill them.** Author the wiring-wave file only AFTER waves
7/9/10 merge — it builds on the final `App.tsx` (wave-9 restructures it: inspector props, goal ring,
EditorPane cleanup). The structure below is stable; only line-level application waits.

## Locked product decisions (Cole, 2026-06-03)
- **Export: all three formats in the first Export wave** — Markdown + clipboard (zero-dep) **+ docx**
  (add the `docx` npm package, MIT) **+ PDF**. The PDF path (jsPDF vs. a Tauri Rust sidecar) is a
  researched sub-decision to resolve at the Export wave's own `/wave-plan` time, not now.
- **Scene status: yes** — add a `status` column (blank/draft/done + colored dots in binder + corkboard).
  Added as **migration 5, owned by the Corkboard wave** (not the wiring wave — keeps it decoupled).

## Wave W — Feature Shell Wiring (SERIAL bottleneck; ~1 session)
Establishes all mount points; builds NO feature UI. Must be authored against the post-7/9/10 `App.tsx`.
- `src/App.state.ts`: `AppView` += `"cork"`; add boolean flags `showQuickCapture/showInbox/showArchive/
  showGoals/showExport/showSettings` + `focusMode` + `goalsOn` + `hasQuickItems` (+ setters), all default false.
- `src/App.tsx` (`AppContent`): wire TitleBar's 5 already-stubbed action handlers to the real setters;
  add the `view === "cork"` viewStage branch (renders a Corkboard stub); render each overlay (stub)
  gated on its `show*` flag using the existing `.scrim`/`.sheet` classes; add a `useEffect` global
  keybinding hook (`⌘K/./E/,`, `Esc`) mirroring `design-reference/app.jsx`; add `focusMode` as a
  `data-focus` attr on AppShell root (`.focus-exit` CSS already present).
- **Focus mode is fully done in THIS wave** (boolean + CSS class — not a feature wave).
- Expose `useTheme()`'s `setTheme`/`setAccent` (currently discarded at App.tsx) for the Settings wave.
- Add no-op `onArchiveScene`/`onArchiveChapter` stubs to `BinderCallbacks` (so the Archive wave only
  fills the DB write, not the callback shape — the wave-5 slot pattern again).
- **Migration 4** (additive, appended to `src/db/migrations.ts` MIGRATIONS registry — never edits
  existing migrations): `quick_notes`, `archive`, `goals` tables.
- Stub component per feature in `src/features/{corkboard,quickcapture,inbox,archive,goals,export,settings}/`.

## Waves W+1.. — parallel feature waves (own dir each; disjoint after the wiring wave)
| Wave | Owns | Backing data | Source (design-reference) |
|---|---|---|---|
| Corkboard | `src/features/corkboard/` | binder tree + **migration 5** (scene `status`) | `views.jsx` Corkboard |
| Quick Capture + Inbox *(bundled — QC writes, Inbox reads same table)* | `quickcapture/` + `inbox/` | `quick_notes` (migration 4) | `dialogs.jsx` |
| Goals | `src/features/goals/` | `goals` (migration 4); wires real target → wave-9 goal-ring localStorage key | `dialogs.jsx` |
| Settings | `src/features/settings/` | localStorage (no migration); consumes exposed `useTheme` setters | `settings.jsx` |
| ⚠ Archive | `src/features/archive/` | `archive` (migration 4) + **one shared touch**: `src/binder/BinderCrud.ts` soft-delete → serialize AFTER the others, don't run fully parallel | `dialogs.jsx` |
| ⚠ Export | `src/features/export/` | reads binder + `scene_docs` (no schema); needs `docx` + PDF path | `dialogs.jsx` |

## Caveats / honest flags
- **All app.css classes already exist** (`.scrim`, `.sheet`, `.qc-pop`, `.corkboard`, `.card`, `.goal-type-grid`,
  `.exp-seg`, `.fmt-grid`, `.set-sheet`, `.focus-exit`) — feature waves stay CONSUME-ONLY on app.css, like the screen ports.
- **Archive** is the only feature with a residual shared-file seam after wiring (`BinderCrud.ts`). Serialize it.
- **Export** is gated on its docx/PDF library work — effectively the last wave of the batch.
- Merge order: wiring wave first (serial) → Corkboard / QuickCapture+Inbox / Goals / Settings in parallel
  → Archive → Export.
