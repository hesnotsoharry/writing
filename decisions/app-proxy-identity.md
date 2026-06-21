---
status: ACTIVE
decided-in: wave-34
promoted-during: wave-34-ai-assistant-foundation
---

## Context

The desktop app must present a credential for the managed tier; writers hate logins.

## Pick

Subscription license key (entered once in the panel, like wave-30 activation) exchanged at panel-mount via `POST /api/ai/session` for an HMAC-SHA256-signed session token (4h TTL, held in React state only, never SQLite). Key mint is **pluggable** (review amendment): if LS subscriptions carry license keys, LS mints; otherwise OUR `subscription_created` webhook mints the key and emails it via the existing Resend path. Same table, same PK, same exchange either way. **VERIFIED 2026-06-12 (Cole, LS dashboard): subscription products DO support "generate license key" — enabled on WritersNook Plus (test variant 1782093; top-up test variant 1782092 — TEST-MODE IDs, swap to live IDs at launch via the `LS_SUB_VARIANT_ID`/`LS_TOPUP_VARIANT_ID` env values). LS-mint is the active path; self-mint+Resend remains a dormant seam.**

## Rationale

(Embedded in Pick section above.)

## Consequences

Token validates against Supabase only at issuance; revocation latency on cancellation is bounded by the 4h TTL (accepted: worst case a few hours of drain on an already-paid balance). No email login in the app.

## Enforcement

Auth middleware in `api/ai/chat.ts`; 403 seam test; acceptance criterion.
