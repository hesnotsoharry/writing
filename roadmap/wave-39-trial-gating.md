---
status: SHIPPED
created: 2026-06-13
handed-off: 2026-06-14
shipped: 2026-06-14
merged_to_master: true
---
# Wave 39 — Trial AI Gating (dollar-allowance + abuse caps)

Result: Phases 1–3 implemented and unit/integration-verified (commits 928c460, 77cbce7, de13de4); merged in the launch batch at `48d3130`. Delivered: schema migration `0006_trial_ai.sql` (trial status + budget/IP counter tables + 3 atomic RPCs), worker trial path (`trial-session.ts` + chat/balance status-branch + dual-429), and app trial wiring (lazy first-use mint, re-exchange, existing `computeUsedPct`/`aiMeterStatus` meter reuse). Pre-merge gates: root tsc 0 / lint 0 / 1404 tests; marketing tsc 0 / 219 tests. Wave-end adversarial panel (3×) returned FLAG-no-BLOCK: SQL atomicity, fail-closed reserve guard (IP_HASH_SECRET missing → 500), all four `status='active'`→`'trial'` gate openings, and token safety confirmed; finding [A] (empty HMAC key) fixed before merge; findings [B] (global-cap 429 copy), [C] (stale token on mid-session activation), [D] (UTC-midnight refund edge) handed to fast-follow. Phase 4 (CDP trial-abuse smoke) remained open as a Cole-owned acceptance gate.

Promoted: [decisions/0014-trial-identity-server-minted-key.md](decisions/0014-trial-identity-server-minted-key.md) · [decisions/0015-trial-abuse-defense-spend-cap.md](decisions/0015-trial-abuse-defense-spend-cap.md)
Follow-up filed: [follow-ups/2026-06-15-turnstile-captcha-hardening.md](follow-ups/2026-06-15-turnstile-captcha-hardening.md)
