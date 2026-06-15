---
status: SHIPPED
created: 2026-06-13
handed-off: 2026-06-14
shipped: 2026-06-14
---

> **WRAPPED 2026-06-14 (merge-master):** Code SHIPPED in the launch batch (merge `48d3130`).
> Phases 1–3 implemented + unit/integration-verified. **OPEN ACCEPTANCE GATE:** Phase 4 (CDP
> trial-abuse smoke) is still unrun — Cole owns it (the ~$1.50 manual burn to verify abuse caps).
> Tracked as an open follow-up in `roadmap/follow-ups/` + the HANDOFF ⚠️ CRITICAL note. Full
> stub-collapse + ADR promotion deferred to the W45/48/49/50 batch wrap. Close-out checklist in
> **## Remaining before merge** below.

# Wave 39 — Trial AI Gating (dollar-allowance + abuse caps)

## Plan

### Status

DRAFT · target v0.9.0 · drafted 2026-06-13. Design pre-locked (opus-architect + attack-decision review). LAUNCH-CRITICAL (Reddit-launch trio: W38 honesty / **W39 trial-gating** / W43 site-surface).

### Goal

After this wave, a non-subscriber **trial** user gets a small, server-enforced dollar-allowance of AI (~$1.50, a config constant) instead of today's all-or-nothing behavior, and that allowance is metered through the **exact same** credit spine subscribers already use — the live cost-meter, the reserve/refund RPC accounting, and the 429 hard-stop. Trial AI is identified server-side by an opaque server-minted `trial_<uuid>` key mapped to a synthetic `subscriptions` row (`status='trial'`); the worker bounds total trial spend with a hard **global daily spend cap** (the dollar ceiling) plus a **per-IP grant cap** (Sybil friction), gated behind a `TRIAL_AI_ENABLED` kill-switch. When a trial user exhausts the allowance, AI hard-stops while every non-AI feature stays fully usable. **Verification strategy (wave-level):** honeycomb — unit/acceptance tests at the worker + RPC seams (the boundary is where this fails), with the user-observable behavior confirmed end-to-end by a CDP smoke at the final phase (green vitest ≠ working, per project oracle).

### Scope

**In scope:**

- `marketing/supabase/0006_trial_ai.sql` (author-only migration; Cole applies): `subscriptions.status` CHECK extended with `'trial'`; `check_rate_limit` broadened to `status IN ('active','trial')`; new `trial_budget(day)` + `trial_ip_grants(ip_hash, day)` counter tables; new RPCs `grant_trial`, `reserve_trial_credits`, `refund_trial_credits` (atomic, `RAISE EXCEPTION` rollback on partial write); `service_role` grants; documented rollback-teardown comment.
- `marketing/functions/_lib/credits.ts`: constants `TRIAL_ALLOWANCE = 150_000` ($1.50), `GLOBAL_DAILY_TRIAL_SPEND_CAP = 2_500_000` ($25/day), `PER_IP_DAILY_GRANT_CAP = 3`.
- New `marketing/functions/api/ai/trial-session.ts`: re-exchange (stored trial key → token) + first-grant (kill-switch → `CF-Connecting-IP` HMAC → `grant_trial` → token).
- `marketing/functions/api/ai/chat.ts`: status-branch (`'active'`→existing reserve/refund, `'trial'`→trial RPCs); open the `status !== 'active'` gate to admit `'trial'`; dual-429 (credits-exhausted vs trial-budget-exhausted).
- `marketing/functions/api/ai/balance.ts`: add `credits_monthly` to the SELECT; return `status:'trial'` + `monthlyAllowance = credits_monthly` for trial rows.
- App: `ai.client.ts` `acquireTrialSession()` + `BalanceResult.status` union; `settings.store.ts` `aiTrialKey` tweak; `AssistantPanel.tsx`/`AssistantPanel.hooks.ts` trial branch (lazy first-use mint, re-exchange, meter reuse via `computeUsedPct`/`aiMeterStatus`); `App.tsx` thread `gateStatus`; `AiOverlays.tsx` trial-aware consent copy.
- Tests at every seam (worker endpoints, RPCs, app trial branch).
- End-to-end CDP smoke of the trial flow (mint → meter → exhaustion → hard-stop → non-AI still usable).

