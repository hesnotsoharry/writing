---
project: writing
wave: 48
title: Cache-prefix re-placement + 1-hour TTL (Anthropic prompt caching)
status: PLANNED — verify-first; pick up after W39 merges (credits.ts collision)
created: 2026-06-13
depends_on: [W39 (credits.ts in-flight — merge first)]
relates_to: [W44 (provider-aware caching), follow-up 2026-06-13-precise-cache-write-reserve]
---

# W48 — Cache-prefix re-placement + 1-hour TTL

## Goal (one line)
Make the Anthropic prompt cache survive scene edits (move the volatile scene out of the cached
prefix), THEN extend the TTL 5m→1h — so a real writing session (write → ask → write → ask) keeps the
cache warm and the user's allowance stretches further. **Verify first; do not bust caches.**

## Why / validated finding (2026-06-13)
Investigation confirmed the cache breakpoint wraps the **entire** `system` string in one ephemeral
block (`marketing/functions/api/ai/chat.ts:223`), and the **volatile scene excerpt is inside it**
(`src/features/ai/prompts/shared.ts:66-68`). Consequence:
- Cache **hits** only on back-to-back assists with NO edit between (confirmed: wave-37 smoke, 681→228 credits on a 2nd turn).
- Cache **misses** on the dominant pattern — write/edit between asks — because the changed scene text changes the cached prefix.
- So 5m→1h alone is worthless: an edit during the gap invalidates the cache regardless of TTL. **Placement is the prerequisite; TTL is the multiplier.**

## Locked decisions
1. **Fix placement, THEN flip TTL.** Move scene excerpt + selection into the `messages` user turn; keep the STABLE grounding (role, SHARED_PRINCIPLES, boundary, About, Story-Bible entities, extra scenes) in the cached `system` block. Then 1h TTL.
2. **Verify-first gate (P0).** Empirically confirm current behavior + the floor-risk profile + Anthropic semantics BEFORE refactoring. No code change until P0 says the fix won't degrade caching for any user segment.
3. **Provider-aware structure** — the system-cached / volatile-in-messages split must be expressed so W44's `OpenAIAdapter` handles it too (OpenAI caching is automatic / no breakpoint; the Anthropic breakpoint logic stays Anthropic-only). Keep the refactor compatible with the W44 adapter shape.

## P0 verification result (2026-06-14) — GO

**Verdict: GO on the placement fix.** All three P0 outputs confirmed; live repro skipped per Cole
(live oracle moves to P2 — the production worker is the only deployed endpoint and spends real
Anthropic tokens against a $25/day ceiling; docs + prior smoke already give a confident GO).

1. **Anthropic semantics (ctx7 / platform.claude.com docs):** the cache is a prefix cache ordered
   tools → system → messages. Cache-miss reasons (`system_changed`, `messages_changed`, …) are
   diagnostics for why a prefix could *not be fully reused*; `cache_missed_input_tokens` =
   "tokens that *would have been* read had the prefix matched." A `cache_control` breakpoint at the
   end of an **unchanged** `system` block still produces a `cache_read` hit when only `messages`
   change. Confirmed empirically by wave-37 smoke (681→228 credits on a 2nd assist turn — a 2nd turn
   already carries a different `messages` array, so the system prefix survives a messages change
   today). The only reason an edit-between busts the cache is that the scene text lives *inside* the
   system block. ⇒ Moving scene/selection into `messages` is the correct fix. TTL syntax confirmed:
   `cache_control: { type: "ephemeral", ttl: "1h" }` (defaults `"5m"`).
