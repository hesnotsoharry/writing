---
status: PLANNED
created: 2026-06-12
---

# Wave 34 — AI assistant foundation

## Plan

### Status

DRAFT · target v0.6.0 · drafted 2026-06-12.

### Goal

The AI assistant foundation ships end-to-end: WritersNook gains its first AI capability and its first revenue-bearing backend. After this wave, a subscriber with an active $14.99/mo AI subscription can open a dormant-by-default Assistant panel, accept a consent walkthrough, see a visible "What I can see" context strip (current scene + scene-linked worldbuilding entities), ask a **brainstorm** question, and watch a streamed, manuscript-grounded reply — metered against a prepaid credit balance that Lemon Squeezy webhooks maintain in Supabase and a Cloudflare Pages Function proxies to Anthropic. The "no built-in AI" stance in CLAUDE.md and ADR-0001 is formally retired. The other three verbs (critique / beta-read / proof), the scene+entity pickers, exclude-from-AI flags, the marketing-site changes, and the BYO-key tier are waves 35–36.

### Scope

**In scope:**

- Supabase schema: `subscriptions` + `credit_events` tables (SQL committed under `marketing/supabase/`, applied before endpoint code merges).
- Cloudflare Pages Functions AI proxy: `marketing/functions/api/ai/session.ts` (license key → HMAC session token) and `marketing/functions/api/ai/chat.ts` (normalized SSE stream → Anthropic), secrets via the existing `Env` pattern in `marketing/functions/_lib/supabase.ts`.
- Lemon Squeezy subscription webhook handler: new file `marketing/functions/api/webhooks/lemon-squeezy-subscription.ts` (subscription_created/updated/payment_success/expired + top-up `order_created` branch), reusing the existing HMAC verification and `webhook_events` idempotency ledger.
- Credit metering: max_tokens-bounded reserve → refund-only reconcile; monthly reset on renewal webhook; top-up grants; per-license rate cap.
- Desktop Assistant panel (`src/features/ai/`): tab in the right-panel slot, context strip (current scene + `loadSceneEntities` defaults shown as chips), brainstorm verb prompt template, streaming reply UI, credit meter, subscription-key entry.
- Opt-in lifecycle: dormant affordance, first-click consent walkthrough carrying the "never trains on your manuscript" promise, Settings toggle to hide all AI chrome, zero-credit / expired / offline states.
- Docs: retire the "no built-in AI" line in `CLAUDE.md`; amend `roadmap/decisions/0001-local-first-architecture.md` with the pivot.

**Out of scope:**

- Critique / beta-read / proof verbs, and the selected-text registration path the critique verb needs (→ wave 35).
- Scene/chapter picker, entity picker beyond the default chips, per-entity exclude-from-AI flags (→ wave 35).
- Whole-manuscript context + `count_tokens` pre-send cost-estimate UX (→ wave 35).
- Marketing-site pricing/AI pages and the app-pricing restructure (one-time → subscription lineup) (→ wave 35/36).
- BYO-API-key tier (→ wave 36).
- Multi-device / mobile concerns (→ Phase 2 of the product roadmap).
- GDPR/DPA formalization (→ follow-up candidate below; consent copy in this wave states the data flow honestly).

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Walking skeleton: app → proxy → Anthropic round trip | sonnet-implementer | Walking skeleton — thinnest end-to-end slice touching every layer: schema SQL (applied to Supabase FIRST — deploy-order constraint, D6) + `api/ai/session.ts` + `api/ai/chat.ts` (auth-gated from first commit, normalized SSE per D4) + dev-flagged minimal panel input wired to a seeded dev subscription row. One automated smoke (seam test) + live smoke run. honeycomb · cross-boundary. | In a dev build with a seeded dev subscription row, Cole types a prompt into the dev-flagged Assistant panel and watches a model reply stream into the panel. |
| 2 | Billing spine: LS subscription webhooks + credit metering | sonnet-implementer | New `lemon-squeezy-subscription.ts` handler (4 subscription events + top-up order branch; upsert-shaped so out-of-order delivery converges; `webhook_events` idempotency reuse). Reserve-then-reconcile per D3 (max_tokens-bounded, refund-only). Per-license rate cap. honeycomb seam tests · cross-boundary. Gated on Cole's LS sandbox verification (see Note). | Internal — no observation point (server-side billing spine; Phase 3's credit meter is where the user sees its effect). |
| 3 | Assistant panel + brainstorm verb | sonnet-implementer | Tabbed right-panel mount alongside SceneInspector (`App.content.tsx` inspectorSlot — contract test `appShell.slots.contract.test.tsx` must stay green). Context strip chips from `loadSceneEntities(sceneId)` + `extractPlainText(doc)`; brainstorm prompt template in `src/features/ai/prompts/`; streaming reply UI; credit meter. trophy · internal-only (consumes Phase 1 contract). | In the running app, Cole opens the Assistant tab in the right panel, sees context chips for the current scene and its linked entities, sends a brainstorm question, and watches a streamed reply that references his own worldbuilding by name; the credit meter visibly drops after the reply. |
| 4 | Opt-in lifecycle + guardrail states + docs retirement | sonnet-implementer | Dormant affordance; first-click consent walkthrough (data-flow copy + never-trains promise); Settings toggle hiding all AI chrome; subscription-key entry in panel (validates via `/api/ai/session`); zero-credit (429 body), expired, offline states; CLAUDE.md + ADR-0001 amendments. trophy · internal-only. | On a fresh profile, Cole sees a dormant Assistant affordance; first click renders the consent walkthrough; the Settings switch removes the affordance entirely; with a drained balance the panel shows "Credits used up — resets ⟨date⟩"; offline, the panel shows an offline notice while the editor keeps working. |

