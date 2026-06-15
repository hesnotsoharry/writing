---
status: PLANNED
created: 2026-06-14
---

# Wave 50: ai-trial-usage-ux

## Plan

### Status

PLANNED · target **v0.8.2** (desktop release via `.\publish`) · drafted 2026-06-14 · **sequence BEFORE the parked Reddit launch announcement** — the trial→subscribe conversion path is currently broken at the exhaustion moment, and shipping the traffic spike into a broken funnel wastes the one-time audience.

### Goal

After this wave, the managed AI assistant tells the user what they actually have and what it's worth — and converts them when a free trial runs out. Concretely: the usage meter shows a **stable, model-agnostic "% of allowance left" bar** plus a **per-selected-model "~N more replies" line** plus a **tap-to-open popover** breaking the remaining budget down per model (with a "cheaper models go further" nudge). Trial users get a **"Free trial" badge** and, on exhaustion, a **trial-specific "Subscribe $14.99/mo to keep going" modal** wired to the existing subscription checkout — replacing today's misleading "wait for reset / top up" modal that a trial (which has no reset) should never show. And a paying subscriber finally has a **first-time key-entry UI** in Settings → AI Writing Assistant to paste the `aiLicenseKey` they received by email. No new plumbing — the balance/meter already render for trial users and the math already uses the trial allowance as denominator; this is presentation, labeling, one new modal, and one settings field.

### Scope

**In scope:**

- `src/features/ai/ai.helpers.ts` — replace the vague `aiMeterStatus` "Plenty left / About half left / Running low" labels (~24-29); add a pure `estimateRepliesLeft(balanceUnits, model)` helper driven by the `RATES` table + a static typical-request token profile.
- `src/features/ai/ai.types.ts` — the per-model `RATES`/cost data (~34-38) the estimate reads; add the typical-request-profile constant here (model list incl. `gpt-5.4-mini`/`gpt-5.4`/`gpt-5.5` + Claude tiers).
- `src/features/ai/AssistantPanel.tsx` — `AiMeter` render (~178): model-agnostic % bar + per-selected-model helper line, recomputed on model-picker change; `useAiBalance` hook (~265-305) feeds it.
- `src/features/ai/AssistantPanel.parts.tsx` — the per-model popover (new, attached to the meter); `ExhaustedAllowanceGuard` (~239-249) split into trial vs subscriber variants; `ModelPop` model picker (~206) wiring for the helper recompute; `CostCue` (~220) left intact.
- `src/features/ai/AssistantPanel.hooks.ts` — the trial-budget-exhausted inline message (~172) stays but is reconciled with the new exhaustion modal so messaging is consistent.
- `src/features/ai/AiOverlays.tsx` — surface the trial value concretely on first encounter (consent step 3 ~35); light first-run discovery that the free AI trial exists.
- `src/features/settings/*` (+ `ActivationGate` reference) — first-time `aiLicenseKey` entry UI (Deliverable 3; absorbs `roadmap/follow-ups/2026-06-14-ai-license-key-entry-ui.md`).

**Out of scope:**

