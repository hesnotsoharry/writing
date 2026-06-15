---
status: SHIPPED
created: 2026-06-13
shipped: 2026-06-13
merged_to_master: true
note: phases A-C MERGED into master + deployed to writersnook.app 2026-06-13 (commit e261f8d, with v0.8.0). Phase D (live LS checkout flip + GDPR/DPA clearance) is deliberately DEFERRED — Cole-executed; tracked in ## Follow-up candidates (incl. the webhook RPC-error launch-blocker) + marketing/LAUNCH-AI-SUBSCRIPTION.md runbook. Marked SHIPPED (not IN-PROGRESS) so the held-D activation does not falsely gate unrelated future pushes.
---
# Wave 36 — Launch / AI-subscription monetization (marketing)

Result: Phases A–C merged into master at commit `e261f8d` (branch `wave-36-launch-monetization`, tag v0.8.0, HEAD `22808a3`) — Cloudflare Pages auto-deployed `marketing/`, putting the $14.99/mo AI-subscription pricing card, AI feature card, and Resend subscription key-email wiring LIVE on writersnook.app. Marketing vitest 201/201, tsc clean on the merged tree; wave-end adversarial review (attack-diff) returned FLAG-no-BLOCK — the deployed surface was clean; the one finding (webhook credits-RPC error after the idempotency tombstone) was INERT in this deploy and filed as a Phase-D launch-blocker. Phase D (live LS checkout flip + GDPR/DPA clearance) deliberately held — Cole-executed; runbook at `marketing/LAUNCH-AI-SUBSCRIPTION.md`; the subscribe CTA remained a placeholder (`href="#ai-subscribe-url-set-at-launch"`) until Phase D fills the live URL.
