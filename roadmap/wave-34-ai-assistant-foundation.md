---
status: SHIPPED
created: 2026-06-12
shipped: 2026-06-12
---

# Wave 34 — AI assistant foundation (SHIPPED — collapsed stub)

> Full plan, phase briefs, and acceptance criteria: see this file's pre-collapse history
> (`git log -- roadmap/wave-34-ai-assistant-foundation.md`, pre-collapse at commit 90f36c5).

## What shipped

WritersNook's first AI capability and first revenue-bearing backend, v0.6.0: Supabase credit
schema (`marketing/supabase/0002+0003`, applied in production), Cloudflare AI proxy
(`marketing/functions/api/ai/{session,chat}.ts` — HMAC session tokens, normalized SSE, no body
logging, CORS for the Tauri WebView), Lemon Squeezy subscription webhooks
(`lemon-squeezy-subscription.ts` — real license key fetched via `/v1/license-keys`, upsert
convergence on subscription id, reserve→refund-only credit metering, rate cap), and the desktop
Assistant panel (brainstorm verb, scene+entity context chips, streaming reply, credit meter,
dormant-by-default consent lifecycle, Settings kill-switch, zero-credit/expired/offline
guardrails, AiErrorBoundary isolation). "No built-in AI" retired from CLAUDE.md; ADR-0001
amended. Proven end-to-end in LS test mode: purchase → webhook → emailed key → consent →
metered streamed chat.

## Locked decisions

