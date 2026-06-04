---
status: PLANNED
created: 2026-06-04
---

# Wave m1 — Marketing backend spine (walking skeleton)

## Plan

### Status

DRAFT · target v0.1 (marketing-backend track) · drafted 2026-06-04.

### Goal

After this wave, the `marketing-backend` worktree contains a deployable Cloudflare Pages project: the existing static `marketing/` site plus a `functions/` directory of serverless endpoints, a `supabase/migrations/` schema, and a **proven end-to-end spine** — a Cloudflare Pages Function writes to and reads from Supabase, and a Lemon Squeezy test webhook reaches a Pages Function, has its `X-Signature` HMAC verified with a constant-time comparison, and upserts an idempotent `purchases` row. Local-dev secret scaffolding (`.dev.vars.example` + `.gitignore`), `wrangler` config, and automated smoke tests exist. No feature wiring (real checkout, accounts, downloads, license delivery, email, forms) — only the integration spine that every later wave builds on.

### Scope

**In scope:**

- `wrangler.toml` (or `.jsonc`) at the worktree root configuring a Cloudflare **Pages** project with the `functions/` directory; `package.json` adding `@supabase/supabase-js@^2.58` and `wrangler` (+ `vitest` for smokes), with a `wrangler types` script.
- `.gitignore` ignoring `.dev.vars`, `.env`, `node_modules`, `.wrangler/`; a committed `.dev.vars.example` listing secret variable **names only** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `LEMON_SQUEEZY_SIGNING_SECRET`) with placeholder values — never real secrets.
- `supabase/migrations/<ts>_create_health.sql` — minimal `_health` table for the skeleton round-trip.
- `supabase/migrations/<ts>_create_purchases.sql` — `purchases` table (email, `order_id` UNIQUE, license_key, product_name, totals, timestamps) + `webhook_events` idempotency ledger; RLS enabled with policies: `service_role` ALL, `authenticated` select-own, `anon` none; indexes on email + order_id.
- `functions/_lib/supabase.ts` — Supabase client factory using the **custom-`fetch` Workers pattern** (research §2) and the service-role key from `context.env`.
- `functions/_lib/verify-signature.ts` — Web Crypto HMAC-SHA256 over the **raw** body with a **constant-time** comparison (NOT `!==`).
- `functions/api/health.ts` — `onRequest` that inserts a `_health` row and selects it back, returning JSON (the spine proof).
- `functions/api/webhooks/lemon-squeezy.ts` — `onRequestPost` that reads the raw body, verifies the signature, parses `order_created`, and idempotently upserts a `purchases` row.
- Automated `vitest` smokes: health round-trip; webhook valid-signature → 200 + row; invalid signature → 401; duplicate payload → exactly one row.
- Deploy the static site + functions to a Cloudflare Pages `*.pages.dev` URL; author `marketing/DEPLOY.md` runbook (env-var bind steps, deploy command).

**Out of scope:**