**Out of scope:**

- **Turnstile / CAPTCHA human-gate on the trial-mint endpoint** — deferred to a fast-follow hardening wave (W39.x) per Cole's locked scope decision. Its WebView2-render risk needs a Phase-0 spike and must not gate the launch-critical path. The global spend cap (this wave) already bounds dollars; Turnstile only adds budget-monopoly protection.
- **Per-ASN grant cap** — design'd as secondary/default-off; not built this wave.
- **Sonnet model toggle / multi-provider credit** — W44.
- **BYOK** — W40.
- **Marketing HTML honesty fixes / site-surface** — W38 / W43 (separate waves; already partly shipped).
- **Trial→subscriber balance migration** — none needed; activation issues a real `aiLicenseKey` and the orphan `trial_` row is harmless (drained or not).

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Schema + constants: `0006_trial_ai.sql` (CHECK += `trial`, broaden `check_rate_limit`, `trial_budget`/`trial_ip_grants` tables, `grant_trial`/`reserve_trial_credits`/`refund_trial_credits` RPCs, grants, rollback teardown) + `credits.ts` trial constants | sonnet-implementer | honeycomb · **cross-boundary** (persistent storage / non-trivial schema) · atomic reserve-and-budget-debit in one RPC with `RAISE EXCEPTION` rollback (the 0005-class atomicity lynchpin); RPC behavior covered by `credits.test.ts`-pattern unit tests. Orchestrator authors failing acceptance tests for the RPC contracts before dispatch. | Internal — no observation point |
| 2 | Worker trial path: new `trial-session.ts` (kill-switch + IP-hash + `grant_trial` + token mint; re-exchange skips grant) · `chat.ts` status-branch + dual-429 · `balance.ts` `credits_monthly` SELECT + `status:'trial'` | sonnet-implementer | honeycomb · **cross-boundary** (external API + persistent storage) · reuse `ai-token.ts` `buildToken`/`verifyToken` verbatim (token wraps the trial key, zero token-layer change) · tests mirror `session.test.ts`/`chat.test.ts`/`balance.test.ts`. Orchestrator authors failing acceptance tests for the endpoint contracts before dispatch. | Internal — no observation point |
| 3 | App trial wiring: `acquireTrialSession` + `aiTrialKey` tweak + `useAiBalance`/`execSend` trial branch (lazy first-use mint, re-exchange) + meter reuse + thread `gateStatus` + trial-aware consent copy | sonnet-implementer | trophy (UI + state) · **cross-boundary** (consumes the Phase-2 worker contract) · REUSE the existing meter (`computeUsedPct`/`aiMeterStatus` thresholds) + `ExhaustedAllowanceGuard` — do NOT build a new counter · extend `aiConsent`/`AssistantPanel` tests for the trial branch. | In a fresh trial session (no license key), the AI Assistant panel's footer cost-meter renders a live $-used reading against the ~$1.50 trial allowance (e.g. footer shows "About half left") and the assistant's reply appears in the chat thread. |
| 4 | End-to-end CDP smoke (project oracle): drive a fresh trial → mint → meter → spend to exhaustion → hard-stop → confirm non-AI features still usable; low-cap run → global 429; per-IP cap | orchestrator | trophy · **cross-boundary** · runs the M-57 runtime oracle (Tauri CDP) per the DB-swap smoke protocol; needs worker reachable (deployed or `wrangler pages dev`) + Supabase 0006 applied + `TRIAL_AI_ENABLED=true`. This is the wave's acceptance gate. | A trial user spends the allowance to zero and the AI panel shows the "Used up" exhausted-guard state while the editor + binder remain fully usable; the footer meter shows live cost climbing throughout. |

### Acceptance criteria