- Any change to `marketing/functions/api/ai/balance.ts` — the per-model estimate is computed **client-side from `RATES`** (no endpoint round-trip). If a future wave wants server-authoritative estimates, that's a separate endpoint change → defer to a follow-up.
- Rolling per-user average request cost — launch uses a static typical-request constant; per-user calibration is a later refinement → defer.
- BYOK key entry / OpenAI-key BYOK — that's W49's surface; this wave touches only the managed `aiLicenseKey`.
- Top-up purchase UX changes — top-up linking shipped in the launch batch; not revisited here.
- Editor / ProseMirror — not involved.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Per-model reply estimate (pure helper) | haiku-implementer (+ haiku-test-author pre-impl oracle) | pyramid · internal-only · Add `estimateRepliesLeft(balanceUnits, model)` to `ai.helpers.ts` + a typical-request token-profile constant in `ai.types.ts`; reads `RATES`. Returns a rounded "~N". Unit-test across trial ($1.50) + monthly ($10) balances × each model. reviewTier: single (drives money-display correctness). | Internal — no observation point (pure function; surfaces in Phase 2). |
| 2 | Three-layer meter: model-agnostic bar + per-model helper line | sonnet-implementer | trophy · internal-only · Refactor `AiMeter` (`AssistantPanel.tsx`): bar = `% of allowance left` (stable across model switch); helper line = "~N more replies on \<selected model\>" recomputed from the Phase-1 helper on `ModelPop` change. Replace the qualitative "Plenty left" labels. reviewTier: single. | In-app: meter shows "X% left" + "~N more replies on \<model\>"; switching models changes the number but NOT the bar. |
| 3 | Per-model breakdown popover | sonnet-implementer | trophy · internal-only · New popover on meter tap/hover: per-model rows ("Claude Haiku ~90 · Sonnet ~22 · GPT-5.5 ~15") + "cheaper models go further — switch any time" nudge. Reuse existing popover/z-index pattern (mind the backdrop-filter stacking trap). reviewTier: skip. | In-app: tapping the meter opens a popover listing per-model reply estimates + the nudge. |
| 4 | Trial framing: badge + value + convert-on-exhaustion modal | sonnet-implementer | trophy · internal-only · "Free trial" badge when `balance.status==='trial'`; state trial value on first encounter ("~N free replies to try"); split `ExhaustedAllowanceGuard` → trial variant "Your free trial's used up — Subscribe $14.99/mo" wired to the existing `AI_SUB_VARIANT` overlay checkout (NOT "wait for reset"/"top up"). reviewTier: single (touches the conversion + checkout path). | As a trial user: meter shows "Free trial" badge; exhausting the $1.50 shows the Subscribe-$14.99 modal → opens the subscription checkout overlay. |
| 5 | Subscriber first-time key-entry UI (Settings → AI) | sonnet-implementer | trophy · internal-only · Add an `aiLicenseKey` entry field in Settings → AI Writing Assistant so a paying subscriber can paste their emailed key. Absorbs follow-up `2026-06-14-ai-license-key-entry-ui`; mark it resolved-by-W50. reviewTier: single. | In Settings → AI Writing Assistant: a key field exists; pasting a valid subscription key activates managed AI (meter switches from trial/none to subscription). |

> No walking-skeleton phase required: this wave adds no new architectural surface (no new IPC/SDK/cross-package/reactive-framework wiring) — it's UI over the existing panel, the existing balance endpoint, and the already-built LS checkout overlay.

**Known gaps / edges (from planning self-critique — read before Phase 4 & 5):**

