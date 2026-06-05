---
project: writing
updated: 2026-06-04
---

## Current state
- Branch/trunk: **`master`** (HEAD `bbca8cf`). `main` is a stale git default — do NOT use it.
- **Wave 25 (canon-cleanup, 8 phases) SHIPPED to master**, AND the 3 parallel feature lanes are all
  **merged + integrated**: Wave 22 Archive, Wave 23 Export, Wave 24 Full-Entry. Gates: lint+tsc clean,
  **753/753 tests**. (Plans: `roadmap/wave-25-canon-cleanup.md`, `roadmap/batch-2-coordination.md`.)
- **Wave 26 (canon-bugfix) IN PROGRESS** — fix-sweep from Cole's first live `tauri dev` smoke (2026-06-04).
  Plan: **`roadmap/wave-26-canon-bugfix.md`** (9 phases, gates A/B/C PASS). **P1 ✅, P2 ✅. P3–P9 remain.**
  - P1 `ee1aeab` — blank-but-visible side panels fixed (AppShell elides panel WRAPPERS, not just slots).
  - P2 `bbca8cf` — scene `word_count` now persisted on save + **backfilled on project load** (from
    `scene_docs.plaintext_projection`); fixes the manuscript-total-shows-current-scene bug AND per-scene 0s.
- This session = merge-master + wave execution; context filled → handed off mid-Wave-26.

## Next 3 steps (resume Wave 26 at Phase 3)
1. **Read `roadmap/wave-26-canon-bugfix.md`** (Plan + `## Status` rows + `## Locked decisions`). Execute
   **P3→P9** via the **`run-phase` Workflow** (`Workflow({name:"run-phase", args:{waveFile, phaseId, waveId:"wave26",
   reviewTier, priorCommitSHA:<git rev-parse HEAD before phase>, declaredFiles, briefText}})`), one phase per
   dispatch, chained when gate green. **Diagnose-first** on **P4 (corkboard DnD)** — model the fix on the
   binder's working `@dnd-kit` drag (`src/binder/BinderCrud.tsx`); the current drag previews then snaps back.
2. **Per phase:** adjudicate the returned verdict; dispatch a `sonnet-implementer` fixer (background) for
   the *real* FLAGs, then commit. NOTE: the run-phase impl **sometimes self-commits** (check `git log` after
   each) — if it didn't, the orchestrator commits (exclude the recurring `src-tauri/Cargo.toml` CRLF churn).
   Remaining phases: P3 binder (quick-notes bottom-pin + empty-state blank gap), P4 corkboard DnD+reorder,
   P5 inspector (synopsis edit-box clay + linked-entity chip → `openEntry`), P6 editor right-click menu +
   Export modal → canon (`design-reference/dialogs.jsx`/`menu.jsx`), P7 story-bible cards (white
   "Character/Location Sketch", right-click-only menu, **editable+linked role**), P8 full-entry (+Add field,
   detail-box overlap, char→scene/char→location/location→scene links), P9 trivial Rust `_app` (skip-tier, haiku).
3. **After P9:** wave-end full gates + adversarial wave-review + `/review`, then **Cole re-smokes the whole
   batch**. The wave-wrap (HANDOFF stub-collapse / decision-promote / vendor-gotcha) + **worktree cleanup
   (lanes 18–24 branches/worktrees, all merged)** are **PARKED until after Cole's final smoke confirms.**

## Active work / important context
- **DEFERRED — do NOT touch this wave:** goals (task #37 — pending Cole's designer; he's designing the goal
  management UX now, we wire after) · Settings "Backup & data" section (#36 — future backup wave w/ the
  Cloudflare R2 infra Cole is provisioning) · Export rich-text + native Save-As (#25 — Export ships on the
  blob-download fallback; modal styling IS in W26 P6).
- **Wave 26 Locked decisions:** D1 = goals+backup out of scope. D2 = role + custom detail-fields reuse
  Lane 24's `entity_fields` (reserved `key="role"`), **NO new migration**.
- **Smoke watch-items** (for Cole's next smoke; fix only if they bite): page-flip X-slide clip → move leaf
  mount to `.canvas-pane`; portrait-pick read-permission → `fileAccessMode:'copy'` or scoped
  `fs:allow-read-file`; double `.panel-binder`/`.panel-inspector` class (component nav + AppShell wrapper) —
  likely harmless.
- **P2 leftover (minor):** backfill covers only the startup-active project (multi-project switch backfills
  on switch) — acceptable; revisit if multi-project becomes prominent.
- Untracked at root: dead `*.ps1` scratch; Cole's `marketing/`, `roadmap/go-to-market.md`,
  `roadmap/launch-infra-checklist.md` (his — leave). `Cargo.toml` CRLF churn recurs (gitattributes follow-up).
- Task tracker holds the cluster state: **#26–35 = Wave 26 items** (#26/#27 done), #36/#37 deferred, #25 export follow-up.

## Reference index
- Wave 26 plan: [wave-26-canon-bugfix.md](wave-26-canon-bugfix.md) · Wave 25: [wave-25-canon-cleanup.md](wave-25-canon-cleanup.md)
- Lanes coordination: [batch-2-coordination.md](batch-2-coordination.md) · prior sweep: [canon-polish-coordination.md](canon-polish-coordination.md)
- Canon design source: `design-reference/*.jsx` + `FULL-ENTRY-SPEC.md` + `app.css`/`tokens.css`
- Decisions: [decisions/](decisions/) · Build: `npm run tauri dev` · Test: `npm run test` · Lint: `npm run lint:fix`
