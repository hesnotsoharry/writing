---
project: writing
updated: 2026-06-15
---

## Current state
- Branch: wave-49-byok-multi-provider  ·  Latest commit: 05efe17  ·  Tag: none
- Active wave: wave-49-byok-multi-provider (OpenAI BYOK + multi-provider) — COMPLETE, all 5 phases shipped, ready for merge
- **W49 summary (5 phases, 14 commits bb03e9c..05efe17):**
  - P1: OpenAI BYOK walking skeleton — Rust-direct stream to api.openai.com, error handling, IPC contract.
  - P2: Provider-routed engine `byok_engine.rs` — enum-dispatch WireFormat (OpenAiCompatible + OllamaJsonRpc) + shared run_stream backbone for P1.
  - P3: Settings OpenAI key row + unified `useByokKeys` hook; forms save to localStorage; no double-encrypt.
  - P4: Merged AI model picker (Anthropic managed + OpenAI managed + OpenAI BYOK) + registry-driven provider routing + `BYOK_SEND` map.
  - P5: Persistent per-provider usage readout (localStorage counter, tokens + est USD per-provider, Reset zeroes all).
- **Merge context:** branch based on 94ea18d; master now at aebf56c (W48 merged). W49 needs rebase onto post-W48 master.
- **Gates & coverage:** cargo 37/37 ✓ · vitest 1505 ✓ (full suite, all phases touched) · lint/tsc 0 ✓ · wave-end adversarial review PASS ✓ · `/review` mechanical PASS (removed dead `PROVIDER_COMMAND` export) ✓ · New seam tests added for byok_engine WireFormat dispatch. All 5 phase commits include regression tests.
- **Privacy & security:** BYOK key crosses IPC once into Rust, never returns. Managed Cloudflare path untouched. No plaintext credentials logged. Settings key input masked.
- **Smoke & deployment:** Live CDP UI smoke deferred (dev app not running this session). 3 visual observations need Cole eyeball before declaring full ready-for-ship. Branch signed off by adversarial reviewer. After merge, no version bump needed (W48 on master already at v0.8.1); W50 will bump to v0.8.2.

## Next 3 steps
1. **Rebase/merge `wave-49-byok-multi-provider` onto master (`aebf56c`)**: branch is 8 commits behind W48 merge. Expect conflicts in `src/features/ai/AssistantPanel.{tsx,parts,hooks,byok}.ts` + `ai.client.ts` if W48 touched the same surfaces. After merge, re-run full cargo + vitest to confirm W48+W49 integration clean.
2. **Cole live-smoke (`npm run tauri dev`) 3 deferred observations**: (a) Settings→AI shows two key rows (Anthropic + OpenAI) + 'Your key' badge flips on entry/save; (b) merged picker shows keyed-provider groups, selecting GPT model routes to OpenAI, invalid key → sanitized 401; (c) usage readout displays per-provider tokens + est USD after a BYOK turn, Reset button zeroes all to 0.
3. **Relay corrected W45 contract** to parallel W45 agent (4 TS touch points documented in decisions/0005 + wave file Decision 5): `byokUsage` SupportedProvider enum, `useByokKeys` local tracking shape, `byokKeys` type chain, chip-label fallback logic.

