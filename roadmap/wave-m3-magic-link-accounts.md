---
status: PLANNED
created: 2026-06-04
---

# Wave m3: magic-link-accounts

## Plan

### Status

PLANNED · target v0.3 (marketing-backend track) · drafted 2026-06-04. Grounded by `wave-m3-magic-link-accounts-research.md`.

### Goal

After this wave, the marketing site has a working passwordless account flow. A visitor enters their email on `signin.html` and receives a Supabase Auth magic link (`signInWithOtp`); clicking it lands them, authenticated, on `account.html`, which reads their purchase record from Supabase through the m1 RLS policy (scoped to their email) and renders their license key, order details, and downloads. No session → a sign-in prompt. "Restore purchase" is the same magic-link flow. The Supabase URL + anon key live in a committed public config (`supabase-config.js`); the service-role key stays secret in m1's `.dev.vars`. Everything is testable at the pure-render seam and mock-built; the live magic-link delivery + authenticated render light up once Cole provisions Supabase + sets the dashboard redirect allowlist.

### Scope

**In scope** (`marketing/public/` + docs):

- `public/supabase-config.js` (new) — committed PUBLIC placeholders `window.WN_SB = { url, anonKey }` (anon key is browser-safe, RLS-gated; NOT a secret).
- `public/supabase-client.js` (new) — CDN ESM import of `createClient`, `flowType:'implicit'`, `detectSessionInUrl:true`, `persistSession:true`, `autoRefreshToken:true`, reads `window.WN_SB`; exports the shared client.
- `public/account-render.js` (new) — PURE, no SDK import: `renderAccount(purchaseRow|null, email)` → the values/markup for the account view; unit-tested.
- `signin.html` + `public/signin.js` (new) — `WN_TODO_MAGICLINK`: on submit, `signInWithOtp({ email, options:{ emailRedirectTo: <account.html>, shouldCreateUser:true } })`, swap to a "check your inbox" card. Same form serves "restore purchase."
- `account.html` + `public/account.js` (new) — on load: `getSession()`/`onAuthStateChange`; if authed → `getUser()` email + fetch `purchases` (RLS-filtered) → `renderAccount`; else show a sign-in prompt and hide the account data. Wire `#lickey`, order/product/date, sign-out. **Fix the demo `$49` receipt → `$29`** (m2 carry-over).
- `marketing/SUPABASE-AUTH-SETUP.md` (new) — dashboard runbook (Site URL, redirect allowlist, Resend SMTP, magic-link template, `shouldCreateUser` rationale, rate limits).
- `marketing/vitest.config.ts` already covers `public/**/*.test.js` (m2) — the account-render test lands there.

**Out of scope:**

- Real installer **download URLs** + **license-key delivery** + **Resend transactional email** + **newsletter/contact** — **wave m4**.
- **Activation count** ("2 of 3") and **device deactivation** (LS license API `activate`/`deactivate`/`validate`) — **m4 or later**; m3 leaves these as static stubs with `WN_M4` markers.
- **Subscription status** display — the sync product is deferred; show nothing purchasable (consistent with m2).
- Live Supabase **dashboard config** (Site URL, redirect allowlist, Resend SMTP) — Cole's provisioning step; documented in the runbook, not blocking.
- Pre-creating auth users at purchase time (webhook admin API) — NOT done; we use `shouldCreateUser:true` (just-in-time).

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Magic-link sign-in (`signin.html`) | sonnet-implementer | honeycomb · cross-boundary (Supabase Auth SDK) · reviewTier **single**. `public/supabase-config.js` (placeholder public url+anonKey); `public/supabase-client.js` (CDN ESM import, implicit flow, detectSessionInUrl/persistSession, reads `WN_SB`); `public/signin.js` wires `WN_TODO_MAGICLINK` → `signInWithOtp({ email, options:{ emailRedirectTo, shouldCreateUser:true }})` → swap to "check your inbox". Same form = "restore purchase". Light unit test for any pure helper (email validation). | Opening `signin.html` in a browser, entering an email and submitting swaps the form to the "check your inbox" confirmation, and a POST to the Supabase auth endpoint appears in the network panel. Actual email delivery needs live Supabase + the dashboard redirect allowlist — deferred. |
| 2 | Account page data (`account.html`) | sonnet-implementer | honeycomb · cross-boundary (RLS read) · reviewTier **single**. `public/account-render.js` (PURE `renderAccount(row, email)` → license/order/product/date; unit-tested, no SDK import). `public/account.js` (glue): `getSession` on load → authed: `getUser` email + fetch `purchases` (RLS) → render; unauthed: sign-in prompt + hide data; sign-out. Activation count / real downloads / subscription stay static stubs marked `WN_M4`. Fix the demo `$49` → `$29`. | Loading `account.html` in a browser with NO session shows the sign-in prompt and hides the account panel; the `renderAccount` unit test proves a purchase row maps to the right license/order fields and `null` → the no-purchase state. Authenticated render needs live Supabase — deferred. |
| 3 | Supabase Auth setup runbook + HANDOFF | orchestrator | reviewTier **skip** (docs). `marketing/SUPABASE-AUTH-SETUP.md`: dashboard Site URL + **redirect allowlist** (`account.html` — silent-fail gotcha), Resend SMTP sender, magic-link template, `shouldCreateUser:true` rationale, rate limits, the public anon-key config. `HANDOFF.md` §5: `WN_TODO_MAGICLINK` + Account data + License key marked wired (m3); downloads/activations/subscription noted as m4. | Internal — no observation point. |

### Acceptance criteria

