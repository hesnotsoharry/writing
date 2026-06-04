---
status: PLANNED
created: 2026-06-04
---

# Wave m2: checkout-payments

## Plan

### Status

PLANNED · target v0.2 (marketing-backend track) · drafted 2026-06-04. Grounded by `wave-m2-checkout-payments-research.md`.

### Goal

After this wave, the marketing funnel hands a buyer off to a **real Lemon Squeezy hosted checkout** instead of the mock redirect. Clicking "pay" on `checkout.html` opens the LS overlay (lemon.js) for the $49 app product with the buyer's email prefilled and any entered coupon passed through; on `Checkout.Success` the buyer is redirected to `purchase-success.html` (the m1 webhook already writes the purchase record). The launch **founder price** is shown across the hero/pricing/checkout with an anchored struck-through "$49"; client-side discount math is gone (LS owns coupons); the Phase-1 **sync add-on is hidden**; and the brand-honesty "no account" copy is corrected. The real store/variant IDs sit in a committed placeholder config (`ls-config.js`) that Cole fills with his LS test values.

### Scope

**In scope** (static site under `marketing/public/`, plus marketing docs):

- `checkout.html` — `WN_TODO_PAYMENT`: load lemon.js, `LemonSqueezy.Setup({ eventHandler })`, wire the pay button to `LemonSqueezy.Url.Open(buildCheckoutUrl(...))`, redirect to `purchase-success.html` on `Checkout.Success`. `WN_TODO_COUPONS`: delete the client-side `FOUNDERS`/`EARLYBIRD` discount math; keep the coupon input, route its value into `checkout[discount_code]`. Hide the $5/mo Cloud Backup & Sync add-on toggle (comment + Phase-2 re-enable flag, don't delete).
- `public/checkout.js` (new) — a pure `buildCheckoutUrl({ store, variant, email, discountCode, embed })` plus the DOM wiring; unit-tested.
- `public/ls-config.js` (new) — committed **placeholder** public constants (`window.WN_LS = { store, variantApp }`). These are NOT secrets (they appear in the checkout URL); Cole swaps in real test values.
- `index.html` (hero), `pricing.html` (cards + comparison), `checkout.html` (order summary) — founder-price display with struck-through "$49" anchor + a short "Founder price · first ~3 months" line.
- The brand-honesty "no account required" copy tweak (per `launch-infra-checklist.md`) wherever the claim appears (hero/features/about).
- `marketing/HANDOFF.md` §5 — mark `WN_TODO_PAYMENT` + `WN_TODO_COUPONS` wired.
- `marketing/CHECKOUT-SETUP.md` (new) — runbook: where real store/variant IDs go, LS dashboard founder-price + coupon setup, CSP allowlist for `app.lemonsqueezy.com`, test-card note.
- `marketing/vitest.config.ts` — extend `include` to cover `public/**/*.test.js`.

**Out of scope:**

- The webhook / fulfillment — **done in m1**.
- Magic-link accounts + `account.html` data reads — **wave m3**.
- Real installer downloads, license-key delivery, Resend email, newsletter + contact forms — **wave m4**.
- The backup/sync **subscription** product + its checkout — **deferred** (Phase-2 product per `go-to-market.md`).
- Live production deploy + real variant IDs / test→live swap — **deferred** (placeholders this wave; real values when Cole provides them).

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | LS hosted-checkout wiring on `checkout.html` | sonnet-implementer | honeycomb · cross-boundary (external SDK) · reviewTier **single**. Add lemon.js + `LemonSqueezy.Setup`; extract pure `buildCheckoutUrl()` (store/variant from `public/ls-config.js` placeholders, `embed=1`, prefilled `checkout[email]`, `checkout[discount_code]` from the coupon input, `logo/media/desc` toggles); pay button → `LemonSqueezy.Url.Open(url)`; `Checkout.Success` → redirect to `purchase-success.html`. Remove client-side discount math (keep the coupon input). Hide the $5/mo add-on toggle. Unit-test `buildCheckoutUrl`. | Opening `checkout.html` in a browser and clicking "pay" fires `LemonSqueezy.Url.Open` with the correctly-built checkout URL — visible as a network request to `*.lemonsqueezy.com` (and a console log). Full overlay render is deferred until real variant IDs are slotted. |
| 2 | Founder-price anchor copy + brand-honesty tweak | sonnet-implementer | trophy (visual) · internal-only · reviewTier **single**. `index.html` hero + `pricing.html` cards/table + `checkout.html` order summary: founder price with struck-through "$49" anchor + "Founder price · first ~3 months" line. Revise the "no account required" claim per the brand-honesty wording. Do NOT alter the pricing→checkout funnel routing. | Loading `index.html` + `pricing.html` in a browser shows the founder price beside a struck-through "$49"; the sync add-on no longer appears on `checkout.html`; the "no account" line reads the revised wording. |
| 3 | Integration docs + LS setup runbook | orchestrator | reviewTier **skip** (docs). Update `marketing/HANDOFF.md` §5 (`WN_TODO_PAYMENT`/`WN_TODO_COUPONS` → wired); author `marketing/CHECKOUT-SETUP.md` (real ID slotting, dashboard founder-price + coupon setup, CSP allowlist, test cards). | Internal — no observation point. |

### Acceptance criteria

- [ ] `checkout.html` loads lemon.js and calls `LemonSqueezy.Setup` with a `Checkout.Success` handler that redirects to `purchase-success.html`.
- [ ] A pure `buildCheckoutUrl({store, variant, email, discountCode, embed})` exists in `public/checkout.js` and is unit-tested; it returns `https://<store>.lemonsqueezy.com/checkout/buy/<variant>?embed=1&...&checkout[email]=<enc>&checkout[discount_code]=<enc>` (params URL-encoded; discount/email omitted when empty).
- [ ] The pay button calls `LemonSqueezy.Url.Open(builtUrl)` and no longer hard-redirects to `purchase-success.html`.
- [ ] The client-side `FOUNDERS`/`EARLYBIRD` discount math is removed; the coupon input remains and feeds `checkout[discount_code]`.
- [ ] The $5/mo add-on toggle is hidden (commented/hidden, not deleted) with a Phase-2 re-enable note.
- [ ] `public/ls-config.js` exists with documented PLACEHOLDER public `store` + `variantApp` constants, clearly marked to replace.
- [ ] `index.html` hero and `pricing.html` show the founder price with a struck-through "$49" anchor.
- [ ] The "no account required" claim is revised to the brand-honesty wording on every page it appears.
- [ ] `npm run test` (in `marketing/`) passes — the `buildCheckoutUrl` unit test + the m1 suite (8+ tests total green).
- [ ] `marketing/HANDOFF.md` §5 marks `WN_TODO_PAYMENT` + `WN_TODO_COUPONS` wired; `marketing/CHECKOUT-SETUP.md` exists.
- [ ] Funnel routing unchanged: top-of-funnel Buy CTAs still point to `pricing.html`; only the pricing-page purchase buttons → `checkout.html`.

### Files the next agent should read first

1. `roadmap/wave-m2-checkout-payments-research.md` — current lemon.js / hosted-checkout API, prefill + discount params, redirect via `Checkout.Success`, test-mode notes, gotchas.
2. `marketing/public/checkout.html` — the mock to rewire (`WN_TODO_PAYMENT`, `WN_TODO_COUPONS`, the add-on toggle, the order-summary price).
3. `marketing/public/site.js` — shared behavior; confirm where handlers belong and the existing patterns.
4. `marketing/HANDOFF.md` §4 (funnel routing — do NOT collapse it) + §5 (integration table).
5. `roadmap/go-to-market.md` — founder price ($29–34) + ownership-first positioning (for the copy tone).
6. The `## Locked decisions` section of this wave file.

### Note to the implementer

The spirit of this wave: hand the buyer to the **real** Lemon Squeezy checkout with the least machinery, and don't disturb the funnel. Resist three temptations: (1) rebuilding coupon/discount math — LS owns it now; you only pass the code through. (2) treating the store/variant IDs as secrets — they're **public**, they go in a committed `ls-config.js`; the only secrets (webhook/service-role) already live in m1's `.dev.vars`. (3) wiring accounts, downloads, or email — those are m3/m4. With placeholder variant IDs the overlay won't fully render a product; "working" for Phase 1 means the click builds and opens the correct URL, not a completed purchase. The displayed founder price is decorative copy — LS's product price is the real charge, so flag in the runbook that the two must be set to match. First step: verify the `## Locked decisions` section below has decisions filled in.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

**Decision 1: LS hosted overlay checkout via lemon.js (`LemonSqueezy.Url.Open`), not API-created sessions.**
**Context:** the funnel needs to take payment for one one-time product; fulfillment is already webhook-driven (m1). **Pick:** client-side lemon.js overlay opening a hosted `checkout/buy/<variant>` URL — no server-side checkout creation. **Rationale:** zero backend for the payment step, standard LS pattern for a static site, and the webhook already handles the post-purchase record; an API-created checkout would add a Pages Function for no benefit at this scope. **Consequences:** the checkout URL (store + variant + prefill params) is built client-side; post-purchase redirect rides the `Checkout.Success` event, not a URL param (LS has no `success_url` param — research §5). **Enforcement:** `none (convention)` — phase brief + research grounding.

**Decision 2: Founder price = LS product base price + anchored display copy; coupon field routes to `checkout[discount_code]`.** `durable: candidate`
**Context:** the launch wants a founder discount everyone in the window gets, plus targeted promo codes. **Pick:** set the *LS product price* to the founder value and show it with a struck-through "$49" anchor on-site (NOT a blanket coupon); keep the on-page coupon input for *targeted* codes, passed through as `checkout[discount_code]`. **User-locked by Cole, 2026-06-04.** **Rationale:** a blanket price is frictionless and leak-proof vs a coupon everyone must find/enter; coupons stay the tool for targeted promos. **Consequences:** the on-site price is decorative and MUST be kept in sync with the LS product price (flag in the runbook); when the founder window ends, raise the LS price + drop the anchor copy. **Enforcement:** `advisory-only` — runbook note + acceptance criterion.

**Decision 3: LS store + variant IDs are PUBLIC config, committed in `public/ls-config.js` — not secrets.**
**Context:** the checkout needs the store subdomain + variant ID client-side. **Pick:** a committed `ls-config.js` with placeholder constants Cole replaces with real test values; NOT in `.dev.vars`. **Rationale:** these identifiers are embedded in the checkout URL every buyer hits — they are public by construction; only the webhook signing secret + service-role key (already in m1's gitignored `.dev.vars`) are secrets. **Consequences:** clear secret/non-secret split documented in the runbook; no env-injection needed for the static site. **Enforcement:** `none (convention)`.

## Status

<!-- Per-phase rows added as work progresses: Phase | Dispatched | Completed | Commit SHA | Observation point hit -->

## Follow-up candidates

<!-- DEFAULT: empty. -->

## Result

<!-- Filled at ship by wrap team. -->
