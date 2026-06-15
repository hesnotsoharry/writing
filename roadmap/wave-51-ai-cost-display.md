---
status: PLANNED
created: 2026-06-15
---

# Wave 51: ai-cost-display

## Plan

### Status

PLANNED · target v0.9.1 (patch) · drafted 2026-06-15 · isolated worktree `wave-51-ai-cost-display` (W46 concurrent on master)

### Goal

After this wave, the AI assistant's model picker shows precise model names ("Haiku 4.5" / "Sonnet 4.6"), the Settings key/endpoint inputs read as intentional input wells instead of bare boxes, and the "what the assistant can see" context modal scrolls internally with a pinned footer instead of stretching off-screen. More substantively: the AI **never silently substitutes a model the user did not choose** — both the managed-proxy and the BYOK silent-swap paths surface an explicit error instead. And the cost surface is restructured onto the correct foundation per current best practice: the **server's already-computed true charge** is surfaced to the client and shown as the post-reply truth; the "assists remaining" figure becomes a **rolling average of observed real spend** (not a static token guess); and the pre-send context-modal estimate becomes an **honestly-labelled, model-aware "≈ up to X%"** figure instead of the current disconnected `words/4000` number.

### Scope

**In scope:**

- **P0 cosmetic:** `src/features/ai/ai.types.ts` (AI_MODELS labels), `src/features/ai/providerRegistry.ts` (displayName), `src/features/ai/AssistantPanel.test.tsx` + `src/features/ai/trialWiring.test.tsx` (label assertions); `src/styles/app.css` (`.set-input` fill, `.sheet` max-height); `src/features/ai/AiOverlays.tsx` (footer relocation).
- **P1 no-silent-substitution:** `marketing/functions/_lib/providers/index.ts` (`getAdapter` throw), `marketing/functions/api/ai/chat.ts` (surface 400/422), `src/features/ai/AssistantPanel.tsx` (`computeEffectiveByokModel` stop-swap); tests for both.
- **P2 server truth:** `marketing/functions/_lib/credits.ts` (already computes `actualCredits`) + the chat response/stream payload — add a `chargedUnits` field to the done event.
- **P3 client cost restructure:** `src/features/ai/ai.helpers.ts` (`estimateRepliesLeft`, `aiEstimate`), `src/features/ai/AiComponents.tsx` (AiMeter), `src/features/ai/AiOverlays.tsx` (pre-send estimate label + threading model/allowance), `src/features/ai/AssistantPanel.tsx` / `AssistantPanel.hooks.ts` (rolling-average store + thread props), new small rolling-window helper.

**Out of scope (Tier 3 — separate future wave, do NOT build here):**

