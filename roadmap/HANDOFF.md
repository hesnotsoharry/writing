---
project: writing
updated: 2026-06-14
---

## Current state
- Branch: wave-42-ai-isms-harness  · Latest commit: 352d05e  · Tag: v0.8.0
- Wave 42 (AI-isms harness) shipped on feature branch; parked for Cole review before master merge
- Active wave: none · Launch batch in flight (W39 trial-gating, W40 BYOK Phase 1, W43 parked)

## Next 3 steps
1. Cole: Review + merge `wave-42-ai-isms-harness` → master (push deploys GET /api/ai/house-style endpoint live)
2. Cole: Run `.\publish.ps1` to cut signed NSIS installer + GitHub release + R2 upload
3. Cole: Phase D go-live (fix webhook RPC-error blocker; flip aiEnabled default OFF; GDPR/DPA-gated per launch doc)

## Active work
- Wave 42 SHIPPED: client-injected house-style/anti-AI-isms block; `applyHouseStyle` in shared.ts appends block after SHARED_PRINCIPLES; content served by marketing endpoint GET /api/ai/house-style (fail-open-to-baked-in). Ships in binary → reaches BYOK-direct. Gates: client 1413/1413, marketing 208/208.
- v1 content PROVISIONAL — W46's eval sets tuned content + per-model addenda. Client HOUSE_STYLE_BLOCK + marketing endpoint string must stay byte-in-sync until W46.
- Launch batch status: W42 done. Other worktrees: W39 trial-gating, W40 BYOK Phase 1. W43 parked (site-surface, committed-not-pushed). Planned: W44 multi-provider · W45 local-LLM · W46 model-eval · W47 Ask mode · W48 cache-prefix.
- Open follow-ups: 2 (AI) — precise-cache-write-reserve · assistant-entity-context-strip-staleness

## Reference index
- Wave 42: [wave-42-ai-isms-harness.md](wave-42-ai-isms-harness.md) · Decision: [anti-ai-isms-harness-client-injected-remote-config.md](decisions/anti-ai-isms-harness-client-injected-remote-config.md)
- Phase-D runbook: [marketing/LAUNCH-AI-SUBSCRIPTION.md](../marketing/LAUNCH-AI-SUBSCRIPTION.md)
- Durable decisions: [decisions/](decisions/)
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) (Tauri, Anthropic) + marketing/.claude/vendor-gotchas/
- Project conventions: [CLAUDE.md](../CLAUDE.md)
