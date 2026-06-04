---
status: OPEN
created: 2026-06-03
source: screen-port-batch
qualifying-criterion: multi-file
cannot-be-cleared-by: sonnet-implementer-dispatch
present-harm: K1 — the Inspector's add-character / link-character / synopsis-edit buttons render per the design but are inert (no onClick handlers); user can press them with no effect. Verifiable at smoke 2026-06-03: src/inspector/SceneInspector.tsx renders interactive buttons without backing handlers (wave-9 follow-up candidates, line 120–121).
---

# Follow-up: inspector-entity-interactions

The Inspector's interactive affordances (EntityCard edit/delete buttons, entity-group "+" add-character/add-location buttons, synopsis edit button) render per the design-reference but carry no `onClick` handlers this wave. They front the entity-link picker and synopsis-edit features, which are unbuilt (new UI primitives, multi-wave).

Wiring these requires:
1. A link-picker UI primitive (new component, new modal state in App or Inspector).
2. A synopsis-edit inline-edit or modal flow (new state, new form/input component).
3. Store calls to wire the actual link creation / deletion / synopsis update.
4. Threading the store `updateEntity` / `createSceneLink` / `deleteSceneLink` callbacks into the Inspector.

This is a multi-file, multi-step feature that cannot be cleared by a single sonnet-implementer dispatch.

## Design reference

`design-reference/inspector.jsx` lines 55–88: the interactive buttons and their contexts (edit icon per EntityCard, "+" buttons per entity group, edit icon on synopsis).

## Suggested resolution path

Future feature wave owning "Inspector interactivity" (entity-link picker + synopsis editing). Depends on the UI-primitive design and the App.tsx threading discipline. Likely a Tier-2 wave after Corkboard/Settings/Quick Capture.
