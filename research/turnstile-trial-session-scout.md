# Scout Memo: Cloudflare Turnstile for `/api/ai/trial-session`

> **Date:** 2026-08-21  
> **Status:** Research & Scoping (Read-Only Scout)  
> **Target:** Cloudflare Turnstile Bot Protection on AI Free-Trial Grant  
> **Repository:** `C:\Web App\writing` (WritersNook)

---

## Executive Summary

The `/api/ai/trial-session` endpoint hands out synthetic trial subscriptions ($1.50 API allowance = 150,000 credit units) without requiring user accounts or credit cards. Today, abuse is bounded server-side by a global daily trial spend cap ($25.00/day = 2,500,000 units), a per-IP daily grant cap (3 grants/IP/UTC-day), and an environment kill-switch (`TRIAL_AI_ENABLED`). There is **zero bot protection or CAPTCHA** on trial issuance.

This memo scopes adding Cloudflare Turnstile to `/api/ai/trial-session`. The critical architectural tension is **deployment synchronization**: pushing to `master` auto-deploys Cloudflare Pages Functions in ~60 seconds, whereas the desktop app (Tauri 2 / React 19) is distributed to installed user machines (v0.12.6 released, v0.12.7/0.12.8 in development) and updates asynchronously via GitHub Releases. A hard Turnstile enforcement on `master` would instantly break trial AI for every existing desktop client in users' hands. A phased rollout (permissive/flagged Worker → desktop client update release → enforced Turnstile) is required.

---

## 1. Endpoint Today

