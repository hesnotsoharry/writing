---
status: ACTIVE
decided-in: wave-35
promoted-during: wave-35-assistant-redesign-port
---

## Context

Phase G grounding found NO credit-balance endpoint — the panel meter ran on stub data (usedPct=0). Cole chose "Full billing now (pull 36 work in)" over deferring to wave 36. The client needs balance/allowance/reset/status, and the explorer surfaced two delivery options: extend `/api/ai/session` vs a dedicated read endpoint.

## Pick

Dedicated `GET /api/ai/balance` (authed with the session bearer token) returning `{ creditsBalance, monthlyAllowance, resetAt, status }`; client fetches on panel mount + after each `done` event. Renew/Top-up buttons open the EXISTING test-mode LS checkout/portal URLs via the Tauri opener (live-variant swap stays a wave-36 Cole-gated flip).

## Rationale

Refreshable without re-running session auth; keeps session-exchange single-purpose; matches REST convention; `monthlyAllowance` in the response avoids a hardcoded client denominator (server-only `MONTHLY_ALLOWANCE`). Test-mode checkout URLs are reversible; the real-money flip is explicitly NOT in this wave.

## Consequences

Wave 35 now owns the billing data path + guardrail wiring; wave 36's billing remainder shrinks to the irreversible flips (live LS variant IDs, live webhook, real Resend) + marketing pages.

## Enforcement

Phase G acceptance tests (balance contract + meter mapping + reset-date fixes); checkout buttons point at test-mode variants until the wave-36 live flip.