## Active work
- **Wave in flight:** [wave-45-local-models](wave-45-local-models.md) (Phase 1 in progress, locally hosted LLM support). Consumes W49's `byok_engine` (run_stream + WireFormat::OpenAiCompatible), BYOK_SEND provider map, PROVIDER_REGISTRY enum. Contract: [decisions/0005](decisions/0005-rust-provider-engine.md).
- **Held waves ready (worktrees required — shared AssistantPanel/credits.ts/chat.ts):** W50 (AI trial & usage UX, PLANNED—launch-gating, run FIRST before W48), W48 (cache-prefix + 1h TTL), W47 parallel (feature, depends on W50 completion).
- **Prior concurrent-sessions issue:** M-49 discovered mixed-authorship commits + contested dev DB when two waves shared the tree (W32 + features). Use git worktrees (`git worktree add -b wave-NN` + `git worktree remove` at close) or stagger next time.
- **Open follow-ups (4):** [inbox](follow-ups/)  ·  top: agent-driven-ui-smoke-harness (NEW—no smoke-config, CDP smoke can't auto-run), assistant-entity-context-strip-staleness, precise-cache-write-reserve, ai-license-key-entry-ui.
- **Follow-up candidate (pending wrap):** BYOK own-key usage/cost visibility UX (Cole-requested 2026-06-14; product refinement, not blocker).
- **Scope & exclusions:** W49 DOES NOT ship multi-user sync, mobile support, or local-storage encryption. Those are P2+. W49 focuses on provider-agnostic Rust engine (load-bearing for W45) + single-user OpenAI BYOK + merged UI.
- **Testing note:** All 5 phase commits include seam tests + regression tests covering new paths (WireFormat dispatch, Settings key save, picker UI routing, usage counter persistence). No new test files added; integrated into existing `tests/` suite.
- **Success criteria post-merge:** (1) W49 rebased & merged to master with clean gates. (2) Cole smoke eyeballs all 3 UI points ✓. (3) W45 gets the corrected contract relay. (4) W50 immediately dispatched (launch-gating sequence). (5) No regression in Anthropic managed flow (existing chat) — verified post-merge by smoke tests.

## Reference index
- Wave file: [wave-49-byok-multi-provider.md](wave-49-byok-multi-provider.md) (5 phase briefs, per-phase gates, committed decisions, per-decision enforcement; `-research.md` sidecar for OpenAI API specs & rate limits)
- Contract for parallel W45: [decisions/0005](decisions/0005-rust-provider-engine.md) — 4 critical TS touch points; do NOT add new byokUsage/useByokKeys shapes without W45 sync
- Promoted decisions: [0004-w49-w45-boundary.md](decisions/0004-w49-w45-boundary.md) (Rust engine abstraction design for W45 local-model support), [0005-rust-provider-engine.md](decisions/0005-rust-provider-engine.md) (WireFormat enum dispatch, W45 contract: 4 TS touch points + integration shape)
- Vendor-gotchas: [openai.md](../.claude/vendor-gotchas/openai.md) (NEW—cached-token double-bill trap, reasoning_effort/temperature 400 limits, canonical model aliases, stream usage reporting), [keyring.md](../.claude/vendor-gotchas/keyring.md) (byok-openai credential entry pattern, Windows keyring integration)
- Implementation notes: byok_engine.rs `run_stream` handler is W49+W45 shared backbone; W45 will extend WireFormat enum. Settings key row mirrors Anthropic pattern (localStorage, no encryption at-rest). Usage counter is LocalStorage-only (not sent to backend).
- Project conventions: [CLAUDE.md](../CLAUDE.md) (process + gotchas) · [decisions/](decisions/) · [follow-ups/](follow-ups/) · prior waves: [wave-48-cache-prefix-replacement-1h-ttl.md](wave-48-cache-prefix-replacement-1h-ttl.md) (context for merge conflicts)
- Wave-wrap pending: promote 0004 & 0005 to `decisions/` (durable ADRs), audit open follow-ups, file BYOK-usage follow-up candidate (pending Cole product sign-off)
- No manual setup required post-merge: OpenAI API key is user-provided (Settings entry), no server-side key storage or rotation
- Post-smoke decision: once Cole eyeballs the 3 UI observations and confirms all pass, W49 is clear for ship. No additional phases. Merge master workflow: checkout W49 branch, rebase onto latest master (resolve conflicts in AssistantPanel/ai.client.ts if needed), re-gate, push, merge → master. W50 dispatch follows immediately (launch-gating dependency, requires worktree to avoid concurrent-edit issues).
