---
status: RESOLVED
resolved-during: followups-ui-batch
created: 2026-06-03
updated: 2026-06-13
qualifying-criterion: multi-file
cannot-be-cleared-by: sonnet-implementer-dispatch
---

# Follow-up: App detection-wiring has no automated coverage

## Context

Wave 3 completed the core detection logic (detectEntities matcher, detection sync service, scene inspector, Story Bible view) with full unit and cross-boundary test coverage. However, the App-level **integration wiring** in `src/App.detection.ts` — specifically the reactivity glue connecting scene saves and entity mutations to the detection rescan pipeline — is verified only by manual smoke testing. No automated test harness exists at the App level.

## Issue

- **`onSaved` → `linkScene` → `linksVersion` → inspector re-read:** relies on App.tsx lifted state propagation
- **`onEntitiesChanged` → `rescanProject` → re-read:** relies on App-state mutation triggering re-renders

These wiring paths are **not covered by unit or integration tests**. The glue is correct (smoke confirmed), but future refactors or prop-drilling changes could silently break the reactivity without test failure.

## Why this is a follow-up and not Phase 0 inline

Building an App-level integration test harness requires:
1. A mocked SQLite environment (DB writes/reads without touching the real file system)
2. An RTL render of `App.tsx` (already using RTL in phases 5–6, but not for the full App)
3. Orchestration of multiple render cycles (scene save → detection runs → inspector updates)

This cannot be cleared in a single sonnet-implementer dispatch — it requires **designing and scaffolding a new cross-boundary test harness** (multi-file, new testing infrastructure). The logic is verified; the wiring test infra is the missing piece.

## Suggested approach

Draft a test harness in `src/test/appDetectionIntegration.test.tsx` that:
- Mocks the SQLite stores (or uses `InMemoryStoryBibleStore` + `InMemoryBinderStore` + in-memory `sceneDocStore` fake)
- Renders App with a test project + scenes
- Creates/saves scenes with prose containing entity names
- Verifies the inspector panel reflects detected entities without manual polling
- Covers entity add/rename/delete scenarios driving rescans

This is a **new testing infrastructure** and belongs in a future wave.

---

*Audited during wave-3-scene-notes wrap; identified as multi-file integration harness that cannot be cleared by a single implementer dispatch.*

## Resolution (2026-06-13)

Closed by orchestrator mechanical audit on 2026-06-13.
Evidence: Covered by `src/test/appDetectionIntegration.test.tsx` (prior wave); `useDetectionWiring` onSaved/onEntitiesChanged paths both tested.