- [ ] `marketing/supabase/0006_trial_ai.sql` exists and: extends the `subscriptions_status_check` CHECK to include `'trial'`; broadens `check_rate_limit` to `status IN ('active','trial')`; creates `trial_budget` + `trial_ip_grants`; defines `grant_trial`, `reserve_trial_credits`, `refund_trial_credits`; grants EXECUTE to `service_role`; carries a rollback-teardown comment (delete trial rows + their `credit_events` before reverting the CHECK; uses the exact constraint name `subscriptions_status_check`).
- [x] `reserve_trial_credits` atomically debits `trial_budget(CURRENT_DATE)` gated by `spent_units + amount <= GLOBAL_DAILY_TRIAL_SPEND_CAP` AND debits the row balance, rolling back the row debit via a **compensating UPDATE within the single-transaction plpgsql function** if the budget guard trips (equivalent atomicity to `RAISE EXCEPTION`; the wave-end review confirmed correctness + row-lock serialization). The row-balance-unchanged invariant is validated by the Phase-4 smoke — there is no live-Postgres unit harness, so this is not a vitest assertion.
- [ ] `marketing/functions/_lib/credits.ts` exports `TRIAL_ALLOWANCE = 150_000`, `GLOBAL_DAILY_TRIAL_SPEND_CAP = 2_500_000`, `PER_IP_DAILY_GRANT_CAP = 3`.
- [ ] `POST /api/ai/trial-session` with no body, `TRIAL_AI_ENABLED='true'`, under the per-IP cap → 200 with `{ trialKey, token, expiresAt, allowance: 150000 }`; with a valid stored `trialKey` → 200 re-exchange (no new `grant_trial` call); with `TRIAL_AI_ENABLED!=='true'` → 403 `{error:'trial_disabled'}`; over the per-IP cap → 429 `{error:'trial_ip_capped'}`.
- [ ] `chat.ts` admits `status='trial'` rows (no 403) and routes them through `reserve_trial_credits`/`refund_trial_credits`; returns the existing credits-exhausted 429 when the trial row balance is 0, and a distinct trial-budget 429 when the global cap is hit with balance remaining.
- [ ] `balance.ts` for a `status='trial'` row returns `{ status:'trial', monthlyAllowance: <row credits_monthly = 150000>, creditsBalance, resetAt }` (NOT the hardcoded subscriber `MONTHLY_ALLOWANCE`).
- [ ] App: with `aiLicenseKey===''` and `gateStatus==='trial'`, first AI send lazily mints + stores `aiTrialKey`, and `useAiBalance` renders the meter from the trial allowance via the existing `computeUsedPct`/`aiMeterStatus` (no new counter component added).
- [ ] `npm run test` (worker + app), `npm run lint`, and `tsc` all exit 0 on touched files; marketing tests are test+tsc only (no lint in `marketing/`).
- [ ] CDP smoke (Phase 4): a fresh trial spends to exhaustion → AI panel shows the `ExhaustedAllowanceGuard` ("Used up") state, the footer meter showed live cost while spending, and the editor + binder remain fully interactive after exhaustion.

### Files the next agent should read first

1. `roadmap/wave-39-trial-gating.md` `## Locked decisions` — the three decisions that govern this wave (identity, abuse-defense, schema). **Read first.**
2. `roadmap/discovery/2026-06-13-reddit-launch-readiness.md` — § "W39 — trial-gating" + "Decision 1" (the source spec).
3. `marketing/supabase/0003_credit_reserve.sql` — the `reserve_credits`/`refund_credits`/`check_rate_limit` RPCs the trial RPCs parallel (atomic WHERE-clause pattern); and `0005_topup_credits_dedup.sql` for the atomicity/idempotency precedent.
4. `marketing/functions/api/ai/chat.ts` — the reserve→stream→refund flow + the `status !== 'active'` gate (the branch point) + the two existing 429 shapes.
5. `marketing/functions/api/ai/{session,balance}.ts` + `marketing/functions/_lib/{ai-token,credits}.ts` — token mint/verify (reused verbatim), the RATES table, the balance response shape (note the hardcoded `MONTHLY_ALLOWANCE`).
6. `src/features/ai/{ai.client.ts,AssistantPanel.tsx,AssistantPanel.hooks.ts,ai.helpers.ts}` — `acquireSession`, `useAiBalance` (bails on empty key today), `computeUsedPct`/`aiMeterStatus`, `ExhaustedAllowanceGuard`.
7. `src/features/license/{license.gate.ts,trial.ts}` + `src/features/settings/settings.store.ts` — `gateStatus` states + `aiLicenseKey` tweak shape the new `aiTrialKey` mirrors.

