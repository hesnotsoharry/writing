---
project: writing
updated: 2026-06-13
---

## Current state
- Branch: master · Latest commit: 22808a3 · Tag: v0.8.0
- Waves 36 (launch-monetization-A-C) + 37 (AI-harness) merged at e261f8d; v0.8.0 pushed to master 2026-06-13
- Marketing deployed live (writersnook.app): AI proxy functions + $14.99/mo subscription pricing active
- Status: launch batch in flight (Reddit-launch waves W38–W48) · Wave-37 behavioral smoke VERIFIED 2026-06-13 (all 5 PASS) · Desktop installer (signed) + Phase-D activation pending Cole

## Next 3 steps
1. Cole: Run `.\publish.ps1` to cut v0.8.0 signed NSIS installer + GitHub release + R2 upload (interactive: updater-key password + AZURE_* signing env).
2. Cole: Phase D go-live (GDPR/DPA-gated per marketing/LAUNCH-AI-SUBSCRIPTION.md); blocker first: fix webhook RPC-error (wave-36, handlePaymentSuccess/handleTopupOrder silent allowance loss); flip aiEnabled default OFF per design canon.
3. Optional (decision now well-grounded, not a blocker): upgrade judgment-heavy verbs (critique/betaread/brainstorm) Haiku→Sonnet — one-line per verb in `verb-config.ts`, RATES table already supports it; keep proofread on Haiku. See [[ai-caching-favors-sonnet-upgrade-economics]] — Sonnet's 1024-tok cache floor (vs Haiku 4096) offsets the price; spike one verb side-by-side before committing.

## Active work
- Waves 36 + 37 shipped (code on master, proxy live); desktop installer signing + Phase-D pending Cole
- Wave-37 deferred smoke DONE 2026-06-13: live-proxy CDP smoke confirmed all 5 — Critique craft-note opener, Beta-read 2000-char truncation+notice, Brainstorm Haiku-rate billing, cache_read on 2nd turn, cheaper 2nd turn (681→228 credits). Test data (big About block + extended test1 scene) left on "The Salt Road" test manuscript per Cole. Note: a tauri-devtools smoke gotcha was found+saved ([[tauri-fill-tool-bypasses-react-state]]).
- followups-ui-batch MERGED 2026-06-13: find-mentions mock-toast double-fire fixed (`Editor.tsx`); Win11 DWM rounded corners + theme-aware DWM window border (`src-tauri/src/lib.rs` + `src/theme/useTheme.ts`, new windows/raw-window-handle deps); full-window transparency rejected (buggy WebView2 alpha on Win11); 13 UI follow-ups archived → roadmap/_archived/follow-ups/.
- Launch batch in flight (worktrees): W39 trial-gating, W40 BYOK Phase 1. W43 site-surface committed-not-pushed (parked for Cole copy review). Planned: W42 harness · W44 multi-provider · W45 local-LLM · W46 model-eval · W47 Ask mode · W48 cache-prefix+1h-TTL. Full map: roadmap/discovery/2026-06-13-reddit-launch-readiness.md.
- Open follow-ups: 2 (AI) · precise-cache-write-reserve · assistant-entity-context-strip-staleness · (webhook RPC blocker RESOLVED fb23433; 13 UI follow-ups archived by followups-ui-batch)
- Bookkeeping: wave-17-foundation status corrected (IN-PROGRESS→SHIPPED, shipped in 7addfa4)

## Reference index
- Wave 37: [wave-37-ai-harness-optimization.md](wave-37-ai-harness-optimization.md) · Wave 36: [wave-36-launch-ai-subscription-monetization.md](wave-36-launch-ai-subscription-monetization.md)
- Phase-D runbook: [marketing/LAUNCH-AI-SUBSCRIPTION.md](../marketing/LAUNCH-AI-SUBSCRIPTION.md)
- Durable decisions: [decisions/](decisions/)
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) (Tauri, Anthropic) + marketing/.claude/vendor-gotchas/
- Project conventions: [CLAUDE.md](../CLAUDE.md)
