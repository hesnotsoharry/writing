---
status: OPEN
created: 2026-06-03
source: screen-port-batch
qualifying-criterion: schema
cannot-be-cleared-by: sonnet-implementer-dispatch
present-harm: K2 — binder scene rows lack the design's status-color affordance shown in design-reference/binder.jsx:50 (span.scene-dot driven by STATUS_META, design-reference/data.jsx:128–134); the .scene-dot CSS class exists unused at src/styles/app.css:228.
---

# Follow-up: binder-scene-status-dots

Scene rows in the binder should display a colored status dot (`.scene-dot`) indicating the scene's status (draft, final, etc.), but no status data is present in the current schema.

Wiring this requires:
1. A new `status` column on the `scenes` table (schema migration, `ALTER TABLE`).
2. An update to the `Scene` interface in `src/db/binderStore.ts`.
3. Updates to `loadProject` SELECT + `createScene` INSERT to handle the status field.
4. A `setStatus` callback threaded from App.tsx through Binder to per-row handlers.
5. Per-row rendering of `<span className="scene-dot" data-status={scene.status}>`.

This is a multi-file, schema-touching feature that cannot be cleared by a single sonnet-implementer dispatch. Wave-7 (Binder port) explicitly deferred this because `src/db/` is frozen for the screen-port batch.

## Design reference

`design-reference/binder.jsx` line 50: the `.scene-dot` span.
`design-reference/data.jsx` lines 128–134: the status enum and color mapping (draft, final, etc.).

The CSS class is defined at `src/styles/app.css` line 228 (unused).

## Suggested resolution path

Feature wave owning "Scene metadata" (status + other properties). Depends on a post-screen-port schema migration pass. Pairs naturally with scene-status-indicators throughout the app (Inspector, Story Bible, etc.).