- Model-switch warning + re-injection cost dialog → deferred to the Tier-3 "AI context management" design wave.
- LLM-based conversation summarizer → deferred; central design decision (summarizer model choice) explicitly left open by Cole for that wave's architecture pass.
- Per-model context-window constants + running-usage gauge → deferred to the same Tier-3 wave (no context-window data exists in the codebase today).
- count-tokens API integration → not needed for the honest pre-send estimate (local heuristic is the right tool); revisit only if Tier-3 needs exact pre-send input counts for Claude.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 0 | Cosmetic tweaks: model labels, settings input fill, context-modal overflow + sticky footer | `sonnet-implementer` | trophy · internal-only (UI/CSS, no logic) · Rename labels in ai.types.ts + providerRegistry.ts (NOT wire IDs) + 2 test files; add `.set-input { background: var(--parchment-deep) }`; `.sheet` max-height `86%`→`86vh`; move `AiPickerFoot` out of `.sheet-body` to a sibling (sticky). reviewTier: skip | In the running app: model picker lists "Haiku 4.5" / "Sonnet 4.6"; the four Settings AI inputs show recessed wells; the context modal scrolls internally with the Done button pinned. (CDP self-smoke) |
| 1 | No silent model substitution — both sites surface explicit errors | `sonnet-implementer` | trophy · cross-boundary (managed proxy + client routing) · Server: `getAdapter` throws on unknown model; `chat.ts` returns 400/422 `{error:"Unknown model: <id>"}`. Client: `computeEffectiveByokModel` returns the model unchanged; `routeByokSend`'s existing explicit error surfaces. Keep marketing diffs inside `marketing/` (no lint gate there). reviewTier: single | Forcing an unrecognised model id surfaces an explicit error in the chat thread / a non-200 from the proxy — never a silently-swapped reply. (test + targeted manual) |
| 2 | Server adds settled balance to the done event (true charge already shipped) | `sonnet-implementer` | pyramid · cross-boundary (proxy response contract) · **DISCOVERY (2026-06-15):** the `done` event already emits `creditsCost = min(reserve, actual)` = the true charge incl. cache, balance settles on actual (chat.ts:280-293), and the client already consumes it (`ai.client.ts:23` / `AssistantPanel.hooks.ts:174,191). **NO RENAME** to `chargedUnits` — that breaks a consumed, tested contract for zero gain. Instead additively emit `balanceAfter`: the Supabase `refund_credits`/`refund_trial_credits` RPCs already RETURN the new balance but the TS wrappers discard it — capture it (zero extra I/O) and add to the done event. test + tsc gates only. reviewTier: single | The `done` event carries `balanceAfter` (authoritative settled balance) alongside the existing `creditsCost`. (network inspection + a marketing test asserting both fields) |
| 3 | Client cost restructure: rolling-average assists, honest pre-send estimate, post-send truth | `sonnet-implementer` | trophy · cross-boundary (consumes P2) · Assists-remaining → rolling avg of the per-reply `creditsCost` already persisted in each AiMessageRecord (cleaner than balance deltas — no race with concurrent spend); assists-remaining = live balance ÷ avg per-reply cost (localStorage window ~5–10, per-model cold-start fallback). Context-modal meter → model-aware `(ctxTokens×rate.in + 800×rate.out)/monthlyAllowance`, labelled "≈ up to X%" (worst-case/no-cache); thread selected model + live `monthlyAllowance` into `AiOverlays`. Post-send: show the existing `creditsCost` as true cost; live balance from P2's `balanceAfter`. reviewTier: single | In the running app: after a reply the panel shows the real cost; assists-remaining tracks actual burn; the context modal shows "≈ up to X%" (model-aware, moves with context size). (CDP self-smoke) |

### Acceptance criteria

- [ ] Model picker displays "Haiku 4.5" and "Sonnet 4.6"; wire model IDs unchanged (`claude-haiku-4-5-20251001`, `claude-sonnet-4-6`); label-string tests updated and green.
- [ ] The four Settings AI inputs (Anthropic key, License key, OpenAI key, custom endpoint name/URL) render with the recessed `--parchment-deep` fill; focus ring unchanged.
- [ ] Context modal: long content scrolls inside the body (no modal stretch); Done button + usage meter remain visible (pinned) regardless of scroll.
- [ ] Selecting/forcing a model not recognised by the managed proxy returns an explicit error (no AnthropicAdapter fallback); a BYOK model not in the user's keyed providers surfaces the existing explicit error (no silent swap to `km[0]`).
- [ ] The existing `creditsCost` on the `done` event is confirmed to equal the server's settled actual charge (`min(reserve, actual)`); the `done` event additionally carries `balanceAfter` (settled post-charge balance, captured from the refund RPC's existing return — zero extra reads). `creditsCost` is NOT renamed.
- [ ] Assists-remaining is computed from a rolling average of the observed per-reply `creditsCost` the client already persists (verified by a unit test feeding synthetic costs), with a per-model cold-start fallback when the window is empty; assists-remaining = live balance ÷ avg per-reply cost.
- [ ] Context-modal pre-send figure is model-aware (differs between Haiku and Sonnet for the same context), divides by the live `monthlyAllowance`, and is labelled as an estimate ("≈ up to X%"). The old `words/4000` path is removed.
- [ ] After a reply, the panel shows the server-reported true cost (from `chargedUnits`).
- [ ] `npm run lint` + `tsc` + touched-file `vitest` green in the app; `marketing/` test + tsc green for P1/P2.

### Files the next agent should read first

1. `src/features/ai/ai.helpers.ts` — `aiEstimate` (words/4000) + `estimateRepliesLeft` (static TYPICAL_REQUEST); both restructured in P3.
2. `src/features/ai/ai.types.ts` — AI_MODELS labels (P0), MODEL_RATES + TRIAL_ALLOWANCE_UNITS + TYPICAL_REQUEST (P3 context).
3. `src/features/ai/AiOverlays.tsx` — context picker modal + `AiPickerFoot` (P0 footer move, P3 estimate label + prop threading).
4. `src/features/ai/AssistantPanel.tsx` / `AssistantPanel.hooks.ts` — `computeEffectiveByokModel` (P1), `useAiBalance`/`getBalance` balance fetch (P3 rolling-average source), prop threading to AiOverlays.
5. `src/features/ai/providerRegistry.ts` — displayName labels (P0); `getModelEntry`/`BYOK_SEND` routing (P1 context).
6. `marketing/functions/_lib/providers/index.ts` + `marketing/functions/_lib/credits.ts` + `marketing/functions/api/ai/chat.ts` — server routing fallback (P1) + `actualCredits` (P2).
7. `src/styles/app.css` — `.set-input` (~2238), `.sheet` (~473) (P0).

### Note to the implementer

The spirit of this wave: stop the AI from ever lying or guessing about the user's money or their model choice. Two temptations to resist. (1) **Do not "improve" the pre-send estimate into something that looks precise** — caching makes pre-send cost genuinely unknowable, so the honest move is the "≈ up to X%" worst-case label, not a fake-exact number. (2) **Do not re-derive cost client-side from tokens** as the source of truth — the server already computes the real charge; surface it (P2) and display it. The client's rolling average is a *forecast* for "assists remaining," not the truth.

Keep marketing/ diffs inside `marketing/` (its gates are test + tsc only — do NOT touch the app's root `eslint.config.mjs`). Wire model IDs are load-bearing — only the display labels change in P0.

First step: verify the `## Locked decisions` section below has Decision 1 filled in.

Before declaring a phase complete, restate that phase's Observation point in your own words and describe what you actually observed. For P0 and P3 that means a real look at the running app (CDP smoke against the dev build) — "tests pass" is necessary but not sufficient for the UI-visible phases. For P1, observe the error path actually firing (forced unknown model), not just a green unit test. For P2, inspect the real response payload, not only the assertion.

## Locked decisions

## Decision 1: Cost-per-reply is observed-actual, not client-derived

**Context:** How the app computes/displays per-reply AI cost — pre-send estimate vs. post-send truth, and what powers "assists remaining."
**Pick:** Server-computed actual charge (`actualCredits` → surfaced as `chargedUnits`) is the post-send truth shown to the user; "assists remaining" is a rolling average of observed real balance deltas; any pre-send figure is an honestly-labelled estimate ("≈ up to X%", worst-case/no-cache).
**Rationale:** Anthropic only reports cache hit/miss *after* the response, so pre-send cost is structurally un-knowable; 2026 industry consensus (Datadog / LiteLLM / Langfuse) bases cost on the provider's reported usage object, never client-side re-derivation. Observed rolling-average auto-accounts for caching, model, and real output length with no tokenizer.
**Consequences:** The server already surfaces the true charge as `creditsCost` (kept — NO rename; the client already consumes + persists it); P2 additionally surfaces `balanceAfter`. The client's rolling-average forecast consumes the per-reply `creditsCost` it already persists; the static `TYPICAL_REQUEST` estimate and `words/4000` meter are retired; pre-send numbers are explicitly framed as estimates, never as charges. (Mechanism refined 2026-06-15 after discovering `creditsCost` already exists end-to-end; the "observed-actual not client-derived" principle is unchanged.)
**Enforcement:** advisory-only (no mechanical gate; validated by this session's research pass — Anthropic caching/count-tokens docs + 2026 consensus).
`durable: candidate`

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 0 | 2026-06-15 | 2026-06-15 | 3e95e25 (+e2955ec) | HIT (CDP self-smoke): labels "Haiku 4.5"/"Sonnet 4.6" render; context modal scrolls internally with pinned footer + 86vh cap; `.set-input` fill required a pre-existing CSS-comment fix (e2955ec) — now computes `background rgb(236,228,212)`, `padding 8px 11px` |
| 1 | 2026-06-15 | 2026-06-15 | 6c186bf | unit + reviewer-trace (managed error path is structurally unreachable — invariant test; BYOK error string verified by trace) |
| 2 | 2026-06-15 | 2026-06-15 | 76c7345 | network/test: `done` event carries `balanceAfter` (4 tests incl. trial+subscriber × refund/no-refund, 46/46 green) |
| 3 | 2026-06-15 | 2026-06-15 | 1a95d84 | PARTIAL (CDP self-smoke): "≈ up to X%" estimate label + assists-remaining + meter usedPct render correctly. **NOT smoked** — post-send true-cost display + assists-remaining live burn (require an actual managed AI reply, which spends real money on the shared production DB; deferred). Unit: 1598/1598 green; adversarial FLAG (cold-start meter blip) addressed via `applyBalance` guard |

## Follow-up candidates

_(empty — fix mid-wave friction inline per development-pipeline scope-creep tiers)_

## Result

_(filled at ship by wrap team)_