2. **Floor-risk profile (measured via the real prompt builders — `src/test/w48PrefixMeasurement.test.ts`, temporary):**

   | Segment | Current prefix (scene IN) | Post-refactor (scene OUT) | Verdict |
   |---|---|---|---|
   | Thin (no About/entities) | ~608 tok | ~597 tok | Sub-floor both ways — never cached anyway; no regression |
   | Rich, Sonnet/Opus (1024 floor) | 1716 tok ✓ | **1190 tok ✓ still CACHES** | Cost-relevant segment **protected** |
   | Rich, Haiku (4096 floor) | 1716 tok ✗ | 1190 tok ✗ | Sub-floor both ways — Haiku doesn't cache at typical sizes regardless |

   Savings concentrate on rich-context Sonnet/Opus (clears 1024 after the split). Haiku: no
   regression (it wasn't caching). Caveat: Sonnet headroom on a rich manuscript is modest (~166 tok);
   *medium*-context users near 1024 may stop caching on the rare no-edit case — economically
   negligible (their prompts are cheap). Matches the wave's stated assumption.
3. **Live repro:** skipped at P0 (Cole's call); the proof-that-matters (edit-between keeps cache
   warm) runs as the P2 live oracle.

## The known caveat to protect against (the "don't bust caches" risk)
Removing the scene SHRINKS the cached prefix. Anthropic won't cache below a per-model floor —
**Haiku 4096 tokens, Sonnet/Opus 1024** (`prompt-cache.ts` MIN_CACHEABLE_TOKENS; see
[[ai-caching-favors-sonnet-upgrade-economics]]). Risk: for a thin About/Story-Bible user on Haiku, the
stable-only prefix may fall below 4096 → caching stops firing entirely. P0 must measure real prefix
sizes (thin vs rich manuscripts) so we know who keeps caching and who doesn't. (Thin-context users have
cheap prompts anyway; the savings concentrate on rich-context + Sonnet/Opus users — which is where the
cost is. Acceptable, but must be confirmed, not assumed.)