- [ ] `public/supabase-config.js` exists with placeholder PUBLIC `url` + `anonKey` (`window.WN_SB`), commented as public (anon key) — not a secret.
- [ ] `public/supabase-client.js` creates the client via CDN ESM import with `flowType:'implicit'`, `detectSessionInUrl:true`, `persistSession:true`, reading `window.WN_SB`.
- [ ] `signin.html`/`signin.js`: submitting the email calls `signInWithOtp({ email, options:{ emailRedirectTo:<account.html>, shouldCreateUser:true }})` and swaps to a "check your inbox" state.
- [ ] `account.html`/`account.js`: with a Supabase session, renders the signed-in email + the purchase row's `license_key`/order/product/date; with no session, shows a sign-in prompt and hides account data; sign-out clears the session.
- [ ] `public/account-render.js` exports a PURE `renderAccount(purchaseRow, email)` (no SDK import) that is unit-tested — a row → correct license/order/product values; `null` → the no-purchase state.
- [ ] The demo `$49` receipt in `account.html` is corrected to `$29`.
- [ ] Activation count, real download URLs, subscription status, device-management actions remain static stubs marked `WN_M4` (not wired to real sources).
- [ ] `npm run test` (in `marketing/`) passes — the `account-render` test + the m1/m2 suites.
- [ ] `marketing/SUPABASE-AUTH-SETUP.md` exists; `HANDOFF.md` §5 marks `WN_TODO_MAGICLINK` + Account data wired (m3).
- [ ] No secret keys committed — only the public anon-key placeholder in `supabase-config.js`.

### Files the next agent should read first

1. `roadmap/wave-m3-magic-link-accounts-research.md` — current supabase-js v2 magic-link API (CDN import, implicit flow, `signInWithOtp`, `detectSessionInUrl`, RLS read, the redirect-allowlist gotcha).
2. `marketing/public/signin.html` — the `WN_TODO_MAGICLINK` form to wire.
3. `marketing/public/account.html` — the demo data points (`#lickey`, activations, billing history, downloads) to wire or stub.
4. `roadmap/wave-m1-marketing-backend-spine.md` — the `purchases` schema + the `auth.jwt() ->> 'email'` RLS policy that `account.html` reads through.
5. `marketing/public/ls-config.js` + `public/checkout.js` — the public-config + ES-module pattern to mirror.
6. The `## Locked decisions` section of this wave file.

### Note to the implementer

The spirit: passwordless sign-in + read the purchase record, nothing more. Resist: building real downloads / license-activation / subscription (that's m4 — leave the existing demo elements as stubs with `WN_M4` markers); pre-creating auth users (we use `shouldCreateUser:true` — the auth user is created just-in-time on first magic-link click, and RLS scopes them to their own email). The Supabase URL + anon key are PUBLIC config (committed `supabase-config.js`) — only m1's webhook/service-role key is a secret. Testability split: the CDN-importing glue (`signin.js`/`account.js`) is **browser-only** — do NOT try to unit-test it in vitest (the remote CDN import fails in node); only the pure `account-render.js` gets a unit test. Live magic-link delivery + the authenticated render need a live Supabase project AND the dashboard redirect allowlist — observe the form-swap + the no-session state in a browser, and flag the authenticated path as deferred. First step: verify the `## Locked decisions` section below has decisions filled in.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

**Decision 1: Magic-link auth = Supabase `signInWithOtp`, implicit flow, client-side, `shouldCreateUser: true` (just-in-time auth user).** `durable: candidate`
**Context:** the site needs passwordless sign-in keyed by the purchase email; m1's webhook writes a `purchases` row but does NOT create a Supabase Auth user. **Pick:** client-side `signInWithOtp` with `flowType:'implicit'` + `detectSessionInUrl:true`; `shouldCreateUser:true` so the auth user is created on first magic-link click. **Rationale:** implicit flow is the documented fit for a no-backend static multi-page site (research §1); JIT user creation avoids a webhook→admin-API coupling and still satisfies "account auto-provisioned on purchase" because the *purchases row* (the thing the account shows) exists from the webhook, and RLS (`auth.jwt() email = purchases.email`) scopes each user to their own row. **Consequences:** someone can sign in with an email that has no purchase — they get an empty account, no data leak (RLS). The magic-link `emailRedirectTo` MUST be allowlisted in the Supabase dashboard or it fails silently (runbook). **Enforcement:** `advisory-only` — runbook + the renderAccount no-purchase test.

**Decision 2: Supabase URL + ANON key are PUBLIC config, committed in `public/supabase-config.js`.**
**Context:** `signin.html`/`account.html` need the Supabase URL + a key client-side. **Pick:** committed `supabase-config.js` (`window.WN_SB`), placeholders Cole fills; NOT `.dev.vars`. **Rationale:** the anon key is designed for browser exposure and is gated by RLS — it is public by construction; only the service-role key + webhook secret (m1 `.dev.vars`) are secrets. Mirrors m2 Decision 3 (`ls-config.js`). **Consequences:** clear public/secret split documented in the runbook; no env-injection for the static site. **Enforcement:** `none (convention)`.

**Decision 3: Pure render logic split from the CDN-importing SDK glue.**
**Context:** the supabase client is imported from a remote CDN ESM URL, which cannot be imported in a node/vitest test. **Pick:** pure formatting/rendering in `account-render.js` (no SDK import — unit-tested); SDK-touching glue in `account.js`/`signin.js` (browser-only, CDN import — observed in a browser, not unit-tested). **Rationale:** keeps the testable seam node-friendly and avoids fake-mocking a remote module. **Consequences:** account view logic is unit-covered; the auth/fetch wiring is browser-observed (deferred to live Supabase). **Enforcement:** `none (convention)`.

## Status

<!-- Per-phase rows added as work progresses: Phase | Dispatched | Completed | Commit SHA | Observation point hit -->

## Follow-up candidates

<!-- DEFAULT: empty. -->

## Result

<!-- Filled at ship by wrap team. -->
