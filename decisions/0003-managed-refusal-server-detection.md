---
status: ACTIVE
decided-in: wave-52
promoted-during: wave-52
---

## Context

A managed content-policy refusal (Anthropic moderating at input) must be distinguished from billing, overload, or network failures so the app can nudge the user toward BYOK/local instead of showing a generic error. Where is that distinction observable?

## Pick

Detect server-side in the proxy `marketing/functions/api/ai/chat.ts:264` (`!res.ok` branch) — the only place the upstream HTTP status and body coexist — and emit a new `content-blocked` `NormalizedEvent` (extend the union + client switch). Build defensively (HTTP 400/403 + content-policy markers) and log the raw upstream body; live confirmation of the exact Anthropic shape is deferred to a real blocked request.

## Rationale

The proxy today collapses all non-ok upstream responses into one generic error event, erasing the signal; the client never sees the status. There is exactly one catch point. A new event type (vs. overloading `"error"` with a reason field) keeps the client switch explicit and the refund path untouched.

## Consequences

Wave crosses into `marketing/` (server); gates are test+tsc only. `NormalizedEvent` union + the `AssistantPanel.hooks.ts` switch both gain a member. The defensive parser may need a one-line tightening after the first real refusal body is logged.

## Enforcement

Asserted by Phase 5 server + client unit tests (policy-400→content-blocked+refund; non-policy-400→generic error). Live confirmation via post-deploy server log of real blocked request.