## Phases
- **P0 — Verify findings (HARD GATE — Cole's requirement):**
  - **Reproduce the behavior live** via CDP / live-proxy smoke (tauri-devtools, M-57 oracle): observe `cache_read_input_tokens` + `cache_creation_input_tokens` in the proxy responses across three flows — (a) two assists, no edit between (expect hit), (b) edit scene between assists (expect miss — the diagnosed bug), (c) baseline cold.
  - **Measure stable-prefix token size** (role+principles+about+entities, scene EXCLUDED) on representative manuscripts — a thin-context one and a rich one — against the 4096 (Haiku) / 1024 (Sonnet/Opus) floors. Output the who-keeps-caching profile.
  - **Confirm Anthropic prefix-cache semantics** via ctx7/docs (research-before-implementing fires — we're touching caching API behavior): verify that changing `messages` AFTER a cached `system` breakpoint preserves the system cache hit (i.e. the proposed split actually works on the current API).
  - **Output:** confirmed diagnosis + GO/NO-GO on the placement fix + the floor-risk profile. NO-GO if the stable prefix can't clear the floor for the target segment without including volatile content.
- **P1 — Re-place the prefix:** in `shared.ts` `buildGrounding()`, move `sceneExcerpt` + `selectionText` out of `system` into the `messages` user turn (affects all 4 verbs + Ask/W47, centralized). Keep `shouldAttachCache` gating correct against the new (smaller) prefix.
- **P2 — Verify cache survives edits:** re-run flow (b) — edit scene between assists → cache_read now fires across the edit. This is the proof the fix worked (green unit tests ≠ real caching — the live token counts are the oracle).
- **P3 — Flip TTL to 1h:** add `ttl: '1h'` to the `cache_control` block (`chat.ts:223`) + pass `cacheWriteTtl: '1h'` to `actualCredits` (`credits.ts` already has `cacheWrite1h` rates). Reconcile with the `precise-cache-write-reserve` follow-up — reserve the 1h cache-write rate when caching fires.
- **P4 — Verify economics:** measure a realistic session (write→ask→write→ask) before/after; confirm the allowance stretches further and there are no cost regressions for the no-edit case (the 2× write premium must be offset by enough reads).

## Execution results (2026-06-14)

- **P0 — GO** (above). Live repro skipped per Cole; live oracle moved to P2.
- **P1 — DONE** (commit `5642d8a`). `buildGrounding()` now returns only stable grounding;
  new `buildVolatileUserBlock(ctx)` assembles scene excerpt + truncation notice + selection;
  `buildMessages()` prepends it to the current ask for all 5 verbs. Scene TITLE stays in `system`
  (stable during an edit). Gates green (lint/tsc/tests); reviewer FLAG resolved (lockfile sync
  excluded from commit; acceptance test orchestrator-authored pre-dispatch). Provider-agnostic —
  no adapter change (Decision 3 honored).
- **P3 — DONE** (commit `e4d53d8`). `cache_control: { type: "ephemeral", ttl: "1h" }` +
  required `anthropic-beta: extended-cache-ttl-2025-04-11` header (ctx7-verified: 1h gates on this
  header; omitting it silently no-ops the flip). `actualCredits` now billed at `"1h"`;
  `estimateCredits(systemLength?)` reserves the cacheable prefix at the 1h cache-write rate,
  restoring `reserve ≥ actual` on cold cache-creation turns — **closes follow-up
  `2026-06-13-precise-cache-write-reserve`**. 27/27 tests; tsc clean; reviewer FLAG_UNCERTAIN was a
  diff-capture artifact (new test file verified on disk).
- **P2 / P4 — LIVE ORACLE, POST-DEPLOY.** Both require the deployed worker (P3 deploys on merge to
  master) + real Anthropic tokens, so they run **after the merge-master lands this branch and
  Cloudflare deploys** — not in this branch-only session (merge protocol: do not merge/deploy here).
  Procedure when deployed (dev app on CDP port 9222 per [[app-can-be-smoked-via-cdp-port]]):
  - **P2 (cache survives edits):** open the app → run an AI assist on a rich-context scene (note
    credits) → EDIT the scene text → run the same verb again → confirm the worker response shows
    `cache_read_input_tokens > 0` across the edit (this is the proof P1 worked; pre-fix this was a
    miss). Sonnet/Opus or a rich Haiku manuscript (must clear the floor — see P0 profile).
  - **P4 (economics):** measure a write→ask→write→ask session before/after; confirm the allowance
    stretches and the no-edit case has no cost regression (the 2× 1h-write premium offset by reads).
  - **Ready-to-run script (staged on-branch):** `marketing/scripts/w48-cache-smoke.mjs` — behavior-level
    HTTP probes against the deployed worker (auth → `/api/ai/chat`, oracle = the `done` SSE event's
    `creditsCost`). Covers P2 (warm-edited turn ≈ warm no-edit turn ≪ cold) and P4 (session total vs
    naive no-cache) in one run. `LICENSE_KEY=… node marketing/scripts/w48-cache-smoke.mjs`. Spends real
    tokens. **Forces `model=claude-sonnet-4-6`** — see the follow-up candidate below for why Haiku can't
    demonstrate it.

## Follow-up candidates

- **W48 cache benefit is DORMANT on the live all-Haiku verb-config.** present-harm: K3 — named consumer
  `marketing/functions/_lib/verb-config.ts` pins every verb to `claude-haiku-4-5` (4096-token cache
  floor); a realistic stable prefix is ~1,200 tokens (P0 measurement), so `shouldAttachCache` returns
  false and the cache never attaches at typical manuscript sizes. W48's placement + 1h TTL are correct
  but deliver zero user-facing savings until the verbs run on Sonnet/Opus (1024 floor) or a manuscript
  carries a >16k-char Story Bible. Cannot be done in-wave (it's a model-tier product/cost decision, not
  a code fix). Ties to [[ai-caching-favors-sonnet-upgrade-economics]] — revisit alongside any Haiku→Sonnet
  upgrade wave. (Verifiable: run the smoke with default Haiku vs `MODEL=claude-sonnet-4-6` — the Haiku
  run shows flat per-turn `creditsCost`; the Sonnet run shows the cold/warm split.)

## Risks / gotchas
- **Haiku 4096 floor** (above) — the central "don't bust caches" risk; P0 gates on it.
- **Anthropic semantics drift** — confirm current behavior via ctx7, don't trust training memory.
- **Merge collision** — touches `credits.ts` (W39's worktree) + worker + `shared.ts`. Land after W39 merges; serial with the worker/AI family (W42/W44).
- **Provider divergence** — keep the refactor compatible with W44's adapter; OpenAI caching is automatic and needs no breakpoint.
- **Live deploy** — the worker change deploys on push to master (Cloudflare). Verify on a dev/preview path first; coordinate the deploy.

## Sequencing
After **W39 merges** (credits.ts). Serial with the worker/AI family. Independent of the UI-followups
batch. Closes/addresses follow-up `2026-06-13-precise-cache-write-reserve` (assess at P3).

## Result

### Mechanical review

**Inputs resolved:**
- Plan: `roadmap/wave-48-cache-prefix-replacement-1h-ttl.md`
- Diff range: `94ea18d..HEAD` (P1 `5642d8a`, P3 `e4d53d8`)
- Graph: healthy (indexed, 5730 nodes / 9288 edges, 0 parse anomalies)
- Run timestamp: 2026-06-15T00:52:39Z

#### Check 1: Forward-trace — PASS
- Change sites traced: 5 (`estimateCredits`, `buildRequest`, `actualCredits` call, `buildMessages`, `buildVolatileUserBlock`); flagged dead: 0.
- `buildVolatileUserBlock` → `buildMessages` (index.ts:67) → AssistantPanel.hooks.ts:156 + AssistantPanel.byok.ts:65 (production, both managed + BYOK paths).
- `estimateCredits(systemLength)` / `actualCredits("1h")` → chat.ts reserve + reconcile (production). Threaded `systemLength` consumed, no silent drop.

#### Check 2: Plan universal-quantifier cross-reference — PASS
- "affects all 4 verbs + Ask/W47, centralized" (P1): the volatile block is applied once in `buildMessages`, which is the sole entry for all 5 verbs via `routeVerb` — every verb covered. (Note: the acceptance test's VERBS array covers 4; `ask` is covered by the code path but not unit-asserted — coverage nuance, not a code gap.)

#### Check 3: Export audit — PASS
- New exports: 1 (`buildVolatileUserBlock`). Production consumer: `index.ts:13` import + `:67` call. `EXTENDED_CACHE_TTL_BETA` is module-internal (not exported).

#### Checks 4–6 N/A
- Check 4: no schema property removals. Check 5: no `cross-boundary` phase classification in the plan (orchestrator authored acceptance tests anyway: `aiVerbPrompts.test.ts` for P1, `credits.w48.test.ts` for P3). Check 6: no `stryker.config` in project.

#### Verdict

**PASS** — Checks 1–3 ran clean against the real call graph; 4–6 N/A. P1 placement and P3 TTL/billing changes all reach production consumers with no dead paths or narrowed universals. Live behavioral proof (cache survives edits; economics) is the post-deploy P2/P4 oracle, not in mechanical scope.

### Wave-end adversarial review (attack-diff, wave granularity)

**Verdict: FLAG → addressed.** Reviewer confirmed ZERO correctness defects: cross-phase
composition clean (P1's smaller system + P3's reserve/adapter both gate on the identical
`shouldAttachCache(ceil(system.length/4), model)`); reserve ≥ actual holds cold & warm for all 3
models; the `actualCredits("1h")` reconcile is consistent with the adapter attach decision; OpenAI
path untouched. Two test-adequacy flags raised and **both closed** (commit follows):
- `ask` verb (primary multi-turn path) now has a dedicated `buildMessages("ask", …)` placement test
  (single + multi-turn) in `aiVerbPrompts.test.ts`.
- `anthropic.w48.test.ts` now has a combined "header iff cache_control body form" invariant test
  (long → array system + beta header; short → plain-string system + no header).

Tests after fixes: `aiVerbPrompts.test.ts` 36/36; marketing W48 suite 28/28.
