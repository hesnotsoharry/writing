---
status: PLANNED
created: 2026-06-04
---

# Wave m4: fulfillment-forms

## Plan

### Status

PLANNED · marketing-backend branch · target the post-purchase fulfillment + site-forms slice · drafted 2026-06-04 · all phases mock-buildable (no live creds required)

### Goal

After this wave, the marketing/commerce backend handles the **full post-purchase lifecycle** instead of just `order_created`: it captures the real license key (via the `license_key_created` event LemonSqueezy actually delivers it on), records refunds (`order_refunded`), de-duplicates every webhook through the `webhook_events` ledger, and fires a Resend confirmation email on purchase. The frontend stops lying — `purchase-success.html` renders the real order from redirect params instead of hardcoded `nina@example.com`, the account page shows a **live** license activation count pulled from the public LemonSqueezy License API and real installer download links, and the contact + newsletter forms POST to real endpoints (Resend for contact, a Supabase `newsletter_subscribers` table for signups) instead of faking success in the DOM. Everything is parameterized behind placeholder env vars exactly like m1–m3; the only new secrets are `RESEND_API_KEY` + `RESEND_FROM`.

### Scope

**In scope:**

- `marketing/functions/api/webhooks/lemon-squeezy.ts` — expand the event-name dispatch (currently `order_created`-only, hard-returns 200 otherwise) to also handle `order_refunded` and `license_key_created`; wire the `webhook_events` idempotency ledger (insert-on-`(order_id, event_name)`, skip if duplicate).
- `marketing/functions/_lib/resend.ts` — **new** helper: `sendEmail(env, { to, subject, html, text })` → `POST https://api.resend.com/emails` with `Authorization: Bearer ${env.RESEND_API_KEY}`; no-op-with-warn when the key is the placeholder (mirrors the supabase/LS placeholder-guard pattern).
- `marketing/functions/api/contact.ts` — **new** `onRequestPost`: validate body, send a support email via `_lib/resend.ts`.
- `marketing/functions/api/newsletter.ts` — **new** `onRequestPost`: validate email, upsert into `newsletter_subscribers`.
- `marketing/supabase/migrations/` — **new** migration(s): add `refunded_at TIMESTAMPTZ` to `purchases`; create `newsletter_subscribers` (email unique, created_at) with RLS (anon insert-only, service_role full, authenticated no-read).
- `marketing/public/purchase-success.html` + its inline script — read order context from LS redirect URL params; de-hardcode the summary (email, order #, total).
- `marketing/public/account.js` + `account-render.js` — fetch the public License API (`POST /v1/licenses/validate` with the row's `license_key`), render `activation_usage / activation_limit`; wire the `href="#"` download buttons to config-driven installer URLs.
- `marketing/public/account-render.js`, `form-utils.js` — pure render/validation helpers extended (Vitest-testable, node env).
- `marketing/public/contact.html`, `blog.html` / `site.js` `.news-form` handler — replace the naive DOM-mutate handlers with real `fetch` to the new endpoints + `isValidEmail` gating.
- `marketing/public/*-config.js` — add installer-download URL config (placeholder URLs) and any License-API base-URL constant.
- `.dev.vars.example` — add `RESEND_API_KEY`, `RESEND_FROM`.
- Acceptance/unit tests for every new boundary (webhook events, Resend helper, contact/newsletter endpoints, account-render activation, success-page param parse).

**Out of scope:**

- Real signed installer artifacts — buttons point at placeholder/config URLs; producing real downloads is deferred to the deploy track (HANDOFF "Not built yet").
- License **activation/deactivation from the account page** (device management) — this wave reads the count; mutating activations is deferred → a `## Follow-up candidates` entry if the seam is touched.
- Resend **Audiences / broadcast** — newsletter stores to Supabase only; marketing-send integration deferred to a future wave.
- The Phase-2 `$5/mo` sync subscription (`subscription_*` webhook events, variant `1748967`) — deferred to Phase 2 of the product.
- Live provisioning + send (real Resend domain verification, real Supabase project, live License API against a real order) — gated on Cole provisioning keys; this wave is build-against-placeholders.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Webhook events + schema | sonnet-implementer | honeycomb · cross-boundary (external webhook + persistent storage). Expand event dispatch to `order_refunded` (set `status` + new `refunded_at`) and `license_key_created` (upsert real key onto the `purchases` row by `order_id`); wire `webhook_events` ledger for idempotency. Add migration for `refunded_at`. **Fixes latent bug**: `order_created` never carries `license_key`. reviewTier: **panel** (signed external webhook, security boundary — matches m1 P2). | POST a signed mock `order_refunded` / `license_key_created` body to local `wrangler dev` → the `purchases` row's `status`/`refunded_at`/`license_key` change in the Supabase table viewer; duplicate POST is a no-op. (Full live deferred to provisioning; locally observable + acceptance-tested now.) |
| 2 | Resend confirmation email | sonnet-implementer | honeycomb · cross-boundary (external API — **new surface**). New `_lib/resend.ts` (`fetch`-based, placeholder-guarded), triggered from the webhook on license-ready; email carries license key + download links. Add `RESEND_API_KEY`/`RESEND_FROM`. Idempotent (ledger-gated). reviewTier: **single**. | With a real `RESEND_API_KEY`, a webhook POST lands a confirmation email in the inbox. In placeholder mode (no key), the acceptance test asserts the outbound `fetch` request shape (endpoint, auth header, body) and the helper logs "skipped — placeholder". (Live email deferred to key provisioning.) |
| 3 | Account: live activation count + real downloads | sonnet-implementer | trophy · cross-boundary (public License API from browser). `account.js` calls `POST /v1/licenses/validate` (public, no secret) with the row's `license_key`; `account-render.js` renders `usage/limit` (pure, tested). Wire download buttons to config installer URLs. reviewTier: **single**. | On the authed account page, the license card shows "X of Y activations" from a live License-API call, and download buttons link to real (config) URLs. Browser-observable once Supabase auth + a real license exist; in dev, observable by stubbing the License-API response and asserting `renderAccount` output. |
| 4 | Purchase-success de-hardcode + license delivery | sonnet-implementer | trophy · internal-to-frontend (static page + redirect params). Parse LS redirect URL params → render real email/order #/total; resolve the license-key-display decision (see Locked decisions — pending Cole). Keep copy-to-clipboard. reviewTier: **single**. | Visiting `purchase-success.html?...params...` shows the real order summary (not `nina@example.com` / `WN-10428`). Directly browser-observable now (static page + params); param-parse logic unit-tested. |
| 5 | Contact + newsletter wiring | sonnet-implementer | honeycomb · cross-boundary (new endpoints + persistent storage). `POST /api/contact` → Resend support email; `POST /api/newsletter` → `newsletter_subscribers` upsert (+migration). Replace naive form handlers with real `fetch` + `isValidEmail` gating. reviewTier: **single**. | Submitting the contact form sends a support email (or, in placeholder mode, asserts the Resend call); submitting the newsletter form inserts a row into `newsletter_subscribers` (visible in the Supabase table viewer) and shows real success/error states. Browser + DB observable; live email deferred. |

### Acceptance criteria

- [ ] **[P1]** Webhook handler routes `order_created`, `order_refunded`, and `license_key_created` distinctly; any other event still returns 200 without side effects.
- [ ] **[P1]** An `order_refunded` event sets the matching `purchases` row's `status` and `refunded_at` (matched by `order_id`); no duplicate row for an existing order.
- [ ] **[P1]** A `license_key_created` event populates the real `license_key` on the matching `purchases` row.
- [ ] **[P1]** Processing is act-then-mark (D5): the idempotent `purchases` upsert runs before the `webhook_events` ledger write, so a replay re-applies harmlessly and the ledger dedups exactly-once effects (recorded once) — no duplicate observable state, no lost event on transient failure.
- [ ] **[P1]** A handled event with a missing/empty `order_id` is rejected (400) with no writes (no `String(undefined)` ledger poisoning).
- [ ] **[P1]** HMAC signature verification is unchanged and still rejects bad/missing signatures for the new events (same `verifySignature` path).
- [ ] **[P2]** `_lib/resend.ts` issues a correctly-shaped `POST` to `https://api.resend.com/emails` (asserted in test); with a placeholder key it skips the send and warns instead of throwing.
- [ ] **[P2]** The confirmation email fires exactly once per order — gated on the first-time ledger insert (D4); webhook retries do not re-send.
- [ ] **[P4]** `purchase-success.html` renders order email/number/total from URL params; no hardcoded `nina@example.com` / `WN-10428` / static license string remains in the rendered output.
- [ ] **[P3]** The account page renders a live activation count (`usage/limit`) from the License API for a present license, and a graceful fallback when the License API is unreachable or the row has no key.
- [ ] **[P3]** Account download buttons resolve to config-driven URLs (no `href="#"`).
- [ ] **[P5]** `POST /api/contact` validates input and calls the Resend helper; `POST /api/newsletter` validates the email and upserts `newsletter_subscribers` (unique-email enforced, duplicate is a benign success).
- [ ] **[P5]** Contact + newsletter forms call the real endpoints and surface real success/error states (no DOM-faked success).
- [ ] **[P2]** `.dev.vars.example` documents `RESEND_API_KEY` + `RESEND_FROM`; no real secret is committed.
- [ ] **[all]** Gates green from `marketing/`: `npm run test` (full suite — schema changed) + `npx tsc --noEmit`.

### Files the next agent should read first

1. `marketing/functions/api/webhooks/lemon-squeezy.ts` — the event dispatch + `extractRow` upsert to extend (Phase 1).
2. `marketing/functions/_lib/verify-signature.ts` & `_lib/supabase.ts` — the HMAC verifier and service-client factory the new handlers reuse.
3. `marketing/supabase/migrations/20260604130000_create_purchases.sql` — current `purchases` + `webhook_events` schema + RLS; the migration template to copy for `refunded_at` and `newsletter_subscribers`.
4. `marketing/public/account.js` + `account-render.js` + `supabase-client.js` — the browser data path the License-API call threads into (Phase 3).
5. `marketing/public/purchase-success.html` — the hardcoded values to replace with param-driven render (Phase 4).
6. `marketing/public/contact.html`, `blog.html`, `site.js` (`.news-form` handler), `form-utils.js` — the forms + validation helper to wire (Phase 5).
7. `marketing/public/account-render.test.js`, `checkout.test.js`, `functions/api/webhooks/lemon-squeezy.acceptance.test.ts` — the established Vitest patterns (node env, no SDK import, mock-free pure helpers) to match.
8. `.dev.vars.example` + `public/ls-config.js` / `supabase-config.js` — the placeholder-guard / public-config convention to extend.

### Note to the implementer

The spirit of this wave is **stop faking it**: the webhook should record what actually happened (refunds, the real license key), the success page should show the real order, the account page should show the live activation count, and the forms should actually do something. Resist two temptations: (1) keeping `extractRow`'s `license_key` from `order_created` — it's always null there; the key comes from `license_key_created`, so wire that event. (2) Inventing a license-key-display path on `purchase-success.html` that exposes keys via an unauthenticated lookup — that's the open decision below; do not build it until it's locked. The License API is **public** (key-as-credential) — call it from the browser, do not add a server proxy or a secret for it. Every external call gets a placeholder-guard so the suite stays green without creds. **Schema changes this wave** — run the **full** `npm run test`, not just touched tests, after any migration (a migration can break sibling tests). First step: verify the `## Locked decisions` section below has its pending items resolved (especially the Phase-4 license-display decision) before starting Phase 4.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

> D1/D3/D4 are skip-tier (research-settled, single defensible option each — no architect dispatch, recorded directly per the trivial-decision path). D2 was a product/security call resolved by Cole (2026-06-04). No decision-review cell was armed.

**D1 — License key source.**
**Context:** `order_created` doesn't carry the license key, but the email + account + success page all need it.
**Pick:** handle the `license_key_created` webhook event as the authoritative source — upsert the key onto the `purchases` row by `order_id`. Stop trusting `extractRow`'s `license_key` read from `order_created` (always null in practice — latent bug).
**Rationale:** confirmed by research (LS delivers the key only on `license_key_created`); single defensible option.
**Consequences:** the LS webhook must subscribe to `license_key_created` at go-live; downstream key availability depends on that event landing (and may lag the success redirect — see D2 fallback).
**Enforcement:** advisory-only (Phase-1 acceptance test asserts the event populates the key).

**D2 — `purchase-success.html` license display (resolved by Cole, 2026-06-04).**
**Context:** show the license key inline on the *unauthenticated* success page (the design-canon static page already does) vs. a generic "emailed + on your account" confirmation.
**Pick:** keep the key inline on success (matches the canon), but source it **only** from the buyer's in-session lemon.js `Checkout.Success` handoff — never a public `order_id` lookup. Graceful fallback to "your key's been emailed and is on your account page" if the handoff doesn't carry it. De-hardcode the order summary regardless.
**Rationale:** honors the designed page; in-session client-side sourcing avoids enumerable-key exposure and the webhook-timing race a server lookup would hit.
**Consequences:** Phase 4 must verify lemon.js's success event actually carries the key; if it carries only the order, fall back to generic — do NOT add a public lookup endpoint.
**Enforcement:** advisory-only (Phase-4 verification; no `order_id`-keyed key endpoint is built).

**D3 — Newsletter storage.**
**Context:** where newsletter signups land.
**Pick:** a Supabase `newsletter_subscribers` table (email-unique, anon insert-only RLS), not Resend Audiences.
**Rationale:** reuses already-planned Supabase creds; keeps newsletter decoupled from the email vendor.
**Consequences:** a future "broadcast" wave must bridge the table to a sender.
**Enforcement:** none (convention).

**D4 — Resend send idempotency.**
**Context:** webhook retries must not double-email the buyer.
**Pick:** gate the confirmation send on the first-time `webhook_events` ledger insert for that `(order_id, event_name)`; pass Resend's `Idempotency-Key` as defense-in-depth.
**Rationale:** the ledger is the single source of "already processed"; cheap and robust.
**Consequences:** the send is ordered after the ledger insert.
**Enforcement:** advisory-only (Phase-1/2 acceptance test asserts a duplicate event → no second send).

**D5 — Webhook idempotency ordering: act-then-mark** (surfaced by the Phase-1 panel review). `durable: candidate`
**Context:** a mark-then-act ordering (ledger insert, then side effect) silently drops events — if the side effect fails transiently after the ledger commits, LS's retry hits the `23505` ledger guard and the side effect is never applied.
**Pick:** act-then-mark — apply the **idempotent** `purchases` upsert FIRST, write the `webhook_events` ledger AFTER. The ledger gates exactly-once **non-idempotent** effects (Phase 2's email), not the idempotent upsert. Reject a nullish/empty `order_id` (400) before any write.
**Rationale:** the upsert is idempotent on `order_id`, so re-applying on retry is harmless; this removes the lost-event window (standard idempotent-consumer pattern). Applies to any future event handler on this backend.
**Consequences:** the `purchases` upsert may run more than once per order across retries (harmless, same end state); Phase 2's email MUST gate on the first-time ledger insert.
**Enforcement:** advisory-only (acceptance test asserts replay → `ledgerInserts === 1` with `purchaseWrites === 2`; nullish `order_id` → 400 + no writes).

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | — | — | — | — |
| 2 | — | — | — | — |
| 3 | — | — | — | — |
| 4 | — | — | — | — |
| 5 | — | — | — | — |

## Follow-up candidates

<!-- DEFAULT empty. Stage here only if Tier-3 triple-gate clears (VALUE present-harm + STRUCTURAL + CLEARABILITY). Likely candidates if their seams are touched: license activation/deactivation from the account page (device management); real signed installer artifacts; Resend Audiences/broadcast for newsletter. -->

## Result

<!-- filled at ship by wrap team -->