- Real Lemon Squeezy checkout / `lemon.js` overlay, coupon validation, founder-price copy — **deferred to wave m2** (`WN_TODO_PAYMENT`, `WN_TODO_COUPONS`).
- Magic-link auth (Supabase Auth) and account-page data reads — **deferred to wave m3** (`WN_TODO_MAGICLINK`).
- Real installer download links, license-key delivery into UI, Resend transactional email, newsletter + contact forms — **deferred to wave m4**.
- The Phase-2 backup/sync **subscription** product and its events — **deferred indefinitely** (separate product; `go-to-market.md` Phase 2).
- Live production secrets / test→live key swap — **deferred until LS + Supabase verification clears** (placeholders only this wave).
- DNS cutover of `writersnook.app` to the Pages project — **deferred until Cole confirms Cloudflare zone access**; this wave lands on `*.pages.dev`.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Walking skeleton — serverless↔Supabase spine | sonnet-implementer | honeycomb · cross-boundary · reviewTier **single**. The thinnest end-to-end slice touching Pages Function → Supabase client → DB → response. Scaffold `wrangler.toml` + `package.json` (`@supabase/supabase-js@^2.58`, `wrangler`, `vitest`) + `.gitignore` + `.dev.vars.example`; migration creates `_health`; `functions/_lib/supabase.ts` uses the custom-`fetch` Workers client (research §2); `functions/api/health.ts` inserts a heartbeat row and selects it back; one vitest smoke. This IS the walking skeleton — not "scaffold the package," the slice runs end-to-end. | Visiting `/api/health` under `npx wrangler pages dev` renders JSON `{ ok, wrote:<id>, readBack:{…} }` in Cole's browser — a real Supabase write+read round-trip on the page. |
| 2 | purchases schema + Lemon Squeezy webhook fulfillment | sonnet-implementer | honeycomb · cross-boundary · reviewTier **panel** (security boundary: external webhook + signature verification). Migration creates `purchases` + `webhook_events`, RLS + policies. `functions/_lib/verify-signature.ts` does Web Crypto HMAC-SHA256 over the RAW body (research gotcha §3) with a **constant-time** compare — the research snippet's `!==` is wrong, do NOT copy it. `functions/api/webhooks/lemon-squeezy.ts` parses `order_created`, idempotent upsert keyed by `order_id`. Smokes: valid→200+row, invalid→401, duplicate→one row. Orchestrator authors the failing acceptance test for the webhook contract before dispatch (boundary phase). | Cole opens the Supabase table viewer and sees a new `purchases` row after posting a correctly-signed test `order_created` to `wrangler pages dev`; a wrong-signature POST leaves the table unchanged. |
| 3 | Deploy live to `*.pages.dev` + secrets runbook | orchestrator | reviewTier **skip** (deploy/config, no app logic). Final `.gitignore` audit; author `marketing/DEPLOY.md` (every env-var name + dashboard-bind steps + deploy command); run `npx wrangler pages deploy` to publish the static site + functions (Cole-run via `!` if CF auth is not in-session). DNS cutover deferred. Verify no secret values are committed. | Cole loads the `*.pages.dev` URL and sees the marketing homepage render; loading `/api/health` on that same URL shows the DB round-trip JSON. |

### Acceptance criteria

- [ ] `wrangler.toml` (or `.jsonc`) exists at the worktree root configuring a Pages project with the `functions/` directory; `npx wrangler pages dev` starts without error.
- [ ] `package.json` lists `@supabase/supabase-js@^2.58.x` and `wrangler` as dependencies and `vitest`; `npm install` exits 0.
- [ ] `.gitignore` ignores `.dev.vars`, `.env`, `node_modules`, `.wrangler/`; `.dev.vars.example` exists with placeholder variable **names** and no real secret values; `git status` shows no `.dev.vars`/`.env` staged or tracked.
- [ ] `supabase/migrations/` contains a `_create_health` migration and a `_create_purchases` migration; the latter creates `purchases` (with `order_id` UNIQUE) + `webhook_events`, runs `ALTER TABLE … ENABLE ROW LEVEL SECURITY`, and creates policies for `service_role` (ALL), `authenticated` (select-own), `anon`.
- [ ] `functions/api/health.ts` exports `onRequest`; against a configured Supabase instance, GET `/api/health` returns JSON containing a written-then-read `_health` row id.
- [ ] `functions/api/webhooks/lemon-squeezy.ts` exports `onRequestPost`; a POST with a valid `X-Signature` for its body returns HTTP 200 and a `purchases` row exists; a POST with an invalid signature returns HTTP 401 and writes no row.
- [ ] `functions/_lib/verify-signature.ts` computes Web Crypto HMAC-SHA256 over the raw request body and compares with a **constant-time** routine (byte-accumulating, not `===`/`!==` on the hex strings).
- [ ] Idempotency: posting the same `order_created` payload twice yields exactly one `purchases` row (unique `order_id` upsert and/or `webhook_events` guard).
- [ ] `npm run test` passes the smoke suite: health round-trip + webhook valid/invalid/duplicate cases.
- [ ] `marketing/DEPLOY.md` exists and lists every required env var by name with no values.
- [ ] Grep of the committed tree finds no real secret values (only the placeholder names in `.dev.vars.example`).

### Files the next agent should read first

