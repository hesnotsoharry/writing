# Parallel screen-port waves — coordination (waves 7–10)

Four screen ports run **in parallel**, each in its own git worktree + branch + Claude session,
forked from master after this doc is committed. Wave-5 created stable named slots specifically so
these don't collide. This doc is the contract that keeps them disjoint. **Read your lane + the
global rules before starting.**

## Global coordination rules (every lane MUST honor)

1. **`src/styles/app.css` + `src/styles/tokens.css` are CONSUME-ONLY (read, never write).** They were
   copied verbatim from `design-reference/` and already contain every screen's classes. If you think
   you need to ADD a class, STOP — verify it's truly missing, then flag it; do not edit the shared file
   unilaterally (it's the #1 merge-conflict risk).
2. **`src/App.tsx` is owned by the Inspector lane (wave-9) ONLY.** Binder/Editor/Story-Bible lanes:
   **do not touch `App.tsx`.** Your port is style-only inside your own screen dir; the slot props
   App() already passes you are stable and sufficient.
3. **`src/App.state.ts` is frozen** (no new `AppView` value — Corkboard is a later wave). No lane edits it.
4. **`src/db/` is frozen** except: wave-9 (Inspector) MAY ADD new *read-query* functions for its data
   needs (additive only — never modify the migration system / schema from wave-6).
5. Each lane plans with `/wave-plan-lite` (style ports) or `/wave-plan` (Inspector — it's a real
   feature), runs its own gates + adversarial review + smoke, wraps, and merges back to master.
6. **Merge order: Editor → Story Bible → Binder → Inspector LAST** (Inspector carries the App.tsx + DB
   changes + biggest diff; merging it onto an already-stabilized base is safest). Coordinate the actual
   merges through the lead session so master moves one lane at a time.

## Lane briefs

### Wave 7 — Binder port  ·  branch `wave-7-binder-port`
- **Owns:** `src/binder/**` (Binder.tsx, BinderDrag.tsx, BinderCrud.tsx, ProjectSwitcher.tsx, buildTree.ts, …).
- **Scope:** shed the inline styles (`navStyle` @ Binder.tsx ~252, `sectionHeadingStyle`, `addBtnStyle`,
  the `EmptyBinderHint`/`BinderContent` wrappers) → existing classes (`.panel-binder`, `.binder-scroll`,
  `.bsection-head`, `.chapter-row`, `.scene-row`, `.scene-list`, `.proj-btn`, `.binder-foot`, …).
  **Re-graft @dnd-kit:** the drag machinery already works — restyle the `DragOverlay` ghost + drag-active
  row to design tokens (internal to `src/binder/`). Wire status-dot colors (`STATUS_META` from
  `design-reference/binder.jsx`) if cheap. **Fixes the white-pane + double-border smoke finding** (the
  Binder's own `border-right` + `background:#fafafa` are what you're removing).
- **Source:** `design-reference/binder.jsx`. **Forbidden:** App.tsx, app.css, src/db/. Heaviest lane.

### Wave 8 — Editor/Canvas port  ·  branch `wave-8-editor-port`
- **Owns:** `src/editor/**` (Editor.tsx).
- **Scope:** replace the wrapper inline styles (`maxWidth/margin/padding` @ Editor.tsx ~15) with
  `.canvas-scroll > .canvas-wrap`; apply `.scene-eyebrow` / `.scene-h1` / `.prose` classes.
- **Source:** `design-reference/canvas.jsx`. **Forbidden:** App.tsx, app.css, src/db/. Smallest lane.

### Wave 9 — Inspector full expansion  ·  branch `wave-9-inspector-expansion`
- **Owns:** `src/inspector/**` (SceneInspector.tsx) **+ `src/App.tsx` (the only lane that may)** + NEW
  additive read-queries in `src/db/` if needed.
- **Scope:** the FULL design-reference inspector — synopsis, goal ring, entity cards w/ avatars + roles
  (not a style-swap; a feature expansion). Style via existing classes (`.insp-scroll`, `.insp-group`,
  `.synopsis`, `.entity-card`, `.avatar`, `.goal-ring`). Add the DB read-queries + the `App.tsx`
  props/threading to feed them. **Also (since you own App.tsx):** clean up the `EditorPane` wrapper
  inline styles in App.tsx (~107–119) — that's the one bit of inline debt no style-lane can reach.
- **Source:** `design-reference/inspector.jsx`. Plan with `/wave-plan` (real feature). Biggest scope/risk.
  **Forbidden:** app.css writes; src/db/ schema/migration changes (additive read-queries only).

### Wave 10 — Story Bible port  ·  branch `wave-10-storybible-port`
- **Owns:** `src/storybible/**` (StoryBibleView.tsx).
- **Scope:** shed the ~11 inline-style constants (`sectionStyle`, `headingStyle`, `rowStyle`, … through
  `addBtnStyle`, + the root `<main>` inline styles ~279) → existing classes (`.bible-grid`,
  `.bible-col-title`, `.bible-entry`, …). Most inline surface, cleanest 1:1 mapping.
- **Source:** `design-reference/views.jsx`. **Forbidden:** App.tsx, app.css, src/db/.

## After all four merge
HANDOFF's Tier-2 features (Corkboard / Settings / Quick Capture) come next — they serialize on
`App.tsx` (each adds a view or top-level state hook), so batch their App.tsx state into one
coordination pass, then parallelize their disjoint UI. The StatusBar live-data follow-up
(`2026-06-03-statusbar-live-data-wiring`) is independent and can run anytime.
