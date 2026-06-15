---
status: OPEN
created: 2026-06-15
qualifying-criterion: cross-package
cannot-be-cleared-by: single sonnet-implementer dispatch — requires Phase-0 WebView2-render spike + system-browser/deep-link fallback design; coordination across worker/app/Cloudflare dashboard
present-harm: K1 — during the Reddit launch surge, with no CAPTCHA on the trial-mint endpoint `/api/ai/trial-session`, a single automated script can drain the global $25/day trial budget early each day and DoS real trial-users out of AI (the conversion lever W39 exists to create). Named evidence: W39 design attack-decision review (2026-06-13, Angle 2/6 — tested the "attacker isolates VMs to drain the budget" scenario before decision-review; result: the global cap bounds dollars but offers no budget-monopoly protection without CAPTCHA).
---

# Follow-up: Turnstile/CAPTCHA hardening on trial-mint endpoint

## Context

Wave 39 shipped trial-gating (trial users get a $1.50 free allowance of AI, bounded by a global $25/day cap and per-IP grant limit). The design trade-off at the time (Cole-locked scope decision, 2026-06-13) was to ship the **global daily spend ceiling** as the hard dollar ceiling (bounding the worst-case exposure), and to **defer Turnstile CAPTCHA** to a fast-follow wave. The global cap mathematically bounds exposure; Turnstile adds a secondary **budget-monopoly protection** (one attacker's reinstall/Sybil farming cannot monopolize the entire $25/day budget and starve other users out).

## Issue

**Current state:** the trial-mint endpoint `/api/ai/trial-session` mints free trial keys with only a **per-IP daily grant cap** (3 per IP per UTC day via salted `HMAC(CF-Connecting-IP)`) and a **global daily spend ceiling** ($25/day). Both are effective, but neither prevents a sophisticated attacker from:

1. Spinning up isolated VMs with distinct public IPs (possible at cloud providers).
2. Exhausting 3 trials per VM per day.
3. Draining the global $25 budget early each UTC day, leaving zero allowance for legitimate users trying the feature during a Reddit launch surge.

The per-IP grant cap assumes each IP represents one user; with VMs, cost of acquiring distinct IPs is cheaper than the cost of the trial compute itself.

## Why this is a follow-up and not Phase 0 inline

Shipping Turnstile (or an equivalent CAPTCHA) on the trial-mint path requires:

1. **Phase-0 spike:** Investigate WebView2 CAPTCHA rendering (Turnstile/hCaptcha/reCAPTCHA) within the Tauri shell. The Turnstile/reCAPTCHA JavaScript client runs in a browser context; Tauri's WebView2 must handle it, but the integration needs validation. A fallback path (system browser with deep link) may be required if WebView2 doesn't render correctly.

2. **Worker endpoint change:** Add a Turnstile verification step (server-side verification with Cloudflare's API) before the `grant_trial` RPC fires.

3. **App UI:** Display a CAPTCHA challenge before the mint completes (if WebView2 supports it directly) or redirect to system browser (fallback).

4. **Cloudflare Pages configuration:** wire the Turnstile site key + secret into the Pages environment (settings, not source-controlled).

5. **Testing strategy:** verify the challenge works in both dev (local worker) and production (Pages).

This is **cross-package** (Tauri shell + worker + Cloudflare) and **not mechanically implementable** without the Phase-0 WebView2 integration answer.

## Why this matters

The Reddit launch will drive a traffic spike. Trial AI is the conversion lever — the entry point for users to try AI at no cost. If the $25/day budget exhausts on day 1 due to a budget-monopoly attack, real users see a 429 error and never get to try; the cohort's conversion rate tanks. The per-IP grant cap alone is insufficient.

## Suggested approach

1. **Phase 0:** WebView2 CAPTCHA rendering spike. Attempt to render Turnstile in the trial-mint flow via WebView2 JavaScript. If blocked/broken, implement system-browser fallback (deep link to a Cloudflare-hosted CAPTCHA page, return key via URL param or clipboard).

2. **Phase 1:** Worker endpoint + RPCs. Add a `verify_captcha(token: string) -> bool` check in `trial-session.ts` before calling `grant_trial`.

3. **Phase 2:** App UI. Wire the CAPTCHA challenge into the trial-mint flow (Phase 1's Phase 0 result determines implementation).

4. **Phase 3:** Cloudflare Pages config. Register Turnstile site key + secret.

5. **Testing:** dev-local worker + Pages preview confirm the challenge fires and valid tokens are accepted.

---

*Qualified from wave-39 follow-up candidates (present-harm K1 with evidence pointer: design attack-decision review Angle 2/6, dated 2026-06-13). Cross-package (worker/app/Cloudflare). Cannot be cleared by single sonnet-implementer dispatch.*
