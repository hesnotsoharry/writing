---
project: writing
updated: 2026-06-13
---

## Current state
- Branch: master · Latest commit: 22808a3 · Tag: v0.8.0
- Waves 36 (launch-monetization-A-C) + 37 (AI-harness) merged at e261f8d; v0.8.0 pushed to master 2026-06-13
- Marketing deployed live (writersnook.app): AI proxy functions + $14.99/mo subscription pricing active
- Status: between waves · Desktop installer (signed) + behavioral smoke + Phase-D activation pending Cole

## Next 3 steps
1. Cole: Run `.\publish.ps1` to cut v0.8.0 signed NSIS installer + GitHub release + R2 upload (interactive: updater-key password + AZURE_* signing env).
2. Cole: Post-deploy Wave 37 behavioral CDP smoke (live-proxy): Critique opens with craft note; 2nd turn shows cache_read_input_tokens > 0; credit meter decrements at Haiku rate.
3. Cole: Phase D go-live (GDPR/DPA-gated per marketing/LAUNCH-AI-SUBSCRIPTION.md); blocker first: fix webhook RPC-error (wave-36, handlePaymentSuccess/handleTopupOrder silent allowance loss); flip aiEnabled default OFF per design canon.

## Active work
- Waves 36 + 37 shipped (code on master, proxy live); desktop installer signing + smoke + Phase-D pending Cole
- Open follow-ups: 3 · Phase-D webhook RPC-error blocker (top), precise-cache-write-reserve, remove vestigial StreamChatOptions.maxTokens
- Bookkeeping: wave-17-foundation status corrected (IN-PROGRESS→SHIPPED, shipped in 7addfa4)

## Reference index
- Wave 37: [wave-37-ai-harness-optimization.md](wave-37-ai-harness-optimization.md) · Wave 36: [wave-36-launch-ai-subscription-monetization.md](wave-36-launch-ai-subscription-monetization.md)
- Phase-D runbook: [marketing/LAUNCH-AI-SUBSCRIPTION.md](../marketing/LAUNCH-AI-SUBSCRIPTION.md)
- Durable decisions: [decisions/](decisions/)
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) (Tauri, Anthropic) + marketing/.claude/vendor-gotchas/
- Project conventions: [CLAUDE.md](../CLAUDE.md)