### Acceptance criteria

- [ ] `marketing/functions/api/ai/session.ts` exists; POST with an active subscription license key returns `{token, expiresAt}`; a non-active key returns 403 (seam test).
- [ ] `marketing/functions/api/ai/chat.ts` streams only the normalized event schema `{type:'token'|'done'|'error'}`; `done` carries `{inputTokens, outputTokens, creditsCost}` (seam test).
- [ ] `src/` has no dependency on `@anthropic-ai/sdk` and no Anthropic SSE parsing — the app speaks only the normalized schema (grep + package.json check).
- [ ] Proxy code contains no logging of request/message bodies (grep for `console.*` against message payload identifiers in `api/ai/` passes clean).
- [ ] `subscriptions` and `credit_events` tables exist per the schema in Locked decisions D1/D3; SQL file committed under `marketing/supabase/`.
- [ ] Reserve = input estimate + per-verb `max_tokens` × output rate; reconcile is refund-only; a seam test asserts `credits_balance` can never go negative.
- [ ] Webhook handler processes `subscription_created`, `subscription_updated`, `subscription_payment_success`, `subscription_expired`, and top-up `order_created` idempotently via `webhook_events`; a seam test delivers events out of order and the row converges.
- [ ] `subscription_expired` sets `status='expired'`; `/api/ai/session` refuses expired subscriptions; the balance row is preserved (frozen, not zeroed) for reactivation.
- [ ] Per-license rate cap enforced in the proxy (concurrent or per-minute, per D3); a seam test exercises the refusal.
- [ ] Zero-balance chat returns 429 with `{creditsRemaining: 0, resetAt}`; the panel renders the reset-date message.
- [ ] No network call to the proxy occurs before the consent walkthrough is accepted (test or recorded manual verification).
- [ ] The Settings AI toggle removes the Assistant affordance entirely; `appShell.slots.contract.test.tsx` still green.
- [ ] Offline: the panel shows an offline notice; editor, binder, and story bible remain fully functional.
- [ ] `CLAUDE.md` "No built-in AI" line replaced with the opt-in AI stance; `roadmap/decisions/0001-local-first-architecture.md` amended with a dated pivot note.
- [ ] Marketing gates green (`test` + `tsc` in `marketing/`); app gates green (lint, tsc, vitest) — full suite at wrap.
- [ ] Cole-owned (gates Phase 2 ship, not Phase 1 start): LS test-mode subscription product ($14.99/mo) + top-up product(s) created; license-key-on-subscription premise verified in the LS dashboard (D2 records which key-mint path applies).

### Files the next agent should read first

