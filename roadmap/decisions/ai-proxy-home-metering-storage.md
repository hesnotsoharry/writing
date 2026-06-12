---
status: ACTIVE
decided-in: wave-34
promoted-during: wave-34-ai-assistant-foundation
---

## Context

Where the managed-tier proxy and credit state live; product previously assumed "no backend," but a Pages Functions + Supabase backend already exists.

## Pick

New endpoints under `marketing/functions/api/ai/` in the existing Pages Functions deploy; Supabase Postgres is the metering source of truth (`subscriptions` PK `license_key`, `credit_events` ledger). No KV/D1/Durable Objects.

## Rationale

Pages Functions ARE Workers (research sidecar); SSE passthrough works; one deploy pipeline (push = deploy); Postgres atomic `UPDATE … RETURNING` is a sound decrement primitive; KV's eventual consistency is unsafe for metering. Separate `api/ai/` file tree isolates blast radius from checkout.

## Consequences

Every AI request makes a Supabase round-trip; acceptable at launch scale. Credit unit (1 unit = $0.00001) documented in schema comments + a shared constant (review amendment: self-documenting unit).

## Enforcement

Phase 1/2 seam tests in `marketing/functions/`; acceptance criteria above.