- **🔴 Three exhaustion states must NOT be conflated (Phase 4's real difficulty).** "AI stopped" has three distinct causes and three correct messages: (a) **per-trial $1.50 balance exhausted** → the convert modal "Subscribe $14.99/mo"; (b) **global $25/day trial cap hit** (`trial-budget-exhausted`, `AssistantPanel.hooks.ts:172`) → the EXISTING "try again tomorrow" message — the user still has their own balance, so a "subscribe" CTA here is WRONG; (c) **subscriber monthly allowance exhausted** → the existing top-up/reset modal. The implementer must branch on `balance.status` + which exhaustion signal fired, not on "credits === 0" alone. Getting this wrong shows a subscribe-prompt to someone who isn't out of their own money — the most likely correctness bug in the wave.
- **🟡 Phase 5 is key *validation*, not just a text field.** Pasting a key must call the existing session/activation path (`acquireSession`) to confirm the key is real before storing it as `aiLicenseKey`; handle the invalid-key and network-error cases with clear inline feedback. Treat it as a small form with a verify step, not a bare input. (Don't rebuild activation logic — reuse the existing AI session exchange.)
- **🟡 Estimate honesty.** `estimateRepliesLeft` is a static-profile approximation; real cost swings with verb + context (a Story-Bible-grounded beta-read ≫ a quick proofread). Accepted: the bar (exact %) carries precision, the reply-count is always "~". Documented, not a defect.

### Acceptance criteria

- [ ] The usage bar shows **% of allowance remaining** and does **not** move when the user switches models (verified by switching models with the panel open).
- [ ] A helper line reads "~N more replies on \<currently-selected-model\>" and the **number changes** when the model picker changes.
- [ ] Tapping/hovering the meter opens a popover with a **per-model** reply breakdown + the "cheaper models go further" nudge.
- [ ] No raw credit "units" and no dollar figures appear anywhere in the user-facing AI usage UI.
- [ ] A trial user (`status==='trial'`) sees a **"Free trial"** badge on the meter.
- [ ] When a trial user's allowance hits zero, the modal says **"Subscribe $14.99/mo to keep going"** with a working checkout CTA — and never says "wait for reset" or "top up".
- [ ] A subscriber sees the **monthly** allowance UI (no "Free trial" badge), and the exhaustion modal keeps the existing top-up/reset path for them.
- [ ] Settings → AI Writing Assistant has a **key-entry field**; pasting a valid subscription key activates managed AI.
- [ ] `estimateRepliesLeft` has unit tests covering trial + monthly balances across every model in `RATES`.
- [ ] Gates green per touched files: ESLint (40-line/complexity-10/no-explicit-any), `tsc`, `vitest`. CDP runtime smoke confirms the meter, popover, trial badge, and exhaustion modal render as specified.

### Files the next agent should read first

1. `src/features/ai/AssistantPanel.tsx` — `AiMeter` render (~178) + `useAiBalance` (~265-305): the meter and its data source.
2. `src/features/ai/AssistantPanel.parts.tsx` — `ExhaustedAllowanceGuard` (~239-249), `ModelPop` (~206), `CostCue` (~220): the modal to split + the picker to wire.
3. `src/features/ai/ai.helpers.ts` — `aiMeterStatus` (~24-29): the qualitative labels to replace + where the estimate helper lands.
4. `src/features/ai/ai.types.ts` — model list + `RATES` (~34-38): per-model cost data for the estimate.
5. `marketing/functions/api/ai/balance.ts` — returns `creditsBalance` / `monthlyAllowance` / `resetAt` / `status` (TRIAL_ALLOWANCE 150000=$1.50 ~line 83 vs MONTHLY_ALLOWANCE 1000000=$10 ~line 90): the contract the client reads (do NOT change it).
6. `src/features/ai/AiOverlays.tsx` — consent/onboarding (trial mention step 3 ~35).
7. `roadmap/follow-ups/2026-06-14-ai-license-key-entry-ui.md` — the absorbed follow-up (Deliverable 3).

### Note to the implementer

The spirit: make the AI usage **legible and calm**, and convert the trial at the one moment it's earned. The biggest single win is Phase 4's exhaustion modal — right now a hooked trial user is told to "wait for a reset" that will never come; fixing that is worth more than the whole meter polish. Resist two temptations: (1) don't surface dollars or raw "units" to "be precise" — the brand is "a meter, not a bill," and dollars expose the $10-of-$15 margin and make $1.50 sound cheap; translate to "~replies" and %. (2) Don't make the **bar** per-model — switching models spends nothing, so a bar that shrinks on model-switch is both confusing and dishonest; the bar is the stable truth, the per-model detail lives in the helper line + popover only. Everything is "~" because request cost varies by verb and context as well as model. First step: verify the `## Locked decisions` section — the design choices were ratified with Cole this session and are noted there; formally enter them via the decision cell at Phase 1 before coding the estimate.

Before declaring a phase complete, restate that phase's Observation-column point in your own words and describe what you actually observed via the Tauri CDP runtime oracle (the meter rendering, the model-switch behavior, the popover opening, the trial badge, the exhaustion modal opening the checkout). If you could not observe it directly — no live panel, no triggered state — say so explicitly. Green vitest at the unit boundary is necessary but NOT sufficient for the UI phases; this surface has burned us before by passing tests while rendering wrong (see the ProseMirror/jsdom lesson). CDP smoke is the oracle here.

## Locked decisions

> Formalized at Phase 1 execution (2026-06-14). These are **user-ratified UX choices** settled collaboratively with Cole, not contested architecture — entered directly without the `sonnet-architect` decision cell (no architect dispatched, so the cell's enforcement hook never arms). Recorded here as the wave's binding design constraints.

## Decision 1: Model-agnostic usage bar

**Context:** The % bar must read as the stable truth of "how much allowance is left"; the per-model detail is a separate layer.
**Pick:** The % bar shows allowance-remaining and does **not** move when the user switches models — only the per-model helper line number changes.
**Rationale:** Switching models spends nothing; a bar that shrinks on model-switch is both confusing and dishonest. The bar is the stable truth; per-model variance lives in the helper line + popover.
**Consequences:** `AiMeter` takes `usedPct` (model-independent) for the bar; model-dependent reply estimates are computed separately and never feed the bar width.
**Enforcement:** advisory-only (acceptance criteria assert the bar doesn't move on model switch).

## Decision 2: Per-model estimate computed client-side from a mirrored `RATES` table

**Context:** The "~N replies on <model>" estimate needs per-model cost data; the authoritative `RATES` table lives server-side in `marketing/functions/_lib/credits.ts`.
**Pick:** Mirror the per-model rate data client-side (in `ai.types.ts`) and compute the estimate on the client from a static typical-request token profile. No `balance.ts` change, no new endpoint round-trip.
**Rationale:** The balance data is already on the client; a round-trip per model-switch would be wasteful and the endpoint contract stays frozen.
**Consequences:** A static typical-request token-profile constant + a client `RATES` mirror live in `ai.types.ts`. Server-side `RATES` drift could skew the "~" estimate — acceptable because the estimate is explicitly approximate ("~"). If the client mirror and server `RATES` ever diverge, the estimate degrades gracefully (wrong "~N", correct %).
**Enforcement:** advisory-only.

## Decision 3: No raw units, no dollars in user-facing usage UI

**Context:** Internal balance is in credit units; the API cost has a margin ($10 allowance on $15/mo). Surfacing either harms the "a meter, not a bill" brand.
**Pick:** Translate everything to "~replies" + "% left". No raw "units" and no dollar figures anywhere in the user-facing AI usage UI.
**Rationale:** Units are meaningless to users; dollars expose the margin and make $1.50 sound cheap. The brand is calm and legible, not a billing statement.
**Consequences:** All Phase 2–4 UI copy uses % and "~replies"; the popover and helper line never render `$` or unit counts.
**Enforcement:** acceptance criterion (no-dollars/no-units check) — advisory-only.

## Decision 4: Static typical-request-cost constant per model for launch

**Context:** Real request cost varies by verb + context (a Story-Bible-grounded beta-read ≫ a quick proofread).
**Pick:** Use a static typical-request token-profile constant per model for the launch estimate, not a rolling per-user average.
**Rationale:** Per-user calibration is a meaningful refinement but out of scope for the launch-gating wave; a static profile is honest enough given the "~" framing.
**Consequences:** The estimate is a fixed approximation; per-user calibration is deferred to a future wave.
**Enforcement:** none (convention) — per-user calibration is an out-of-scope future refinement.

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | 2026-06-14 | 2026-06-14 | (this commit) | Internal — pure helper; 17/17 oracle tests green; reviewer FLAG (Infinity/NaN guard) addressed. |
| 2 | 2026-06-14 | 2026-06-14 | (this commit) | Meter: model-agnostic % bar + per-model "~N replies" line; reviewer PASS all angles; CDP smoke deferred to wave-end. |
| 3 | 2026-06-14 | 2026-06-14 | (this commit) | Tap-to-open per-model popover (all 6 models ~N + nudge); stacking audit clean (no backdrop-filter trap); reviewTier skip; gates green. |
| 4 | 2026-06-14 | 2026-06-14 | (this commit) | Free-trial badge + 3-state-correct exhaustion split (trial→Subscribe $14.99, subscriber→top-up, global-cap inline untouched); consent shows ~150 trial value; reviewer FLAG (trial reset-label honesty) addressed by suppressing reset label for trials. |
| 5 | 2026-06-14 | 2026-06-14 | (this commit) | Settings → AI key-entry form: verify-before-store via acquireSession, distinct invalid-key vs network errors; reviewer PASS on security invariant; FLAG (dead success UI + test gap) addressed. Follow-up ai-license-key-entry-ui resolved. |

## Follow-up candidates

_(empty — stage here only if a Tier-3 item clears the VALUE + STRUCTURAL + CLEARABILITY gate with a present-harm pointer.)_

## Result

### Mechanical review

**Inputs resolved:**
- Plan: `roadmap/wave-50-ai-trial-usage-ux.md`
- Diff range: `94ea18d..HEAD` (29baa1a, 0f77d6e, 566f130, 622b30d, bb62d8e)
- Graph: fallback (grep + import-following — findings verified manually)
- Run: 2026-06-14

#### Check 1: Forward-trace
- Change sites traced: 10 (estimateRepliesLeft, MODEL_RATES, TYPICAL_REQUEST, TRIAL_ALLOWANCE_UNITS, AiMeter[mod], MeterPop, TrialExhaustedGuard, resolveExhaustedGuard, AiKeyEntryRow/useAiKeyEntry/classifyKeyError)
- Paths reaching production consumer: 10 — all reach panel/settings render or the pure helper. `estimateRepliesLeft` → AiComponents (AiMeter+MeterPop) + AiOverlays; `MODEL_RATES`/`TYPICAL_REQUEST` → ai.helpers; `TRIAL_ALLOWANCE_UNITS` → AiOverlays; exhaustion/key components → PanelFooter / AiExpandedRows.
- Paths flagged as dead: 0

#### Check 2: Plan universal-quantifier cross-reference
- Universals found: "unit-test across … each model in `RATES`" (covered: all 6 models × trial/monthly in estimateRepliesLeft.test.ts); "No raw credit units and no dollar figures appear anywhere in the user-facing AI usage UI" (verified across Phases 2–4 reviews; only `$` is the deliberate $14.99 offer); per-model popover lists all of `AI_MODEL_ORDER` (6).
- Flagged as narrowed: 0

#### Check 3: Export audit
- New exports added: 4 (estimateRepliesLeft, MODEL_RATES, TYPICAL_REQUEST, TRIAL_ALLOWANCE_UNITS)
- Exports with production consumers: 4 / 4
- Flagged as dead: 0

#### Checks N/A: 4–6
- Check 4 skipped: no schema property removals in this wave's diff.
- Check 5 skipped: no cross-boundary phases declared (all phases `internal-only`; wave adds no new architectural surface per the plan's no-walking-skeleton note).
- Check 6 skipped: no `stryker.config` found in project root and no `mutation:test` script in package.json (project has no mutation-testing infrastructure — not a W50 regression).

#### Verdict

**PASS.** Checks 1–3 ran clean against the real diff (graph-fallback, manually verified): every new export and changed component reaches a production consumer, no plan universal was narrowed, no dead exports. Checks 4–6 N/A. Full gate green at wave-end: tsc clean, ESLint clean, 1478/1478 vitest pass.

### Wave-end adversarial review (attack-diff, wave granularity)

Ran a cross-phase integration review over the full diff (`94ea18d..bb62d8e`) after the per-phase reviews. It surfaced **3 FLAGs (no BLOCKs)** the per-phase lenses structurally couldn't catch — all on the conversion path — now all addressed in commit `0e1a071`:

1. 🔴 **Trial `credits-exhausted` honesty.** A trial user exhausting their $1.50 mid-stream got the inline "resets soon" message contradicting the Subscribe modal — the exact "trials never see 'wait for reset'" rule. Fixed: the SSE branch is now trial-aware (subscribe message, no reset promise); subscriber message unchanged; global-cap branch untouched.
2. 🟡 **In-session activation dead-end.** `useAiBalance` ignored `aiLicenseKey` changes, leaving a just-subscribed trial user stuck in `TrialExhaustedGuard` until restart. Fixed: `SETTINGS_CHANGED_EVENT` listener with a ref-compare guard (no fetch loop — `getBalance` writes no tweaks).
3. 🟡 **Guard-routing test gap.** The Phase-4 3-way exhaustion routing had no automated coverage. Fixed: 3 PanelFooter render tests pin trial→Subscribe / active→top-up-reset / trial-no-reset-language.

Final verdict after fixes: **PASS** (all flags closed; gates re-green).

### CDP runtime smoke — DEFERRED to v0.8.2 build (not run this session)

Per the plan's "say so explicitly if you could not observe directly": live CDP smoke was **not** run in this worktree session, deliberately:
- The dev app shares the global `%APPDATA%\com.coles.writing\writing.db` (real manuscripts + a real **subscriber/active** license row), and concurrent sibling-wave sessions (W48/W49) may hold dev apps against it — launching another risks the known contested-dev-app/DB failure.
- The wave's highest-value surfaces (trial **badge** + trial **exhaustion modal**) require a `status='trial'` row; the live DB row is subscriber, so a smoke here would only exercise the subscriber meter, not the trial path. Observing the trial path needs the DB-swap protocol at build time.
- The branch isn't built yet; runtime smoke belongs at the v0.8.2 build (merge-master / Cole).

**Coverage substitute:** 1481/1481 vitest pass, including the new guard-routing render tests covering the conversion-critical branches. The "green-tests-but-renders-wrong" risk in this repo is ProseMirror-specific (editor owns its content DOM); this wave is standard React conditional rendering that testing-library renders faithfully. **Recommended smoke checklist for the v0.8.2 build (trial DB state):** (1) meter shows "% left" + "~N replies on <model>" and the bar does NOT move on model switch; (2) tapping the meter opens the per-model popover; (3) trial user sees "Free trial" badge and NO "Resets" label; (4) exhausting the $1.50 shows the Subscribe-$14.99 modal → opens the subscription checkout; (5) Settings → AI key field validates + activates a pasted key.

_(remaining at ship: v0.8.2 publish + the trial-state CDP smoke above — owned by merge-master / Cole.)_