1. `roadmap/wave-34-ai-assistant-foundation-research.md` — verified current vendor specs (Anthropic pricing/streaming/caching/policy, Cloudflare Pages Functions, Lemon Squeezy subscriptions). Phase briefs are grounded here, not in training data.
2. `## Locked decisions` in this file — D1–D7 are binding; the review amendments (max_tokens-bounded reserve, pluggable key mint) are part of the decisions.
3. `marketing/functions/api/webhooks/lemon-squeezy.ts` — the existing webhook handler: HMAC verification, upsert shape, `webhook_events` 23505 idempotency. The new subscription handler mirrors these patterns in a NEW file; do not modify this one beyond shared-lib extraction if genuinely needed.
4. `marketing/functions/_lib/supabase.ts` — the `Env` interface (extension point for `ANTHROPIC_API_KEY`, `PROXY_SESSION_SECRET`) and Supabase client pattern.
5. `src/features/license/license.gate.ts` + `src/features/license/activate.ts` — the existing activation UX and gate states. The AI subscription does NOT touch this gate (D7); read it to understand what you must not break.
6. `src/db/storyBibleStore.ts` — `loadSceneEntities(sceneId)`, `getEntityFields`, `listRelations`: the context-assembly calls. Characters/locations live in separate tables from other entities — always go through the store interface.
7. `src/features/settings/settings.store.ts` — `Tweaks` + `SETTINGS_CHANGED_EVENT` pattern for the AI toggles.
8. `src/App.content.tsx` — `inspectorSlot` / `showSidePanels` logic; the panel mounts here.
9. `marketing/.claude/vendor-gotchas/` + `.claude/vendor-gotchas/tauri.md` — Lemon Squeezy, Cloudflare Pages, and Tauri traps.

### Note to the implementer