### Note to the implementer

The spirit of this wave is **reuse, not rebuild**: trial metering rides the subscriber credit spine that already works end-to-end — you are adding a `status='trial'` fork at each layer, not a parallel system. The single load-bearing piece of new logic is the atomic global-budget debit inside `reserve_trial_credits` (treat it with the same care `0005` got — a non-atomic budget-then-reserve is the rejected design). Resist these temptations: building a new "N assists left" counter (the existing `aiMeterStatus` thresholds ARE the nudge), adding Turnstile (explicitly deferred — out of scope), touching the subscriber `reserve_credits` path, or "improving" the marketing HTML (W38/W43). First step: verify the `## Locked decisions` section below is filled in and read all three decisions.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

> These three decisions cleared the decision-review cell before being written here: produced by `opus-architect` (full blueprint, current-doc research, sources cited 2026-06-13), adversarially reviewed by `sonnet-adversarial-reviewer` (`Posture: attack-decision`, overall verdict FLAG), and adjudicated by the orchestrator (Cole locked the two product/scope forks). The FLAG conditions are folded into Scope + Acceptance above.

### Decision 1: Trial identity — server-minted opaque key → synthetic `subscriptions` row

**Context:** an account-less trial user has no credential the worker recognizes (all metering keys on `license_key`).
**Pick:** the worker mints an opaque `trial_<uuidv4>` key on first grant and inserts a synthetic `subscriptions` row (`status='trial'`, `credits_balance = credits_monthly = TRIAL_ALLOWANCE`); the existing HMAC session token wraps that key verbatim (no `ai-token.ts` change). Client stores it as the `aiTrialKey` localStorage tweak.
**Rationale:** every existing worker path (`verifyToken` → subscriptions lookup → reserve/refund/meter) recognizes the trial row with zero token-layer change; a replayed key drains at most one fixed $1.50 bucket (no amplification); no device data (privacy-clean).
**Consequences:** trial rows live in `subscriptions` keyed by a `trial_`-prefixed key; `status='trial'` must be admitted at the (four) `status='active'` gates touched this wave.
**Enforcement:** the `subscriptions` lookup in `chat.ts`/`balance.ts`; the new `trial-session.ts` mint path. advisory-only at the doctrine layer; enforced in code by those sites.
**durable: candidate** (the trial-identity pattern will be cited by W40 BYOK / W44 multi-provider).

### Decision 2: Abuse defense — hard global daily spend cap + per-IP grant cap; CAPTCHA deferred

**Context (3+ axes in genuine tension):** bounding worst-case dollar exposure against scripted reinstall/Sybil farming, vs. the "no account, no card" product promise, vs. privacy-first positioning (no fingerprinting), vs. ship-speed on the launch-critical path. Cole's explicit concern: automated install/reinstall farming in isolated environments racking up real Anthropic spend.
**Options considered:** *Industry standard* — Turnstile + per-IP limit (does NOT bound dollars; CAPTCHA-solvers + proxies defeat it). *Emerging (PICKED)* — add a **global daily trial-SPEND ceiling** enforced atomically at credit-reserve, with Turnstile + per-IP repositioned as budget-monopoly protection. *Cutting-edge* — + proof-of-work / Privacy Pass (overkill for a $1.50 trial; no marginal dollar-bound benefit).
**Pick:** ship the **global daily spend cap** ($25/day = 2,500,000 units, Cole-locked) as the hard dollar ceiling + the **per-IP daily grant cap** (3/IP/UTC-day via salted `HMAC(CF-Connecting-IP)`) + a `TRIAL_AI_ENABLED` kill-switch, all server-side. **DEFER Turnstile** to a fast-follow (Cole-locked) — it carries the only WebView2-render risk and adds friction to a no-account product; the global cap already bounds dollars without it.
**Rationale:** the global cap mathematically bounds total trial AI spend to $25/day regardless of how many keys/IPs/VMs an attacker creates — every trial reserve passes through the one shared `trial_budget(day)` counter. Turnstile's only added value (protecting legit users from budget-monopoly) is a fast-follow concern, not a dollar-exposure concern.
**Consequences:** worst-case trial AI exposure = **$25/day (~$750/mo), hard**. When a day's budget exhausts, NEW trials that day hit a budget-429 (existing trial holders + all non-AI features unaffected; resets daily; kill-switch is the manual override). Reserve-vs-actual accounting tracks actual spend on refund, so the cap is hard modulo the documented sub-cent cache-write-premium under-count.
**Enforcement:** `reserve_trial_credits` (global ceiling, atomic) + `grant_trial` (per-IP) + `TRIAL_AI_ENABLED` env (kill-switch). Mechanical, in the RPCs + endpoint.
**durable: candidate** (the spend-cap-as-ceiling pattern generalizes to any future free-tier).

