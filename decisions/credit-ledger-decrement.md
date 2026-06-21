---
status: ACTIVE
decided-in: wave-34
promoted-during: wave-34-ai-assistant-foundation
---

## Context

Prepaid monthly allowance with top-ups, no overage billing, no surprise charges; output tokens are unknowable pre-send.

## Pick

Launch allowance = 1,000,000 units ($10.00 API value) per month (tunable constant). Reserve-then-reconcile, **max_tokens-bounded** (review amendment): every request carries a per-verb `max_tokens`; reserve = input estimate (local chars/4 heuristic — no `count_tokens` round-trip on the hot path) + `max_tokens` × output rate; reconcile from Anthropic's actual `usage` is refund-only — balance cannot go negative. Monthly reset (`balance := allowance`) on `subscription_payment_success`; top-ups `+=` on pack `order_created`; `subscription_expired` freezes (session refusal, balance preserved). Webhook handler is upsert-shaped so out-of-order delivery converges; idempotency via the existing `webhook_events` ledger. Per-license rate cap in the proxy (review amendment: credit gating alone doesn't stop burst abuse). Token-accurate credits chosen over flat request caps (review challenge, justified): verb cost profiles differ >10×, and flat caps are either stingy or margin-losing; the UI hides the math (meter, not numbers).

## Rationale

(Embedded in Pick section above.)

## Consequences

A chargeback after reset can leave granted credits — accepted at launch scale, revisit with volume.

## Enforcement

Seam tests: non-negative invariant, out-of-order convergence, rate-cap refusal, 429 shape.
