---
status: ACTIVE
decided-in: wave-52
promoted-during: wave-52
---

## Context

The "never send to AI" toggle is session-local `useState` (`AssistantPanel.tsx:331`) and characters/locations hardcode `exclude_from_ai:false` — it resets each launch and cannot exclude characters/locations at all.

## Pick

New migration adding `exclude_from_ai INTEGER NOT NULL DEFAULT 0` to `characters` and `locations` tables (mirroring the existing `entities` column at `migrations2.ts:203`); store reads select the column; a new `setEntityExclusion` method persists the toggle.

## Rationale

The column already exists and is read correctly for generic entities; extending the same shape to characters/locations is the minimal, consistent fix. Persisting at toggle time matches how the rest of the store works and establishes the schema pattern for entity-level feature flags.

## Consequences

New migration requires running the full test suite (appended migrations break prior migration tests via hardcoded LATEST + partial seed fixtures). `sqliteSetEntityExclusion` free-fn routes writes by type; `rowToEntity` read-path surfaces the real flag.

## Enforcement

Asserted by the Phase 4 acceptance test + full-suite green. Runtime confirmation: toggle a character/location "never send to AI", close + relaunch, verify toggle persists.