### Decision 3: Schema — extend `subscriptions` with `status='trial'`; separate trial RPCs; one migration 0006

**Context:** where trial rows + counters live, and whether to broaden the subscriber RPCs or add trial-specific ones.
**Pick:** keep trial rows in `subscriptions` under a new `status='trial'` CHECK variant (reuses meter/hard-stop/ledger); add SEPARATE `grant_trial`/`reserve_trial_credits`/`refund_trial_credits` RPCs (the trial reserve must also move the global budget — folding that into `reserve_credits` would burden the subscriber money path); add two small counter tables; broaden only the shared `check_rate_limit` to include `'trial'`. One author-applied migration `0006_trial_ai.sql`.
**Rationale:** `status='trial'` keeps semantics clean (trial rows leave `ls_subscription_id` NULL, so `reset_credits`/`topup_credits`/webhooks never touch them — verified); additive CHECK + new tables forward-apply safely.
**Consequences:** the `status='active'` gate must be opened in BOTH `chat.ts` and `balance.ts` (+ the RPC-internal gates handled by using the trial RPCs); `status='trial'` rows will appear in any unfiltered `subscriptions` count (documented; analytics must filter); migration needs a documented rollback teardown.
**Enforcement:** the CHECK constraint + the three RPCs + `service_role` grants in `0006_trial_ai.sql`.

## Status

| Phase | Dispatched | Completed | Commit | Observation point hit |
|---|---|---|---|---|
| 1 — schema + constants | ✅ run-phase (panel) | ✅ | 928c460 | Internal — gates green (tsc 0, 15/15 tests); SQL contract-match verified independently |
| 2 — worker trial path | ✅ run-phase (panel) | ✅ | 77cbce7 | Internal — gates green (tsc 0, 55/55 worker tests); panel FLAG (fail-open reserve on RPC error) fixed + regression-tested |
| 3 — app trial wiring | ✅ run-phase (single) | ✅ | de13de4 | jsdom/unit verified (acceptance 3/3, trialWiring 3/3); runtime meter is the Phase-4 oracle — not smoked here (no live worker) |
| 4 — CDP smoke | ⏸ PAUSED — Supabase migration state (Cole, 2026-06-14) | | | |

> Full pre-smoke verification (2026-06-14): root app tsc 0 / lint 0 / **1404 tests**; marketing tsc 0 / **219 tests**. Phase-3 single-reviewer FLAGs all minor (token-freshness DRY via shared `isFresh`; trial-context error copy on a deep re-grant-fail edge) — accepted, none touch the core trial flow.

