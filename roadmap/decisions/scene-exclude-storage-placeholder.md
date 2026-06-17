---
status: ACTIVE
decided-in: wave-53
promoted-during: wave-53
---

## Context
Need persistent scene-level "don't send to AI" flag and a withheld-content placeholder to extend W52's per-passage/per-entity privacy pattern to whole-scene granularity.

## Pick
Migration #19 adds `exclude_from_ai INTEGER NOT NULL DEFAULT 0` to the `scenes` table (mirrors W52 entity migration #18 — `ensureColumn` + PRAGMA guard, idempotent). Scene-level placeholder string: `"[this scene was withheld by the author]"` (distinct from W52's passage-level `"[passage hidden by author]"` for clarity).

## Rationale
Matches the established W52 column pattern; a distinct placeholder tells the model a whole scene (not a passage) was withheld. Reinforces the security-critical chokepoint that `assembleContext` remains the sole prose serializer.

## Consequences
Commits to a new scenes column + a second placeholder constant. The setter and the assembleContext read both need the new column. Security gate fires on all AI paths (managed + 3 BYOK + extra-scene-excerpt).

## Enforcement
advisory-only (unit test asserts assembleContext substitutes the placeholder when flag set, across all AI paths).
