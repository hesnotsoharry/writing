---
status: OPEN
created: 2026-06-08
qualifying-criterion: multi-file
cannot-be-cleared-by: sonnet-implementer-dispatch
present-harm: K3 — data-corruption on the binder-context-menu open-history-on-non-active-scene path. Found by adversarial review (Codex adversarial-54) on both P2 impls 2026-06-07. Restore is bound to the ACTIVE scene's ctx/doc, so restoring a snapshot for a scene opened via the binder context-menu (when a DIFFERENT scene is the active editor) auto-snapshots and writes the restored content into the WRONG (active) scene.
---

# Follow-up: Snapshots cross-scene restore corruption

## Context

Wave 28 P2 shipped the Snapshots feature (version history overlay, snapshots list, restore button). However, the restore operation has a data-corruption bug on a specific (but real) edge path: when a user opens a scene's history via the binder context-menu while a different scene is the active editor, the restore operation writes the snapshot content into the currently-active scene instead of the intended scene.

## Issue

The restore path (`App.snapshots.ts`) binds to `ctx` (the current active scene context) and `doc` (the active scene's Y.Doc). When history is opened for a scene **not currently active in the editor**, the restore button's handler still mutates the active scene's doc, not the intended scene's doc.

**Reproduction:**
1. Open scene "A" in the editor (active).
2. Right-click scene "B" in the binder → "Open version history".
3. History overlay shows scene "B"'s snapshots.
4. Click Restore on an old snapshot.
5. Result: the restored snapshot content lands in scene "A" (the active editor), not scene "B". Data loss for scene "A".

This is a **pre-existing bug from wave-27's restore wiring** (not introduced by P2 — P2 only ported the CSS and UI). The normal flow (title-bar ↺ entry or inspector "open version history" with the intended scene already active) is SAFE.

## Fix

The restore handler must:
1. Load the target `historySceneId`'s doc from the database (not use the active `ctx.doc`).
2. Apply the snapshot content to that doc (not to the active doc).
3. Baseline the same logic for snapshot creation to ensure symmetry.

Multi-file changes:
- `src/App.snapshots.ts` — restore handler wiring
- `src/db/snapshotStore.ts` (or calling site) — load the intended scene's doc by `historySceneId`
- Tests to verify the binder-context-menu path restores to the correct scene

## Suggested resolution

Wave post-28: dispatch a sonnet-implementer with a clear brief: "Fix snapshots restore to use the intended scene's doc, not the active scene's doc. Verify the binder-context-menu restore path (scene opened via context-menu while a different scene is active) writes to the correct scene."

---

*Qualified from wave-28 follow-up candidates. Multi-file fix, data-corruption harm, not clearable by single dispatch.*