> Phase 1 note: panel returned BLOCK on an orchestrator acceptance-test bug (a gratuitous `cap % allowance === 0` assertion — $25/day isn't an even multiple of $1.50, nor need it be). Corrected the test; constants are the Cole-locked values. Marketing sub-project deps installed (tsc gate needs `@cloudflare/workers-types`); package-lock own-version sync reverted (out of W39 scope).

## Follow-up candidates

- W39.x Turnstile/CAPTCHA hardening on `/api/ai/trial-session` (deferred from this wave): | why-defer: needs a Phase-0 WebView2-render spike + system-browser/deep-link fallback design; cross-boundary (worker + app + Cloudflare dashboard config) and cannot be cleared by a single sonnet-implementer dispatch. | present-harm: during the Reddit launch surge, with no CAPTCHA, a single script can drain the $25/day global trial budget early each day and DoS real trial-users out of AI — the conversion lever W39 exists to create (dated observation 2026-06-13, design attack-decision review Angle 2/6).

- BYOK own-key usage visibility (routed from W40/BYOK — filed here for wrap since W40 already wrapped): | why-defer: needs a product decision on unit (token count vs request count vs coarse gauge) + placement before any impl; the data wiring reuses the BYOK stream's already-returned usage — a UX/product call, not a single mechanical dispatch. | present-harm: K3 — observed 2026-06-14 (Cole's live-key check); BYOK mode suppresses ALL usage cues (W40 meter-no-op, commit b0b7383), so a user spending on their own Anthropic key gets zero in-app feedback on consumption.

## Wave-end review (2026-06-14)

Top-level attack-diff **panel of 3** (contract/integration · security/money · spec/scope) at wave granularity. **Verdict: 3× FLAG, no BLOCK.** Confirmed correct: SQL atomicity + row-lock serialization, the fail-closed reserve guard, all four `status='active'`→`'trial'` gate openings, token safety (unforgeable HMAC; a stolen trial key drains ≤ one $1.50 bucket), trial-row isolation from subscriber ops (NULL `ls_subscription_id`), and full acceptance-criteria coverage. Four findings:

- **[A — FIXED 2026-06-14]** `trial-session.ts` `IP_HASH_SECRET ?? ""` ran HMAC with an empty key when the env var was unset → precomputable (reversible) IP hash, silently breaking the "raw IP never stored" privacy property. **Fixed:** the first-grant path now returns 500 (fail-closed) if `IP_HASH_SECRET` is missing, mirroring `buildToken`'s required-secret posture. Acceptance test added.

The following 3 are **handed to the merge master / a fast-follow** (precise diagnoses, address before the launch go-live; none block merge-after-smoke):

