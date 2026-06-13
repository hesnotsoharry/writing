---
project: writing
updated: 2026-06-13
---

## Current state
- Branch: master · Latest commit: b6f29b3 · Tag: v0.6.0
- Wave 37 (ai-harness-optimization): IMPLEMENTED, not shipped (commits fa46ccf..b6f29b3 this session, none pushed yet; Cole controls ship timing pending coordination of waves 36+37 marketing merges)
- Wave 36 (monetization safe): phases A–C complete, D held on branch wave-36-launch-monetization (blockers: LS test→live migration, live webhook, GDPR/DPA clearance)

## Next 3 steps
1. Coordinate marketing merges (waves 36 + 37 both touch marketing/ — pricing, vendor integrations); merge to master; push (Cloudflare Pages auto-deploy); cut v0.8.0 desktop release
2. Run Wave 37 behavioral CDP smoke (deferred verification): Critique opens with concrete craft note; 2nd turn checks cache_read_input_tokens > 0; verify credit meter at correct Haiku rate; invoke /review after passing
3. Flip aiEnabled production default (TWEAK_DEFAULTS.aiEnabled, settings.store.ts) — design canon OFF by default; Cole's call, coordinated with launch

## Active work
- Wave 37 delivered (fa46ccf..b6f29b3): anti-sycophancy prompts + scene-truncation honesty + privacy footgun fix + server-VERB_CONFIG [F] + prompt caching [6]. Tests: 1398 root/199 marketing ✓; tsc/lint ✓. Wave-end: 2-panel + adversarial review PASS (FLAG-no-BLOCK, addressed). Haiku 4.5 locked; model upgrade deferred (Cole's cost call; [F] makes flip one-line + correct billing).
- About-persistence bug fixed (f59e8b2): About edits now persist + reach AI (root: About block never injected into write path).
- AI-feature optimization research (7de1b37): roadmap/discovery/2026-06-13-ai-feature-optimization.md (verified optimization plan + feature backlog, scope estimates).
- No wave in flight. Open follow-ups: 15 · New: [precise-cache-write-reserve](follow-ups/2026-06-13-precise-cache-write-reserve.md) (estimateCredits refinement). Next-wave Phase-0 inline: remove StreamChatOptions.maxTokens.
- Promoted decision: server-side-verb-config-billing. Updated vendor-gotcha: anthropic.md (caching GA, model IDs, temp/thinking).

## Reference index
- Wave 37 plan + result: [wave-37-ai-harness-optimization.md](wave-37-ai-harness-optimization.md) + research sidecar
- AI optimization research: [discovery/2026-06-13-ai-feature-optimization.md](../discovery/2026-06-13-ai-feature-optimization.md)
- Durable decisions: [decisions/](decisions/)
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) (Tauri, Anthropic)
- Project conventions: [CLAUDE.md](../CLAUDE.md)