D1–D8 ran the decision-review cell 2026-06-12. Durables promoted at wrap:
- D1 → [decisions/ai-proxy-home-metering-storage.md](decisions/ai-proxy-home-metering-storage.md)
- D2 → [decisions/app-proxy-identity.md](decisions/app-proxy-identity.md) (LS-mint VERIFIED active path; self-mint dormant seam)
- D3 → [decisions/credit-ledger-decrement.md](decisions/credit-ledger-decrement.md)
- D4 → [decisions/streaming-protocol-prompt-assembly-location.md](decisions/streaming-protocol-prompt-assembly-location.md)
- D8 → [decisions/lapsed-subscription-behavior-for-the-eventual.md](decisions/lapsed-subscription-behavior-for-the-eventual.md)
- D5 (wave sequencing 34→35→36), D6 (migration-before-endpoint deploy order), D7 (subscription gates only the AI panel this wave) — wave-scoped, see history.

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | 2026-06-12 (run-phase wf_850770ae-4f5) | 2026-06-12 — gates green; reviewer FLAG ×3 adjudicated, all 4 findings fixed pre-commit (TOCTOU→atomic `decrement_credits` RPC, CREDIT_UNIT_USD mirror, pinned model ID, hooks violation) | 6dbcd3c + 71a816a (CORS fix — WebView preflight, found at live smoke) | YES 2026-06-12 — Cole typed a prompt into the dev panel and watched a streamed reply (after CORS fix deployed). Backend chain also verified via curl: session 200 → chat SSE → done {16 in / 8 out / 513 credits}. |
| 2 | 2026-06-12 (run-phase wf_69a127eb-0b2) | 2026-06-12 — gates green (128 tests); reviewer BLOCK adjudicated: RPC param mismatch (p_cost→p_amount, would have 429'd every chat), rate-cap off-by-one, email-key OOO bug — all fixed pre-commit + LS-mint path and env variant IDs wired | 7784b06 + 2c4a0ed (Lane B: live sandbox exposed key-fetch + invoice-id bugs — LS keys are order-scoped, fetched via /v1/license-keys; payment_success carries subscription_id in attributes) | YES 2026-06-12 (deferred observation via Phase 3 panel + LS sandbox E2E): Cole bought WritersNook Plus test-mode, webhooks landed (created fetched the LS-emailed key; payment_success granted 1M credits on the SAME row), emailed key validated in-app, metered chat streamed. |
| 3 | 2026-06-12 (run-phase wf_cd0a6cb4-1d1) | 2026-06-12 — gates green (32 new tests + slots contract); reviewer FLAG adjudicated: --danger token fixed inline; wrapper nesting + no-remount justified | 02d1f1a + 9343691 (Lane B fix: proxy dropped `system` — found at live smoke; diagnostician + attack-hypothesis cell; fix also counts system chars in reserve per review) | YES 2026-06-12 — Cole's brainstorm reply referenced the scene's actual prose and worldbuilding (Catonian ban, potluck, −30°C); system-field pass-through verified live (PINEAPPLE probe). |
| 4 | 2026-06-12 (run-phase wf_e85809ee-247) | 2026-06-12 — gates green (full suite 1285/1285); reviewer FLAG adjudicated: consent copy now discloses the prompt (D4), "Not now"→dormant, offline retry added, barrier test strengthened at client seam, style pass on consent/guardrail classes; discovery-file scope flag = false positive (orchestrator commit swept into diff window) | 1e2062b | YES 2026-06-12 — Cole smoked all four: dormant affordance, consent walkthrough (Accept→key→chat; Not now→dormant), brainstorm works, Settings toggle removes/restores all AI chrome. |
| post | wave-end adversarial panel (billing + privacy lenses) | 2026-06-12 — FLAG ×2 adjudicated: 6 findings fixed (top-up tombstone-before-grant, silent variant-ID swallow, HMAC degraded-key guard, dormant-first fresh profile, change-key row gating, AiErrorBoundary); 4 justified/parked (see HANDOFF polish list) | 90f36c5 (+ 0b40ef5 change-key affordance, found at subscriber-journey smoke) | Covered by phase observations + live E2E. |

## Follow-up candidates

- GDPR/DPA + privacy-policy formalization for the AI data path: REJECTED by wrap auditor
  (STRUCTURAL gate — legal/policy work, not a software deliverable). Carried as a Cole-owned
  action item in HANDOFF instead; present-harm: the "never trains on your manuscript" promise
  ships in consent copy while the DPA/data-residency posture is unreviewed (K3, 2026-06-12,
  attack-decision review agent a7b4f2e6fd21ba541, Angle 1).

## Result

Shipped 2026-06-12, all four phases + wave-end panel findings, deployed to production
(writersnook.app) across 25 commits (264c564..90f36c5 + wrap). Final gates: app 1294/1294,
marketing 139/139, lint + tsc clean. Wrap team: 5 decisions promoted, 4 vendor-gotcha entries
(anthropic system-field, LS license-key fetch + test→live flags, Cloudflare WebView2 CORS),
13 pre-existing follow-ups untouched, HANDOFF rewritten (orchestrator-expanded after the
rewriter's line-count escalation).

Three Lane B bugs found ONLY by live verification, none by mocked tests: WebView CORS preflight
(405), proxy dropping the `system` field (manuscript context never reached the model), LS
license keys being order-scoped (webhook stored self-minted keys that matched nothing).
Lesson reinforced: the runtime oracle is load-bearing; green vitest ≠ working.

### Mechanical review

**Inputs resolved:** Plan: roadmap/wave-34-ai-assistant-foundation.md · Diff range: 264c564..28c8a1b (17 commits) · Graph: healthy for src/, grep-fallback for marketing/ · Run: 2026-06-12

#### Check 1: Forward-trace
- Change sites traced: all wave symbols; production chains confirmed (panel → App.content slot; Pages Function entry points; 6 of 7 SQL functions called via .rpc()).
- FLAG (non-fatal): **`decrement_credits`** (0002_ai_subscriptions.sql:84) — zero .rpc() callers; Phase 1's mechanism, superseded by Phase 2's reserve/refund pair per D3. Justified: the plan documents the supersession; 0002 is applied in production so removal needs a future migration. Cleanup parked for wave 35 (DROP in next migration).

#### Check 2: Plan universal-quantifier cross-reference
- All four binding universals verified clean with evidence: (a) zero Anthropic wire-format in src/; (b) aiEnabled gate covers all AI chrome (AssistantPanel.tsx:151, App.content.tsx:219,280); (c) no network path pre-consent (AssistantPanel.tsx:26-30,88); (d) every credit-mutating SQL function floored + table CHECK (0002:26). Also: no body logging in api/ai/; no @anthropic-ai/sdk dependency.

#### Check 3: Export audit
- FLAG (non-fatal): **`CREDIT_UNIT_USD`** (marketing/functions/_lib/ai-token.ts:19) — zero importers. Justified in writing: D1 (review amendment) mandates the constant as the self-documenting unit mirror of the SQL schema comment; it exists to satisfy that locked decision. Polish candidate: wire chat.ts cost math to consume it (wave 35).
- src/ twin of CREDIT_UNIT_USD is consumed (AssistantPanel.brainstorm.tsx:14,208). All other new exports have production consumers.

#### Check 4 skipped: no schema property removals in this wave's diff.

#### Check 5: Boundary-phase orchestrator-owned acceptance test verification
- Trigger: fired — Phases 1 and 2 declared cross-boundary.
- **FAIL (structural, resolved by written justification below):** no orchestrator-authored acceptance files exist at roadmap/wave-34-ai-assistant-foundation-acceptance/; seam tests were implementer-authored. The authored-before-dispatch contract cannot be satisfied retroactively.
- **Justification (recorded as the resolution):** both cross-boundary phases received LIVE protocol-level verification beyond what the acceptance files would have asserted, recorded in the Status table: Phase 1 — live curl probes against production (session 200/token, chat SSE normalized stream, system-field PINEAPPLE probe) + Cole's in-app smoke; Phase 2 — full LS sandbox subscriber journey (real purchase → webhooks → fetched key → allowance → metered chat), which caught and fixed two real contract bugs the seam tests missed. The live oracle exceeded the paper one this wave.
- **Process lesson (binding for wave 35):** orchestrator authors failing acceptance tests for cross-boundary phases BEFORE dispatch, per ~/.claude/rules-deferred/orchestrator-owned-acceptance-tests.md — read at dispatch time, not review time.

#### Check 6 skipped: no stryker.config found in project root.

#### Verdict

**FLAG (all flags addressed: 2 justified non-fatal + Check-5 structural resolved by recorded justification + lesson).** Checks 1-3 otherwise clean; the wave's full suite is green (app 1285/1285 at review time, 1294/1294 after panel fixes; marketing 135→139/139) and both cross-boundary surfaces carry live production verification evidence. Wave-end adversarial panel (attack-diff ×2: billing-integrity + privacy/consent lenses) returned FLAG ×2, no BLOCK; all six actionable findings fixed in 90f36c5.