This wave builds WritersNook's first AI feature and first revenue-bearing backend — the spirit is "AI you control": every byte that leaves the machine traces to a visible chip and an explicit ask, and the proxy stays dumb (meter + relay, never store, never log bodies). Resist these temptations: do NOT restructure the app's license gate or pricing (the subscription gates only the AI panel this wave — D7); do NOT build the other three verbs or the pickers (wave 35); do NOT touch the existing `lemon-squeezy.ts` checkout handler beyond reading it; keep marketing diffs inside `marketing/` (its gates are test + tsc only — the root eslint config is the app's). Remember: pushing master deploys writersnook.app live — AI endpoints must be auth-gated from their first commit, and the Supabase schema must be applied before endpoint code lands on master. First step: verify the `## Locked decisions` section has decisions filled in.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

> Decisions are NOT appended here freely. Per the decision-review cell (`~/.claude/rules/best-practice-spectrum.md`, M-42 P2): a non-trivial decision must run `sonnet-architect` → `sonnet-adversarial-reviewer` (`Posture: attack-decision`) → orchestrator adjudication BEFORE it is written into `## Locked decisions`. The `adversarial_review_enforce.mjs` hook denies the wave-file edit if the cell has not fired; genuinely trivial decisions skip via the `review-tier-{session_id}.json` sidecar.

Decisions D1–D6 ran the full cell on 2026-06-12: `sonnet-architect` (agent ae1d2702d2cf252ef) → `sonnet-adversarial-reviewer`, `Posture: attack-decision` (agent a7b4f2e6fd21ba541, verdict FLAG ×5, no BLOCK) → orchestrator adjudication. Review amendments are folded in below.

### Decision 1: AI proxy home + metering storage — `durable: candidate`

**Context:** Where the managed-tier proxy and credit state live; product previously assumed "no backend," but a Pages Functions + Supabase backend already exists.
**Pick:** New endpoints under `marketing/functions/api/ai/` in the existing Pages Functions deploy; Supabase Postgres is the metering source of truth (`subscriptions` PK `license_key`, `credit_events` ledger). No KV/D1/Durable Objects.
**Rationale:** Pages Functions ARE Workers (research sidecar); SSE passthrough works; one deploy pipeline (push = deploy); Postgres atomic `UPDATE … RETURNING` is a sound decrement primitive; KV's eventual consistency is unsafe for metering. Separate `api/ai/` file tree isolates blast radius from checkout.
**Consequences:** Every AI request makes a Supabase round-trip; acceptable at launch scale. Credit unit (1 unit = $0.00001) documented in schema comments + a shared constant (review amendment: self-documenting unit).
**Enforcement:** Phase 1/2 seam tests in `marketing/functions/`; acceptance criteria above.

### Decision 2: App↔proxy identity — `durable: candidate`

**Context:** The desktop app must present a credential for the managed tier; writers hate logins.
**Pick:** Subscription license key (entered once in the panel, like wave-30 activation) exchanged at panel-mount via `POST /api/ai/session` for an HMAC-SHA256-signed session token (4h TTL, held in React state only, never SQLite). Key mint is **pluggable** (review amendment): if LS subscriptions carry license keys, LS mints; otherwise OUR `subscription_created` webhook mints the key and emails it via the existing Resend path. Same table, same PK, same exchange either way. **VERIFIED 2026-06-12 (Cole, LS dashboard): subscription products DO support "generate license key" — enabled on WritersNook Plus (test variant 1782093; top-up test variant 1782092 — TEST-MODE IDs, swap to live IDs at launch via the `LS_SUB_VARIANT_ID`/`LS_TOPUP_VARIANT_ID` env values). LS-mint is the active path; self-mint+Resend remains a dormant seam.**
**Consequences:** Token validates against Supabase only at issuance; revocation latency on cancellation is bounded by the 4h TTL (accepted: worst case a few hours of drain on an already-paid balance). No email login in the app.
**Enforcement:** Auth middleware in `api/ai/chat.ts`; 403 seam test; acceptance criterion.

### Decision 3: Credit ledger + decrement — `durable: candidate`

**Context:** Prepaid monthly allowance with top-ups, no overage billing, no surprise charges; output tokens are unknowable pre-send.
**Pick:** Launch allowance = 1,000,000 units ($10.00 API value) per month (tunable constant). Reserve-then-reconcile, **max_tokens-bounded** (review amendment): every request carries a per-verb `max_tokens`; reserve = input estimate (local chars/4 heuristic — no `count_tokens` round-trip on the hot path) + `max_tokens` × output rate; reconcile from Anthropic's actual `usage` is refund-only — balance cannot go negative. Monthly reset (`balance := allowance`) on `subscription_payment_success`; top-ups `+=` on pack `order_created`; `subscription_expired` freezes (session refusal, balance preserved). Webhook handler is upsert-shaped so out-of-order delivery converges; idempotency via the existing `webhook_events` ledger. Per-license rate cap in the proxy (review amendment: credit gating alone doesn't stop burst abuse). Token-accurate credits chosen over flat request caps (review challenge, justified): verb cost profiles differ >10×, and flat caps are either stingy or margin-losing; the UI hides the math (meter, not numbers).
**Consequences:** A chargeback after reset can leave granted credits — accepted at launch scale, revisit with volume.
**Enforcement:** Seam tests: non-negative invariant, out-of-order convergence, rate-cap refusal, 429 shape.

### Decision 4: Streaming protocol + prompt assembly location — `durable: candidate`

**Context:** Thin provider seam + the "never trains on your manuscript" privacy promise.
**Pick:** Proxy-normalized event schema (`{type:'token'|'done'|'error'}`) — the app never speaks Anthropic's wire format. Prompt assembly fully client-side (`src/features/ai/ai.context.ts` + per-verb templates in `src/features/ai/prompts/`); the proxy receives an assembled messages array, meters, relays, and never logs bodies. Honest framing (review amendment): manuscript text DOES transit the proxy — the consent walkthrough copy states the actual data flow (local → our relay → Anthropic; not stored, not logged, not trained on) rather than implying the proxy is blind.
**Consequences:** Provider swap touches proxy + prompt templates, not the React client. GDPR/DPA formalization is a follow-up (below).
**Enforcement:** Acceptance criteria: no `@anthropic-ai/sdk` in `src/`, no body logging in `api/ai/` (grep checks).

### Decision 5: Wave sequencing

