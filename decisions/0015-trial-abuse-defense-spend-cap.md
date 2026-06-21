---
id: 0015
status: ACTIVE
decided-in: wave-39
promoted-during: wave-50
---

# Decision 0015: Abuse defense — hard global daily spend cap + per-IP grant cap; CAPTCHA deferred

**Context:** Balancing worst-case dollar exposure against scripted reinstall/Sybil farming attacks, the "no account, no card" product promise, privacy-first positioning (no fingerprinting), and launch-critical path speed. The core tension: automated install/reinstall farming in isolated environments could rack up significant real Anthropic spend.

**Options considered:**
- *Industry standard:* Turnstile + per-IP limit (does not bound dollars; CAPTCHA-solvers and proxies defeat it).
- *Emerging (PICKED):* Add a **global daily trial-spend ceiling** enforced atomically at credit-reserve, with Turnstile + per-IP repositioned as budget-monopoly protection for later.
- *Cutting-edge:* Proof-of-work / Privacy Pass (overkill for a $1.50 trial; no marginal dollar-bound benefit).

**Pick:** Ship the **global daily spend cap** ($25/day = 2,500,000 units) as the hard dollar ceiling, plus the **per-IP daily grant cap** (3/IP/UTC-day via salted `HMAC(CF-Connecting-IP)`), plus a `TRIAL_AI_ENABLED` kill-switch — all server-side and atomic. **DEFER Turnstile** to a fast-follow wave — it carries the only WebView2-render risk and adds friction to a no-account product; the global cap already bounds dollars without it.

**Rationale:** The global cap mathematically bounds total trial AI spend to $25/day regardless of how many keys, IPs, or VMs an attacker creates — every trial reserve passes through the one shared `trial_budget(day)` counter. Turnstile's only added value (protecting legit users from budget-monopoly) is a fast-follow concern, not a dollar-exposure concern.

**Consequences:** Worst-case trial AI exposure is **$25/day (~$750/month), hard**. When a day's budget exhausts, NEW trials that day hit a budget-429 error (existing trial holders and all non-AI features remain unaffected; the budget resets daily; the kill-switch is the manual override). Reserve-vs-actual accounting tracks actual spend on refund, so the cap is hard modulo the documented sub-cent cache-write-premium under-count.

**Enforcement:** Enforced mechanically at `reserve_trial_credits` (global ceiling, atomic), `grant_trial` (per-IP), and the `TRIAL_AI_ENABLED` environment variable (kill-switch). These are the three RPCs and the endpoint control points in the worker.