- **[B — UX, pre-launch] `trial_budget_exhausted` 429 not distinguished app-side.** The worker emits a distinct `429 {error:'trial_budget_exhausted'}` (global $25/day cap hit), but `streamChat`'s 429 handler (`src/features/ai/ai.client.ts` ~193-204) lumps it with the credits-exhausted shape → the chat thread shows "[Monthly allowance used up — resets soon]" (`AssistantPanel.hooks.ts` ~169), which is FALSE (the user's personal balance is intact). After `refresh`, balance is positive, `usedPct<100`, `canCompose` stays true → silent retry loop until UTC midnight. **Fix:** add a branch in the `streamChat` 429 handler for `body.error === 'trial_budget_exhausted'` → a distinct event + accurate copy ("Trial AI is at today's shared limit — try again tomorrow"). Highest-value before a high-traffic launch (a Reddit surge can exhaust the global cap, hitting many real trial users at once).
- **[C — metering, narrow] Stale trial token after in-session subscription activation.** `acquireAnyToken` (`src/features/ai/ai.trialToken.ts:38-45`) checks `isFresh(ref)` and can return a cached **trial** token to a user who activated a subscription mid-session (gateStatus 'trial'→'cleared') without a reload — so subscriber sends debit the trial bucket for ≤4h (the token TTL). Requires: trial AI use → in-session activation (no reload) → send within 4h. **Fix:** invalidate `sessionRef.current` when `gateStatus` transitions to 'cleared' (or track the ref's owner identity and re-acquire on mismatch). Add a test: ref holds a trial token, `aiLicenseKey` set, next `acquireAnyToken` mints a subscriber token (calls `acquireSession`, not the stale trial token).
- **[D — money-edge, ACCEPTED] `refund_trial_credits` walks back `CURRENT_DATE`.** A stream crossing UTC midnight refunds against the new day's `trial_budget` row rather than the reserve day's, so the new day can spend marginally over $25 by the sum of midnight-crossing refunds (bounded, sub-dollar per occurrence, seconds-wide window, self-correcting next day). **Accepted** as a known bounded edge — a proper fix (pass + target the reserve day) is disproportionate to the magnitude. Documented here and in Decision 2's consequences. Revisit if trial volume ever makes the midnight window material.

## Remaining before merge (handoff to merge master)

Phases 1–3 are done + committed (see `## Status`). Three things remain, in order:

**1. Apply Supabase migrations (author-only — apply manually; agents don't touch the live DB).**
- Apply **in order: `0005_topup_credits_dedup.sql` → `0006_trial_ai.sql`**. (Per Cole 2026-06-14, 0005 may still be unapplied to prod.)
- `0006` is **independent of 0005** (disjoint objects — 0006 only writes `grant`/`reserve`/`refund` events; 0005's unique index is scoped to `top_up`). `0006` requires **0002 + 0003** (already live — the subscriber AI path is in prod). So 0006 applies cleanly with or without 0005, but apply in sequence for hygiene. `0006` is additive (new `trial` status value + `trial_budget`/`trial_ip_grants` tables + 3 RPCs + `check_rate_limit` broaden) and ships a rollback teardown comment inline.

**2. Phase 4 CDP smoke (the acceptance gate) — against a LOCAL worker, never prod.**
- *Worker:* in `marketing/.dev.vars` set the AI vars incl. the two new ones — `TRIAL_AI_ENABLED=true`, `IP_HASH_SECRET=<any string>` (template updated in `.dev.vars.example`). Run `cd marketing && npm run dev` (→ `wrangler pages dev`, port **8788**). Point `.dev.vars` SUPABASE_* at the DB where 0006 was applied.
- *App:* create `.env.local` at repo root with `VITE_AI_PROXY_URL=http://localhost:8788`, then `npm run tauri dev`. App must be in **trial state** (`gateStatus='trial'` → no license-activation row) with AI consent on — use the **DB-swap smoke protocol** (swap in a trial-state `writing.db`; never edit the live one — it holds real manuscripts + the license row).
- *Verify (the user-observable oracle — green vitest ≠ working):* first AI use silently mints a `trial_<uuid>` → footer cost-meter shows live $-used against the $1.50 allowance → spending to exhaustion fires the `ExhaustedAllowanceGuard` ("Used up") while the editor/binder stay fully usable. To reach exhaustion fast (real = ~100 Haiku assists), seed one trial `subscriptions` row with a tiny `credits_balance` and point the app's `aiTrialKey` at it.
- *Server caps (probe the worker directly — not UI-observable):* `POST /api/ai/trial-session` first-grant → 200 + `allowance:150000`; kill-switch off → 403; per-IP cap (4th grant from one IP/day) → 429 `trial_ip_capped`; drive the global `trial_budget` to the cap (or temporarily lower `GLOBAL_DAILY_TRIAL_SPEND_CAP`) → chat returns 429 `trial_budget_exhausted`.

**3. On green smoke → merge + ship.**
- Merge `wave-39-trial-gating` → master + push (**auto-deploys the marketing site** via Cloudflare Pages — this is the deploy).
- Set **prod** env vars on Cloudflare Pages: `IP_HASH_SECRET` (a real secret) + `TRIAL_AI_ENABLED` — **keep `false` until the launch go-live**; flipping it `true` is what activates trial AI for real users.
- Run the standard wave wrap: collapse this file to the ~5-line stub, **promote the 2 `durable: candidate` decisions** (trial-identity, spend-cap-as-ceiling) to `roadmap/decisions/`, and let the wrap-team `haiku-followup-auditor` file the Turnstile follow-up from the `## Follow-up candidates` entry below (it's the sanctioned writer to `roadmap/follow-ups/`; direct writes are gate-blocked). Update HANDOFF.
- Bump version (minor — feature wave: v0.9.0) across the four files per CLAUDE.md before tagging.

## Result

<!-- Filled at ship by the merge master's wrap, AFTER the Phase 4 smoke passes. -->
<!-- Implementation (Phases 1-3) complete + verified 2026-06-14; smoke + merge pending. -->
<!-- Telemetry summary to be captured at final wrap. -->