**Context:** The pivot spans backend, billing, UI, and marketing; billing cannot ship half-done.
**Pick:** Wave 34 = billing infrastructure + brainstorm verb (this file). Wave 35 = critique/beta-read/proof verbs, selected-text API, pickers, exclude-flags, cost-estimate UX, marketing site. Wave 36 = BYO-key tier + pricing-lineup flip.
**Rationale:** Brainstorm exercises the full billing path with the least editor coupling and is the research-validated killer feature; Oct–Nov NaNo window leaves slack.
**Enforcement:** advisory-only (this wave file + HANDOFF sequencing).

### Decision 6: Deploy-order constraint

**Context:** Pushing master deploys writersnook.app live; endpoints referencing missing tables would crash in production (review finding).
**Pick:** Supabase migration applied (Cole or agent with Supabase access) BEFORE the endpoint phase merges to master; AI endpoints are auth-gated from their first commit; desktop-side releases remain Cole-run via `publish.ps1` (no auto-exposure).
**Enforcement:** Phase 1 Notes + Note to the implementer; acceptance criterion ordering.

### Decision 7: Subscription gates ONLY the AI panel in this wave

**Context:** `license.gate.ts`'s `cleared` state is permanent by design for one-time licenses; the review flagged that subscriptions would otherwise need app-gate surgery.
**Pick:** Wave 34 leaves the app-level gate untouched: the AI subscription key is entered and validated inside the Assistant panel; lapse/expiry affects the panel only. The app-pricing restructure (whether $14.99/mo gates the whole app, and what lapse does to it) is locked in Decision 8 below and implemented at wave 36.
**Enforcement:** Phase 4 scope + Note to the implementer ("do NOT restructure the app's license gate").

### Decision 8: lapsed-subscription behavior for the eventual full lineup — `durable: candidate`

**Context:** When the pricing lineup flips (wave 36) to $14.99/mo (full app + AI) / $99 one-time (app + BYO AI), what happens to the app when a subscription lapses? Does not block wave 34 (per D7) but shapes wave 35 marketing copy.
**Pick (Cole-ratified 2026-06-12):** Writing access never locks — a lapsed subscription drops AI + future updates, but the editor, binder, story bible, and export remain fully usable (local-first promise: manuscripts are never hostage).
**Enforcement:** none yet (implemented at wave 36; this lock binds wave-35 marketing copy and wave-36 gate design).

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | 2026-06-12 (run-phase wf_850770ae-4f5) | 2026-06-12 — gates green; reviewer FLAG ×3 adjudicated, all 4 findings fixed pre-commit (TOCTOU→atomic `decrement_credits` RPC, CREDIT_UNIT_USD mirror, pinned model ID, hooks violation) | 6dbcd3c + 71a816a (CORS fix — WebView preflight, found at live smoke) | YES 2026-06-12 — Cole typed a prompt into the dev panel and watched a streamed reply (after CORS fix deployed). Backend chain also verified via curl: session 200 → chat SSE → done {16 in / 8 out / 513 credits}. |
| 2 | 2026-06-12 (run-phase wf_69a127eb-0b2) | 2026-06-12 — gates green (128 tests); reviewer BLOCK adjudicated: RPC param mismatch (p_cost→p_amount, would have 429'd every chat), rate-cap off-by-one, email-key OOO bug — all fixed pre-commit + LS-mint path and env variant IDs wired | 7784b06 | Internal phase (no user-visible observation per plan). NOT pushed — awaiting Cole paste-run of 0003_credit_reserve.sql (D6). LS sandbox webhook end-to-end test pending (gates Phase 2 ship per plan Note). |

## Follow-up candidates

- GDPR/DPA + privacy-policy formalization for the AI data path (Supabase US region posture, Anthropic DPA, EU transfer mechanism, privacy-page disclosure): legal/contractual work spanning marketing + product copy, not clearable by an implementer dispatch | present-harm: K3 — the "never trains on your manuscript" promise ships in wave 34's consent copy while the DPA/data-residency posture is unreviewed; dated observation 2026-06-12, attack-decision review (agent a7b4f2e6fd21ba541), Angle 1.

## Result

<!-- Filled at ship by wrap team. Includes: what the wave delivered, links to promoted artifacts, mechanical-review verdict, telemetry summary. -->