The handler for `/api/ai/trial-session` is located at [`marketing/functions/api/ai/trial-session.ts`](file:///C:/Web%20App/writing/marketing/functions/api/ai/trial-session.ts#L1-L119).

### End-to-End Request Flow
The endpoint exposes `onRequestOptions` ([`trial-session.ts:30-32`](file:///C:/Web%20App/writing/marketing/functions/api/ai/trial-session.ts#L30-L32)) for CORS preflight and `onRequestPost` ([`trial-session.ts:34-118`](file:///C:/Web%20App/writing/marketing/functions/api/ai/trial-session.ts#L34-L118)). It parses JSON matching `TrialSessionBody` (`{ trialKey?: unknown }`, [`trial-session.ts:22-24, 39-43`](file:///C:/Web%20App/writing/marketing/functions/api/ai/trial-session.ts#L22-L24)):

```
                             POST /api/ai/trial-session
                                        │
                         Is body.trialKey present & non-empty?
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼ (YES)                                       ▼ (NO)
         [RE-EXCHANGE PATH]                             [FIRST GRANT PATH]
      trial-session.ts:45-70                         trial-session.ts:72-117
                 │                                             │
  1. Select from subscriptions where            1. Check TRIAL_AI_ENABLED === "true"
     license_key = trialKey (lines 47-51)          (lines 73-77, 403 if disabled)
  2. Verify status === "trial" (lines 56-58)    2. Validate IP_HASH_SECRET is set
     (401 if missing or not 'trial')               (lines 81-88, 500 if missing)
  3. Mint fresh HMAC token via                  3. newKey = "trial_" + randomUUID() (line 80)
     buildToken(trialKey, secret) (line 62)     4. Read CF-Connecting-IP (line 89)
  4. Return 200:                                5. ipHash = hashIp(ip, secret) (line 90)
     { trialKey, token, expiresAt } (lines 66-69) 6. db.rpc("grant_trial", { ... }) (lines 92-97)
  * NO grant_trial RPC call                     7. If grantData === null → 429 trial_ip_capped (line 100)
  * NO new budget spent                         8. Mint HMAC token via buildToken(newKey, secret) (line 109)
                                                9. Return 200:
                                                   { trialKey, token, expiresAt, allowance: 150000 }
```

### What It Writes to Storage
On First Grant, the handler invokes the Postgres function `grant_trial` ([`marketing/supabase/0006_trial_ai.sql:132-174`](file:///C:/Web%20App/writing/marketing/supabase/0006_trial_ai.sql#L132-L174)) in a single atomic transaction:
1. **`trial_ip_grants` counter table** ([`0006_trial_ai.sql:58-63, 147-157`](file:///C:/Web%20App/writing/marketing/supabase/0006_trial_ai.sql#L58-L63)): Upserts `(ip_hash, CURRENT_DATE)` and increments `grant_count` only `WHERE grant_count < p_ip_cap` (3). If cap is exceeded, returns `NULL` and aborts.
2. **`subscriptions` table** ([`0006_trial_ai.sql:163-164`](file:///C:/Web%20App/writing/marketing/supabase/0006_trial_ai.sql#L163-L164)): Inserts synthetic trial subscription row `(license_key, status = 'trial', credits_balance = 150000, credits_monthly = 150000, ls_subscription_id = NULL)`.
3. **`credit_events` table** ([`0006_trial_ai.sql:167-168`](file:///C:/Web%20App/writing/marketing/supabase/0006_trial_ai.sql#L167-L168)): Inserts audit ledger row `(license_key, event_type = 'grant', delta = 150000)`.

### Existing Anti-Abuse Controls & Enforcement Points

| Control | Limit / Rule | Enforced At | File & Line Citation |
|---|---|---|---|
| **Kill-Switch** | `TRIAL_AI_ENABLED === "true"` required | Worker handler | [`marketing/functions/api/ai/trial-session.ts:73-77`](file:///C:/Web%20App/writing/marketing/functions/api/ai/trial-session.ts#L73-L77) |
| **Salted IP Privacy** | Raw IP hashed via HMAC-SHA256 before storage | Worker handler / Web Crypto | [`marketing/functions/api/ai/trial-session.ts:81-90`](file:///C:/Web%20App/writing/marketing/functions/api/ai/trial-session.ts#L81-L90), [`_lib/ai-token.ts:71-73`](file:///C:/Web%20App/writing/marketing/functions/_lib/ai-token.ts#L71-L73) |
| **Per-IP Daily Cap** | `PER_IP_DAILY_GRANT_CAP = 3` grants / IP / UTC day | Supabase Postgres RPC (`grant_trial`) | [`marketing/functions/_lib/credits.ts:35`](file:///C:/Web%20App/writing/marketing/functions/_lib/credits.ts#L35), [`marketing/supabase/0006_trial_ai.sql:147-157`](file:///C:/Web%20App/writing/marketing/supabase/0006_trial_ai.sql#L147-L157) |
| **Per-Trial Allowance** | `TRIAL_ALLOWANCE = 150_000` units ($1.50) | Supabase DB row balance | [`marketing/functions/_lib/credits.ts:23`](file:///C:/Web%20App/writing/marketing/functions/_lib/credits.ts#L23), [`marketing/supabase/0006_trial_ai.sql:163`](file:///C:/Web%20App/writing/marketing/supabase/0006_trial_ai.sql#L163) |
| **Global Spend Ceiling** | `GLOBAL_DAILY_TRIAL_SPEND_CAP = 2_500_000` units ($25.00/day) | Supabase Postgres RPC (`reserve_trial_credits`) during `/api/ai/chat` | [`marketing/functions/_lib/credits.ts:29`](file:///C:/Web%20App/writing/marketing/functions/_lib/credits.ts#L29), [`marketing/supabase/0006_trial_ai.sql:224-255`](file:///C:/Web%20App/writing/marketing/supabase/0006_trial_ai.sql#L224-L255), [`marketing/functions/api/ai/chat.ts:474-489`](file:///C:/Web%20App/writing/marketing/functions/api/ai/chat.ts#L474-L489) |
| **Chat Rate Limiting** | `RATE_CAP_PER_MINUTE = 20` req/min | Supabase Postgres RPC (`check_rate_limit`) during `/api/ai/chat` | [`marketing/functions/_lib/credits.ts:47-48`](file:///C:/Web%20App/writing/marketing/functions/_lib/credits.ts#L47-L48), [`marketing/supabase/0006_trial_ai.sql:81-119`](file:///C:/Web%20App/writing/marketing/functions/api/chat.ts#L456-L466) |
| **Session Token TTL** | `SESSION_TTL_MS = 4 hours` (14,400,000 ms) | Web Crypto HMAC in Worker | [`marketing/functions/_lib/ai-token.ts:12, 55-65`](file:///C:/Web%20App/writing/marketing/functions/_lib/ai-token.ts#L12) |
| **Re-Exchange Key Check** | `status === 'trial'` required in DB | Worker DB lookup | [`marketing/functions/api/ai/trial-session.ts:47-58`](file:///C:/Web%20App/writing/marketing/functions/api/trial-session.ts#L47-L58) |
| **Bot / CAPTCHA Protection** | **NONE** on `/api/ai/trial-session` | — | **Vulnerability surface: Sybil script cycling IPs can claim $25/day trial budget.** |

---

## 2. Callers and Widget Hosting Feasibility

Every caller across the codebase was searched. There are two actual callers in the repository:

### Caller 1: Desktop App (`src/`)
- **Location:** [`src/features/ai/ai.client.ts:85-93`](file:///C:/Web%20App/writing/src/features/ai/ai.client.ts#L85-L93) in `acquireTrialSession(trialKey?: string): Promise<TrialSessionResult>`.
- **Call Chain:**
  - `acquireTrialSession` is called by `acquireTrialTokenCached(ref)` ([`src/features/ai/ai.trialToken.ts:26, 28`](file:///C:/Web%20App/writing/src/features/ai/ai.trialToken.ts#L26)).
  - `acquireTrialTokenCached` is called by `acquireAnyToken(ref)` ([`src/features/ai/ai.trialToken.ts:60`](file:///C:/Web%20App/writing/src/features/ai/ai.trialToken.ts#L60)) whenever `aiLicenseKey` is empty.
  - `acquireAnyToken` is consumed by `useAiBalance` ([`src/features/ai/AssistantPanel.balance.ts:38`](file:///C:/Web%20App/writing/src/features/ai/AssistantPanel.balance.ts#L38)), `streamAssistantResponse` ([`src/features/ai/AssistantPanel.hooks.ts:252`](file:///C:/Web%20App/writing/src/features/ai/AssistantPanel.hooks.ts#L252)), and Settings AI panel ([`src/features/settings/Settings.ai.tsx:248`](file:///C:/Web%20App/writing/src/features/settings/Settings.ai.tsx#L248)).
- **Exact Request Wire Shape:**
  - First grant: `POST https://writersnook.app/api/ai/trial-session` with headers `{"Content-Type": "application/json"}` and body `{}`.
  - Re-exchange: `POST https://writersnook.app/api/ai/trial-session` with headers `{"Content-Type": "application/json"}` and body `{"trialKey": "<stored_trial_key>"}`.
- **Can Desktop Host a Turnstile Widget?**
  - **Runtime Environment:** Tauri 2 using Microsoft Edge WebView2 on Windows and WebKit WKWebView on macOS.
  - **Origin / Security Context:** In production, the Tauri frontend runs under custom URI origins (`https://tauri.localhost` or `http://tauri.localhost` on Windows; `tauri://localhost` on macOS; in dev `http://localhost:1420`). Tauri's CSP is configured with `"csp": null` ([`src-tauri/tauri.conf.json:25`](file:///C:/Web%20App/writing/src-tauri/tauri.conf.json#L25)).
  - **Technical Feasibility:**
    1. *Direct Widget Script (`https://challenges.cloudflare.com/turnstile/v0/api.js`):* Turnstile is designed for web browsers and checks origin and browser environment. If the widget is configured in Cloudflare to permit `localhost` and `tauri.localhost`, direct rendering inside WebView2/WKWebView is technically possible, but Cloudflare's risk heuristics frequently challenge or fail on non-standard `tauri://` schemes.
    2. *Hosted Challenge Web Page (Recommended Architecture for Desktop):* A clean web page hosted on `https://writersnook.app/turnstile-challenge.html` (or an embedded invisible iframe loading that URL) executes the Turnstile widget within the legitimate `writersnook.app` domain context and posts the solved `cf-turnstile-response` token back to the parent app window via `window.postMessage` or a lightweight callback.
  - **UI / UX Impact:** Currently, `acquireAnyToken` runs **silently and synchronously in the background** when the user opens the Assistant panel. If Turnstile requires an interactive challenge, the UI must have a dedicated activation modal or inline check ("Verify you are human to activate free trial credits") before calling `acquireTrialSession`.

### Caller 2: Mobile App (`mobile/src/`)
- **Location:** [`mobile/src/features/ai/mobileAiClient.ts:112-114`](file:///C:/Web%20App/writing/mobile/src/features/ai/mobileAiClient.ts#L112-L114) in `MobileAiClient.prototype.acquireTrialSession(trialKey: string): Promise<TrialSessionResult>`.
- **Call Chain:** Referenced in [`mobile/src/features/ai/credentialHandoff.ts:53`](file:///C:/Web%20App/writing/mobile/src/features/ai/credentialHandoff.ts#L53) and [`mobile/src/features/ai/credentialHandoff.test.ts:23`](file:///C:/Web%20App/writing/mobile/src/features/ai/credentialHandoff.test.ts#L23).
- **Exact Request Wire Shape:** `POST https://writersnook.app/api/ai/trial-session` with headers `{"Content-Type": "application/json"}` and body `{"trialKey": "..."}`.
- **Can Mobile Host a Turnstile Widget?**
  - **Runtime Environment:** React Native (Expo).
  - **Technical Feasibility:** React Native runs in a headless JavaScript engine (Hermes/JSC) with **no HTML DOM or browser window**. It **CANNOT** directly execute `challenges.cloudflare.com/turnstile/v0/api.js`.
  - **Required Changes:** To run Turnstile in React Native, the app must load a web page via `react-native-webview` or an in-app browser pointing at `https://writersnook.app/turnstile-challenge.html`, obtain the token via the WebView bridge, and pass it to `acquireTrialSession`.
  - **Status Note:** Mobile is in Phase 2 development and not yet shipped to app stores ([`CLAUDE.md:8-10, 106-110`](file:///C:/Web%20App/writing/CLAUDE.md#L8-L10)).

### Caller 3: Marketing Website (`marketing/public/`)
- **Audit Findings:** No file under `marketing/public/` calls `/api/ai/trial-session` or any `/api/ai/*` endpoint.
- **Other Public Endpoints:**
  - `POST /api/contact` ([`marketing/functions/api/contact.ts:19`](file:///C:/Web%20App/writing/marketing/functions/api/contact.ts#L19), called by [`marketing/public/contact.html:205`](file:///C:/Web%20App/writing/marketing/public/contact.html#L205)).
  - `POST /api/newsletter` ([`marketing/functions/api/newsletter.ts:8`](file:///C:/Web%20App/writing/marketing/functions/api/newsletter.ts#L8), called by [`marketing/public/site.js:169`](file:///C:/Web%20App/writing/marketing/public/site.js#L169)).
- **Can Marketing Site Host a Turnstile Widget?** **YES, seamlessly.** The marketing pages are standard vanilla HTML/JS served directly on `writersnook.app`.

---

## 3. Existing Plumbing

A full codebase search was conducted for Turnstile artifacts:

```powershell
# Executed across repo:
git grep -i "turnstile"
git grep -i "siteverify"
git grep -i "challenges.cloudflare.com"
```

### Findings
1. **Secrets & Environment Variables:** Zero Turnstile entries exist.
   - `marketing/.dev.vars.example` ([`lines 1-28`](file:///C:/Web%20App/writing/marketing/.dev.vars.example#L1-L28)) does not contain `TURNSTILE_SECRET_KEY` or `TURNSTILE_SITE_KEY`.
   - `marketing/functions/_lib/supabase.ts` (`Env` and `AiEnv`, [`lines 3-28`](file:///C:/Web%20App/writing/marketing/functions/_lib/supabase.ts#L3-L28)) contains no Turnstile fields.
   - No `.env` files contain Turnstile keys.
2. **Configuration Files:** Zero Turnstile configuration.
   - `marketing/wrangler.toml` ([`lines 1-9`](file:///C:/Web%20App/writing/marketing/wrangler.toml#L1-L9)) contains only `name = "writers-nook-marketing"`, `pages_build_output_dir = "public"`, and `nodejs_compat`.
   - `src-tauri/tauri.conf.json` contains no Turnstile references.
3. **Helper Functions / Siteverify Calls:** Zero implementation exists.
   - There are no `siteverify` fetch calls, verification functions, or middleware anywhere in `marketing/functions/`.
4. **Documentation & Decision Records:**
   - [`decisions/0015-trial-abuse-defense-spend-cap.md:1-24`](file:///C:/Web%20App/writing/decisions/0015-trial-abuse-defense-spend-cap.md#L1-L24): Documents why Turnstile was explicitly deferred during Wave 39 in favor of the $25/day global spend cap, citing WebView2 rendering uncertainty and zero-friction no-account UX.
   - [`roadmap/HANDOFF.md`](file:///C:/Web%20App/writing/roadmap/HANDOFF.md): Notes Turnstile scout needs re-running and identifies `/api/ai/trial-session`, `/api/contact`, and `/api/newsletter` as prospective Turnstile insertion points.

**Conclusion:** Turnstile plumbing is 0% implemented. No deprecated or half-finished code exists.

---

## 4. Configuration and Secrets Surface

### How Marketing Functions Read Secrets Today
Cloudflare Pages Functions execute on the Cloudflare Workers edge runtime. Environment variables and secrets are injected into each request context via `context.env`.

- **Type Contracts:** Defined in [`marketing/functions/_lib/supabase.ts`](file:///C:/Web%20App/writing/marketing/functions/_lib/supabase.ts#L3-L28):
  - `Env` ([`supabase.ts:3-11`](file:///C:/Web%20App/writing/marketing/functions/_lib/supabase.ts#L3-L11)) for standard functions.
  - `AiEnv` ([`supabase.ts:18-28`](file:///C:/Web%20App/writing/marketing/functions/_lib/supabase.ts#L18-L28)) extending `Env` for `api/ai/*` functions (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PROXY_SESSION_SECRET`, `TRIAL_AI_ENABLED`, `IP_HASH_SECRET`).
- **Local Development:** Secrets and env vars are read from `marketing/.dev.vars` during `npx wrangler pages dev`.
- **Production Pages Project:** The live Cloudflare Pages project is named **`writing`** (see [`marketing/.claude/vendor-gotchas/cloudflare-pages.md:6-11`](file:///C:/Web%20App/writing/marketing/.claude/vendor-gotchas/cloudflare-pages.md#L6-L11); `writers-nook-marketing` in `wrangler.toml` is stale).

### Adding Turnstile Keys

1. **Server Secret Key (`TURNSTILE_SECRET_KEY`):**
   - Must be added to `AiEnv` in `marketing/functions/_lib/supabase.ts`.
   - Local development: Add to `marketing/.dev.vars`:
     ```bash
     TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA  # Cloudflare dummy "always passes" secret for dev
     ```
   - Production Cloudflare Pages deploy: Execute via Wrangler CLI targeting project `writing`:
     ```bash
     npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name writing
     ```
     *(or set in Cloudflare Dashboard: Pages > writing > Settings > Environment variables > Production).*
   - **Gotcha to keep in mind:** Changing or adding a secret in Cloudflare Pages requires a **full redeployment** (git push) to take effect ([`marketing/.claude/vendor-gotchas/cloudflare-pages.md:117-134`](file:///C:/Web%20App/writing/marketing/.claude/vendor-gotchas/cloudflare-pages.md#L117-L134)).

2. **Public Site Key (`TURNSTILE_SITE_KEY`):**
   - The public site key is client-facing (not secret).
   - In desktop app: Placed in client build config (e.g. `VITE_TURNSTILE_SITE_KEY` in `.env.local` / Vite environment or a config constant in `src/features/ai/`).
   - In marketing site: Added as `data-sitekey` on `<div class="cf-turnstile">` in HTML pages or passed to `turnstile.render()`.

---

## 5. Test Surface

The marketing test suite currently comprises **29 test files and 329 tests** (all passing).

### Where Trial Session Is Tested Today

1. **Worker Endpoint Acceptance Test:** [`marketing/functions/api/ai/trial-session.acceptance.test.ts`](file:///C:/Web%20App/writing/marketing/functions/api/ai/trial-session.acceptance.test.ts#L1-L141) (6 tests)
   - Test suite: `POST /api/ai/trial-session contract`
   - Request construction: Uses helper `ctx(body, envOverride)` ([`trial-session.acceptance.test.ts:52-71`](file:///C:/Web%20App/writing/marketing/functions/api/ai/trial-session.acceptance.test.ts#L52-L71)):
     ```ts
     request: new Request("https://writersnook.app/api/ai/trial-session", {
       method: "POST",
       headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.7" },
       body: JSON.stringify(body),
     })
     ```
   - All 6 tests currently pass `{}` or `{ trialKey: "..." }` without any Turnstile token:
     - `first grant → 200` ([`line 81`](file:///C:/Web%20App/writing/marketing/functions/api/ai/trial-session.acceptance.test.ts#L81)): passes `{}`.
     - `re-exchange of a valid trial key → 200` ([`line 102`](file:///C:/Web%20App/writing/marketing/functions/api/ai/trial-session.acceptance.test.ts#L102)): passes `{ trialKey: "trial_existing_key" }`.
     - `kill-switch off → 403` ([`line 111`](file:///C:/Web%20App/writing/marketing/functions/api/ai/trial-session.acceptance.test.ts#L111)): passes `{}` with `TRIAL_AI_ENABLED: "false"`.
     - `per-IP cap hit → 429` ([`line 119`](file:///C:/Web%20App/writing/marketing/functions/api/ai/trial-session.acceptance.test.ts#L119)): passes `{}`.
     - `first grant with IP_HASH_SECRET unset → 500` ([`line 127`](file:///C:/Web%20App/writing/marketing/functions/api/ai/trial-session.acceptance.test.ts#L127)): passes `{}`.
     - `re-exchange of unknown key → 401` ([`line 134`](file:///C:/Web%20App/writing/marketing/functions/api/ai/trial-session.acceptance.test.ts#L134)): passes `{ trialKey: "trial_bogus" }`.
   - **Contract Protection Note:** Line 3 carries the warning: `* Orchestrator-owned acceptance test — Wave 39 Phase 2: POST /api/ai/trial-session. The implementer may NOT modify this file.`

2. **Desktop Client Acceptance & Unit Tests:**
   - [`src/test/trialSession.client.acceptance.test.ts:1-60`](file:///C:/Web%20App/writing/src/test/trialSession.client.acceptance.test.ts#L1-L60): Pins `acquireTrialSession()` calling `fetch` with `{}` on first-grant and `{ trialKey }` on re-exchange.
   - [`src/test/aiStaleTrialToken.test.ts:1-150`](file:///C:/Web%20App/writing/src/test/aiStaleTrialToken.test.ts#L1-L150): Validates token caching and switching between subscriber and trial tokens.
   - [`src/test/trialWiring.test.tsx:1-250`](file:///C:/Web%20App/writing/src/test/trialWiring.test.tsx#L1-L250): Mocks `acquireTrialSession` and tests UI component routing.
   - [`src/test/AssistantPanel.model.test.ts:19`](file:///C:/Web%20App/writing/src/test/AssistantPanel.model.test.ts#L19): Mocks `acquireTrialSession`.

3. **Mobile Client Tests:**
   - [`mobile/src/features/ai/credentialHandoff.test.ts:23`](file:///C:/Web%20App/writing/mobile/src/features/ai/credentialHandoff.test.ts#L23): Mocks `acquireTrialSession`.

### How to Introduce Turnstile Without Breaking Existing Test Suites
1. **Encapsulated Verification Helper (`_lib/turnstile.ts`):**  
   Create a dedicated helper `verifyTurnstileToken(token: string | null | undefined, secret: string, ip?: string): Promise<{ success: boolean; error?: string }>`.
2. **Vitest Mocking / Test Mode Strategy:**
   - When running unit/acceptance tests where `TURNSTILE_SECRET_KEY` is unset or set to dummy test values (`1x0000000000000000000000000000000AA` / `2x0000000000000000000000000000000AA`), the helper handles mock responses without requiring live network calls to Cloudflare.
   - Alternatively, support a `TURNSTILE_ENFORCED` flag in `env`: if `env.TURNSTILE_ENFORCED !== "true"`, missing tokens are permitted.

---

## 6. Rollout and Compatibility (The Deployment Reality)

### The Lockstep Fallacy
Cloudflare Pages is git-connected to `github.com/hesnotsoharry/writing` ([`marketing/.claude/vendor-gotchas/cloudflare-pages.md:13-20`](file:///C:/Web%20App/writing/marketing/.claude/vendor-gotchas/cloudflare-pages.md#L13-L20)). **Every push to `master` auto-deploys the live marketing site and all Pages Functions immediately (~60 seconds).**

In contrast:
- WritersNook v0.12.6 is released and running on real desktop machines ([`CLAUDE.md:8-10`](file:///C:/Web%20App/writing/CLAUDE.md#L8-L10)).
- Desktop updates are delivered via GitHub Releases and the signed Tauri updater pipeline (`.\publish.ps1` / `publish-mac.sh`), which requires Cole's manual execution and user update adoption.
- **There is NO lockstep deployment.** A distributed desktop app cannot be synchronously updated with the Cloudflare edge Worker.

### What Happens if Turnstile is Unconditionally Enforced on `master`
If `/api/ai/trial-session` is modified to reject any first-grant request that lacks a valid `turnstileToken`:
1. **Immediate Outage for Existing Users:** Every v0.12.6 / v0.12.7 / v0.12.8 desktop client attempting to start a free trial will immediately fail with a 400/403 error.
2. **Broken First-Use AI Experience:** Any newly downloaded desktop client will be unable to acquire trial credits.

### Re-Exchange Exemption (Zero Dollar Exposure)
- Re-exchanging an existing `trialKey` ([`trial-session.ts:45-70`](file:///C:/Web%20App/writing/marketing/functions/api/ai/trial-session.ts#L45-L70)) **does not invoke `grant_trial` and grants zero additional credit units**. It merely re-issues an HMAC bearer token for an already established trial row.
- **Rule:** **Re-exchange MUST NEVER require Turnstile.** This ensures that users who have already activated a trial will not experience session disruptions regardless of app version.

### Recommended 3-Phase Safe Rollout Plan

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Permissive Worker Rollout (on master)                         │
│ ────────────────────────────────────────────────────────────────────── │
│ • Deploy Turnstile verification logic to /api/ai/trial-session.         │
│ • If `body.turnstileToken` is present → verify against siteverify API.  │
│ • If `body.turnstileToken` is missing → allow grant, log telemetry.    │
│ • Flag-controlled: `TURNSTILE_ENFORCED="false"` in Pages environment.  │
│ • Result: 0 broken legacy desktop clients; Turnstile plumbing verified. │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: Desktop Client Release (v0.12.9 / v0.13.0)                    │
│ ────────────────────────────────────────────────────────────────────── │
│ • Integrate Turnstile challenge flow in Tauri app.                     │
│ • Update acquireTrialSession() to pass `turnstileToken`.                │
│ • Ship via publish.ps1 + publish-mac.sh to GitHub Releases.            │
│ • Allow updater to distribute to installed desktop user base.          │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Edge Enforcement Flip                                         │
│ ────────────────────────────────────────────────────────────────────── │
│ • Set `TURNSTILE_ENFORCED="true"` on Pages project `writing`.          │
│ • Unconditionally require valid Turnstile token on all first grants.   │
│ • Legacy clients receive explicit error (e.g. "Please update app").   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Open Questions for Cole

1. **Desktop Turnstile Presentation (UX):**
   - How should Turnstile be presented to a desktop user when activating trial AI?
   - *Option A (Silent/Invisible):* Attempt an invisible/managed Turnstile challenge inside a hidden WebView container. If Cloudflare challenges (requires user interaction), pop an unobtrusive modal in the Assistant panel.
   - *Option B (Explicit Activation Step):* Show a clear one-time button in the Assistant panel: "Activate Free $1.50 Trial", which renders the Turnstile check inline before granting the token.
2. **Domain Registration Strategy in Cloudflare Dashboard:**
   - Cloudflare Turnstile widgets require allowed hostnames.
   - Should the Turnstile widget be registered for `writersnook.app`, `localhost`, and `127.0.0.1`?
   - If Tauri's internal `tauri://localhost` or `https://tauri.localhost` origins are problematic with Cloudflare heuristics, do we prefer hosting the challenge page at `https://writersnook.app/turnstile-challenge.html` and loading it in a small iframe/webview?
3. **Scope of Turnstile Across Marketing Site:**
   - In addition to `/api/ai/trial-session`, should Turnstile also be added to `/api/contact` ([`marketing/public/contact.html`](file:///C:/Web%20App/writing/marketing/public/contact.html)) and `/api/newsletter` ([`marketing/public/site.js`](file:///C:/Web%20App/writing/marketing/public/site.js)) in the same work stream?
4. **Transition Period & Legacy Client Fallback:**
   - Once Turnstile is enforced (Phase 3), how should legacy clients (who send no token) be handled?
   - Return `{ error: "update_required", message: "Please update WritersNook to activate free trial" }` with status 400/403?
