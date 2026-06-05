---
status: ACTIVE
decided-in: wave-m4
promoted-during: wave-m4
---

## Context

A mark-then-act ordering (write ledger, then side effect) silently drops events: if a side effect fails transiently after the ledger commits, the upstream retry hits the ledger guard and the side effect is never applied. Applies to webhook handlers in the marketing backend and any future event consumer.

## Pick

Act-then-mark: apply the idempotent **idempotent write** (e.g., purchases upsert) FIRST, then write the dedup ledger AFTER. The ledger gates exactly-once non-idempotent effects (e.g., emails), not the idempotent write. Reject nullish or empty `order_id` (400) before any write.

## Rationale

The idempotent write (upsert on a natural key like `order_id`) produces the same end state on every apply, so re-applying on retry is harmless. This removes the lost-event window inherent to mark-then-act. Standard idempotent-consumer pattern.

## Consequences

The idempotent write may run more than once per order across retries — always yielding the same state. Non-idempotent effects (like email sends) MUST gate on the first-time ledger insert to avoid duplicates.

## Enforcement

Advisory-only. Acceptance tests assert: replay of an event produces `ledgerInserts === 1` (deduped) with `purchaseWrites === 2` (idempotent re-application harmless); nullish `order_id` rejects with 400 + no writes.
