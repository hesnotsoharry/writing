---
status: SHIPPED
shipped: 2026-06-04
commits: 0e48d9e..7d4e786
---
# Wave m4: fulfillment-forms

Result: Full post-purchase lifecycle + site forms on the `marketing-backend` branch — webhook handles `order_refunded` + `license_key_created` through the `webhook_events` ledger (act-then-mark); Resend confirmation email; account live activation count via the public LS License API; `purchase-success` de-hardcoded from the in-session checkout handoff + signed receipt link; `/api/contact` + `/api/newsletter`. Build-against-placeholders; 63 tests / `tsc` green. Full detail: `git log 0e48d9e..7d4e786`.

Promoted: [act-then-mark-webhook-idempotency](decisions/act-then-mark-webhook-idempotency.md)
Vendor-gotchas updated: [lemonsqueezy](../marketing/.claude/vendor-gotchas/lemonsqueezy.md), [resend](../marketing/.claude/vendor-gotchas/resend.md)
