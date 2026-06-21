---
status: ACTIVE
decided-in: wave-33
promoted-during: wave-33-free-trial
---

## Context
Trial trust model — local clock vs server-issued trial keys.

## Pick
Local-only: trial record in the app's own SQLite DB.

## Rationale
Trial clock shares the DB with the user's manuscripts — wiping it to reset the trial deletes their writing, an unusually strong natural deterrent. Server trials add issuance/validation endpoints + offline handling against a threat that doesn't exist for this product. Cole ratified 2026-06-11.

## Consequences
A determined user with a SQLite editor can reset the trial; accepted.

## Enforcement
none (convention)