1. `roadmap/wave-m1-marketing-backend-spine-research.md` — **read first**: current Cloudflare Pages Functions, `@supabase/supabase-js` v2.58, Lemon Squeezy webhook, and Supabase migration/RLS API shapes the phase briefs are grounded in. (Renamed from `wave-m1-DRAFT-research.md` on validation pass.)
2. `roadmap/launch-infra-checklist.md` — the locked stack, the LS-webhook→Supabase architecture spine, the licensing model, and the full secrets list.
3. `marketing/HANDOFF.md` — site conventions and the `WN_TODO_*` integration seams that waves m2–m4 will fill (context for what the spine must support).
4. The `## Locked decisions` section of this wave file.

### Note to the implementer

The spirit of this wave is **a proven spine, nothing more.** Build the thinnest slices that show Cloudflare Pages Functions ↔ Supabase ↔ Lemon Squeezy actually talk to each other, and stop. Resist the temptation to wire real checkout, accounts, downloads, license delivery, or email — those are waves m2–m4 and have their own briefs; building them now means building features on an unproven integration. Two hard rules: **never commit a real secret** (placeholders only, everything via `context.env`), and on the webhook **verify the raw body with a constant-time compare** — the research extract's `!==` snippet is a known wrong pattern; do not copy it. First step: verify the `## Locked decisions` section below has decisions filled in.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

**Decision 1: Backend runtime = Cloudflare Pages Functions (file-based `functions/` routing).**
**Context:** The site is hosted on Cloudflare Pages; the spine needs serverless endpoints. **Pick:** Pages Functions in a `functions/` dir (same-repo, same-deploy) rather than a separate Worker or external backend. **Rationale:** zero extra hosting/deploy surface, the static site and its API ship together, and the Workers-converged runtime gives full feature parity (research §1). Forced by the locked stack in `launch-infra-checklist.md`. **Consequences:** all backend code is edge-runtime (Web Crypto, custom-`fetch` Supabase client); no Node-only APIs. **Enforcement:** `none (convention)` — directory layout + research-grounded phase briefs.

**Decision 2: Webhook idempotency = unique `order_id` upsert + a `webhook_events` ledger.**
**Context:** Lemon Squeezy retries webhooks; a retry must not double-create a purchase (research §3). **Pick:** make `purchases.order_id` UNIQUE and `upsert` on it; additionally record each processed event in `webhook_events` for an explicit replay guard. **Rationale:** the unique-constraint upsert is the durable guarantee even under concurrent retries; the ledger gives observability and a fast pre-check. Standard idempotent-consumer pattern. **Enforcement:** acceptance criterion "duplicate payload → exactly one row" + the Phase 2 smoke test.

**Decision 3: Marketing site is a self-contained Cloudflare Pages project under `marketing/`, decoupled from the Tauri app.** `durable: candidate`
**Context:** the app and the marketing backend share one git repo; the Phase-1 implementer merged marketing deps into the app's root `package.json`, coupling the two and risking a merge conflict with the concurrent app agent on `master`. **Pick:** `marketing/` is its own Pages project root — own `package.json` (supabase-js/wrangler/vitest), static assets in `marketing/public/`, `functions/` + `supabase/` inside `marketing/`; the app's root `package.json` left untouched. **Rationale:** clean dependency isolation (app doesn't ship wrangler; Pages doesn't install the Tauri/React toolchain on every deploy) and zero `package.json` conflict with the parallel app branch. **User-locked by Cole, 2026-06-04.** **Consequences:** CF Pages dashboard root dir = `marketing`, build output dir = `public`; marketing carries its own gates (`tsc --noEmit` + `vitest`). **Enforcement:** `advisory-only` — structural separation via `marketing/package.json`; no hook.

## Status

| Phase | Dispatched | Completed | Commit | Observation point hit |
|---|---|---|---|---|
| 1 | 2026-06-04 (sonnet-implementer) | 2026-06-04 | _this commit_ | Mocked smoke only — live `/api/health` round-trip NOT observable yet (no Supabase project provisioned). tsc 0 errors, vitest 2/2. Live observation deferred to provisioning. |

<!-- Per-phase rows added as work progresses: Phase | Dispatched | Completed | Commit SHA | Observation point hit -->

## Follow-up candidates

<!-- DEFAULT: empty. -->

## Result

<!-- Filled at ship by wrap team. -->
