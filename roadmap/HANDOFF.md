---
project: writing
updated: 2026-06-15
---

## Current state
- Branch: master  ·  Latest commit: c463be1  ·  Tag: v0.9.0
- **v0.9.0 PREPPED, READY FOR COLE TO SHIP.** Version bumped 0.8.1→0.9.0 across all 4 files (package.json, src-tauri/Cargo.toml, src-tauri/Cargo.lock, src-tauri/tauri.conf.json). Tag v0.9.0 pushed. **Publish action: Cole runs `.\publish.ps1` interactively** (updater-key password, signs NSIS, GitHub release, R2 upload, latest.json). Agents do NOT run publish.ps1.
- **All 6 waves shipped in this release:** W39 trial-gating (license server, per-user trial credits) · W45 local-LLM (OpenAI-compatible endpoints, Ollama discovery) · W47 Ask mode (streaming chat, agent reasoning) · W48 cache-prefix+1h-TTL (Anthropic caching, reserve) · W49 BYOK-multi-provider (OpenAI BYOK + Anthropic keys) · W50 AI-trial&usage (per-model meter, convert-on-exhaustion, usage readout)
- **Batch wrap complete.** Promoted ADR 0014 (trial-identity server-minted), ADR 0015 (trial spend-cap $25/day). New vendor-gotcha: `.claude/vendor-gotchas/ollama.md` (dual-endpoint discovery). Resolved: precise-cache-write-reserve.
- **4 open follow-ups (mid-wave filings):**
  - w39-phase4-trial-abuse-smoke [HIGH—acceptance gate, blocks trial ship] — Cole DB-swap smoke required; verify $25/day per-user spend cap fires
  - turnstile-captcha-hardening — trial-mint monopoly defense; WebView2 Turnstile spike
  - assistant-entity-context-strip-staleness — chat + About panel reactivity; multi-file latency
  - agent-driven-ui-smoke-harness — test infrastructure; smoke-config.json + Tauri/CDP validation

## Next 3 steps
1. **Cole: run `.\publish.ps1`** to ship v0.9.0 to all installed users. Interactive (updater-key password). Artifact selection version-anchored in the script; do NOT loosen globs (lesson from v0.8.1 stale-installer incident).
2. **Post-deploy smoke tests (Cole-owned, requires real license + tokens).** (a) W48 cache-prefix smoke: confirm cache hits & reserve on real Anthropic key. (b) W39 Phase-4 trial-abuse smoke (DB-swap): verify $25/day per-user spend cap. HIGH priority—acceptance gate for trial feature.
3. **Product judgment (not code).** W48's cache benefit dormant on Haiku (4K-tok floor). Revisit bumping default model tier to Sonnet (1K floor) for caching engagement; cost offset by higher cache-hit volume (M-49 memory: ai-caching-favors-sonnet-upgrade-economics).

## Active work
- **No wave in flight.** All 6 released; batch wrap audited. Next wave pending Cole prioritization.
- **Pending Cole decisions (not code follow-ups).** (1) Marketing site copy review (auto-deploys to writersnook.app on master push via Cloudflare Pages). (2) Trial-abuse smoke sign-off (gate for trial feature ship).
- **Process anchors (carry-forward).** Wave-collapse lapsed—waves 36–50 kept FULL (deliberate recent practice; early waves are stubs). Next parallel waves: use git worktrees (`git worktree add -b wave-NN`, `git worktree remove` at close) or stagger (concurrent-edit risk from W39+W45 shared tree). Dev + installed share %APPDATA%\com.coles.writing\writing.db (real manuscripts, license row). Agent UI smoke via WebView2 CDP port 9222 + tauri-devtools MCP.

## Reference index
- **Release:** v0.9.0 · commit c463be1 · tag v0.9.0 pushed · version bumped in all 4 source files
- **Durable decisions:** [ADR 0014](decisions/0014-trial-identity-server-minted-key.md) (trial-identity server-minted key), [ADR 0015](decisions/0015-trial-abuse-defense-spend-cap.md) (trial spend-cap $25/day per user per day)
- **Vendor-gotchas:** [ollama.md](../.claude/vendor-gotchas/ollama.md) (Ollama dual-endpoint model discovery pitfall; check before local-LLM work)
- **Open follow-ups:** [inbox](follow-ups/) — **HIGH (blocks ship):** w39-phase4-trial-abuse-smoke · **Standard:** turnstile-captcha, assistant-entity-staleness, ui-smoke-harness
- **Project conventions:** [CLAUDE.md](../CLAUDE.md) (process, environment gotchas, publish pipeline) · [decisions/](decisions/) (ADR index) · context: [wave-48](wave-48-cache-prefix-replacement-1h-ttl.md) (cache), [wave-50](wave-50-ai-trial-usage-ux.md) (trial UX)
