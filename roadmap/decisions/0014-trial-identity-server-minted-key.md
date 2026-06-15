---
id: 0014
status: ACTIVE
decided-in: wave-39
promoted-during: wave-50
---

# Decision 0014: Trial identity — server-minted opaque key → synthetic `subscriptions` row

**Context:** An account-less trial user has no credential the worker recognizes (all metering keys depend on `license_key`). The design must establish identity for trial sessions without requiring account creation.

**Pick:** The worker mints an opaque `trial_<uuidv4>` key on first grant and inserts a synthetic `subscriptions` row (`status='trial'`, `credits_balance = credits_monthly = TRIAL_ALLOWANCE`). The existing HMAC session token wraps that key verbatim with no `ai-token.ts` change. The client stores it as the `aiTrialKey` localStorage tweak.

**Rationale:** Every existing worker path (`verifyToken` → subscriptions lookup → reserve/refund/meter) recognizes the trial row with zero token-layer change, reducing implementation surface. A replayed key drains at most one fixed $1.50 bucket (no amplification risk). The approach is privacy-clean — no device fingerprinting or tracking data needed.

**Consequences:** Trial rows live in `subscriptions` keyed by a `trial_`-prefixed key. The `status='trial'` admission rule must be added to four `status='active'` gates touched by this and subsequent waves (`chat.ts`, `balance.ts`, etc.).

**Enforcement:** Enforced mechanically at the `subscriptions` lookup sites (`chat.ts`, `balance.ts`) and the new `trial-session.ts` mint path. Advisory-only at the doctrine layer (no hook or gate mechanism enforces the pattern across future waves — it relies on code review discipline).
