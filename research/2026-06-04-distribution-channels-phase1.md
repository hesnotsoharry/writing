# Phase 1 Distribution Channels Research

Research date 2026-06-04. Companion doc: `2026-06-04-creative-writing-market-segments.md` (same
research pass, market segmentation + WTP). Historical note: this predates the m1/m2 marketing
waves, which shipped Lemon Squeezy as the merchant of record (see
`decisions/licensing-model-inherited-pre-locked.md` and `marketing/CHECKOUT-SETUP.md`) — the
Microsoft Store / itch.io channels below were NOT built; direct checkout on the marketing site
was the path actually taken.

## Phase 1 Distribution Strategy (as researched)

**PRIMARY (researched):** Lemon Squeezy direct checkout (embedded on landing page) + Microsoft
Store listing.
**SECONDARY (researched):** itch.io (community + feedback).
**AVOID:** Stripe (tax burden), Steam (low discoverability for a writing app), Mac App Store
(deferred to Phase 2 in this research — actual macOS launch, per wave-55, shipped via direct
download + updater, not the Mac App Store).

## Why This Combination

- **Lemon Squeezy:** 5% + $0.50/txn, full merchant-of-record (handles VAT globally), mature
  subscription billing for a later sync tier.
- **Microsoft Store:** free entry, 100% revenue keep with self-checkout (if handling VAT
  yourself), legitimacy signal on Windows. NOT built as of this writing — actual distribution is
  direct download from the marketing site + signed installer.
- **itch.io:** zero friction, community feedback loop, flexible rev share. NOT built.

Researched Phase 1 effort estimate: ~1 week (Lemon Squeezy API + MSIX packaging + itch.io
upload). Actual implementation (waves m1-m4) used Lemon Squeezy hosted checkout only, wired
directly into the marketing site — no MSIX/Store packaging, no itch.io listing.

## Phase 2 Expansion (Cloud Sync) — as researched

Add Lemon Squeezy Billing API for a subscription tier ($4-8/month). License key server needed
for sync entitlement validation (research suggested Keygen or a self-hosted basic server).
Actual implementation direction: see `decisions/` for the credit-ledger and provider-abstraction
ADRs that superseded this early sketch once the AI-assistant subscription model (not sync) became
the first recurring-revenue feature.

## Not Recommended (Phase 1) — and why

- **Stripe:** 7.8-12.27% effective cost once tax liability + chargeback + failed-payment recovery
  are factored in.
- **Steam:** 30% cut + poor discoverability for a writing app.
- **Paddle:** same fee structure as Lemon Squeezy but a less polished custom-checkout experience.
- **Self-hosted license server:** over-engineered for Phase 1; deferred (the app's actual license
  model uses Lemon Squeezy-verified in-app activation instead — see `marketing/HANDOFF.md` §1).

## Real-World Comparables

Scrivener ($49 one-time, Mac + Windows separate) — profitable indie, low operational overhead.
Obsidian (free + $50 Catalyst + $5/month Sync) — hybrid model referenced as a Phase 2 template.

Note: the original research pass also referenced a 40-page detailed breakdown at
`~/.claude/agent-memory/haiku-research-extractor/writing-app-distribution-research.md` — that
path is an agent-memory location outside this repo and was not verified to still exist at time
of this promotion (2026-07-10); treat the summary above as the durable record.
