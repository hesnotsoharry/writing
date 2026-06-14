---
project: writing
title: Reddit-launch readiness roadmap (r/writingwithai)
created: 2026-06-13
status: PLAN — awaiting Cole approval before wave execution
source: promotion-repo launch plan (2026-06-13f-writersnook-launch-plan.md) reconciled against live codebase
---

# Reddit-launch readiness — sequenced wave roadmap

This is the writing-repo (app + marketing) half of the promotion-repo launch plan, reconciled
against the **actual shipped state** of WritersNook v0.8.0 (waves 36+37, 2026-06-13). The promotion
plan was authored from market research and assumes a greenfield build; in reality much is shipped.
This roadmap encodes only the **real gaps**, sequenced into waves, with the cross-surface decisions
locked.

Out of scope here (Cole / promotion-repo owned): Mac Apple-Developer enrollment, Reddit account
standing + Week-0 comment, Ben/Novelmint DM, the post copy itself.

---

## Reconciliation summary (audit, 2026-06-13)

**Already DONE — do not rebuild:**
- Trial clock = 14-day from **first app open** (not install), rollback-defeated (`license.gate.ts:57`, `trial.ts:31,45`).
- Trial download is the **hero CTA** (`index.html:66`); "No account, no card" subtext present.
- $14.99/mo pricing card live with correct **"meter not a bill"** framing (`pricing.html:95-108`) — rejects the fake fixed run-count.
- Controllable-context claim exists on the pricing card (`pricing.html:101`).
- Webhook credits-loss bug **RESOLVED** (`fb23433`, RPC-first ordering). HANDOFF is stale — still lists it as the top blocker and undercounts follow-ups (15, not 3). Fix HANDOFF at next wrap.
- Anti-**sycophancy** harness shipped wave 37 (`src/features/ai/prompts/shared.ts:17-22`).

**Real gaps (the work):**
- BYOK Phase 1 — MISSING entirely (no key path, no keychain use). The "dead toast" in the source plan does not exist; nothing to fix, it's net-new.
- Sonnet model toggle — MISSING UI; billing infra ready (`credits.ts:51` already rates Sonnet/Opus; `verb-config.ts:66` pins all verbs to Haiku).
- Trial AI gating — MISSING; trial currently grants **unlimited** AI for 14 days (credits are subscriber-only). Net-new.
- Anti-**AI-isms** vocabulary ban + show-don't-tell register — PARTIAL (sycophancy bans shipped; word-list + register did not).
- Features-page AI section — PARTIAL (exists but never names *Claude*; controllable-context claim only on pricing).
- Mac waitlist — MISSING.
- UTM on links — MISSING (zero `utm_` tags).

**Live blockers the source plan didn't catch (on writersnook.app now):**
- B1: False unconditional privacy claim — `privacy.html:58` "nothing you write ever touches our servers" is false in AI mode (text transits the Anthropic relay). Contradicts the privacy-first positioning and the plan's own "never say nothing-leaves-your-device" rule.
- B2: Counsel-review banner live in production — `privacy.html:56` "Template copy for review — please have these terms checked by counsel before launch."
- B3: Dead $14.99 Subscribe button — `pricing.html:106` → `#ai-subscribe-url-set-at-launch`; site advertises an unbuyable tier. Plus in-app consent copy promises "or bring your own API key" (`AiOverlays.tsx:66`) for a feature that doesn't exist.

---

## Locked decisions

### Decision 1 — Trial AI gating: dollar-allowance, not assist-count
**Context:** Source plan said "25 assists, hard stop." Trial currently = unlimited AI for 14 days; no assist counter exists; metering is subscriber-only.
**Pick:** Give non-subscriber trial users a small **server-side dollar-allowance** and reuse the existing meter + hard-stop, instead of building a new assist-counter/badge/nudge.
**Rationale:** Reuses shipped infra; auto-accounts for Sonnet (3×); caps the abuse tail at a fixed dollar figure; surfaces the live-cost-meter differentiator to trial users (conversion lever). Raw assist counts are abuse-blind and a low count (25 ≈ 30¢) frustrates real evaluators while capping nothing.
**Consequences:** Trial gating becomes a credit-bucket change (worker/Supabase) + app meter wiring for non-subscribers, not a new UI subsystem. Allowance is a config constant (start ~$1.50 ≈ 100+ Haiku / ~40 Sonnet assists), tunable from data.
**Enforcement:** advisory-only (design intent recorded here; W39 implements + tests the gate).

### Decision 2 — Anti-AI-isms harness: worker-appended versioned block
**Context:** Source plan assumed a Cloudflare-worker edit with instant rollback; prompts are actually client-side (ship in the app binary → no hot rollback). Zero current users.
**Pick:** Keep app-authored prompts; have the **worker append a server-controlled, versioned "house-style / anti-AI-isms" block** to the system prompt it receives. Not full server-side assembly (over-engineering), not pure client-side (no hot rollback on the layer that needs tuning).
**Rationale:** Smallest change that delivers version + instant rollback on exactly the layer iterated in public post-launch. Cheap to set up at zero users; pays off the week of launch when prose-quality tuning is live.
**Consequences:** A versioned house-style string lives worker-side with instant rollback; the blind eval (W42) tunes it without app releases.
**Enforcement:** advisory-only (W42 implements; rollback path is a worker redeploy / config flip).

### Decision 3 — Sequencing: honesty first, then cost-control, then features
**Context:** ~6 waves of work; a false privacy claim + unbuyable tier are live now; Cole's cadence rule makes a slipped feature cheap (post slips a week) but a post on a broken/false claim is not.
**Pick:** Launch-critical trio first (W38 honesty, W39 trial-gating, W43 site-surface); fast-follow waves (W40 BYOK, W41 Sonnet, W42 harness) gate specific later Reddit posts, not the launch post.
**Rationale:** The launch-readiness gate only requires the trio. BYOK/local-models/Sonnet map to the week-2/3/4 cadence posts, where slipping is cheap by design.
**Enforcement:** advisory-only.

---

## Wave sequence

### W38 — launch-honesty (LAUNCH-CRITICAL, no deps)
Make the live site + in-app copy truthful. Smallest, highest-urgency, blocks nothing.
- B1: Rewrite `privacy.html:58` unconditional claim to conditional/accurate ("we never **store** your writing"; AI text transits Anthropic in-flight, not stored). Audit the whole privacy + features + index copy for any other unconditional "never leaves/touches" phrasing.
- B2: Remove the counsel-review banner (`privacy.html:56`) **or** gate it — and flag to Cole whether counsel sign-off has actually happened (legal gate, Cole's call).
- B3: Either wire the $14.99 Subscribe CTA (LAUNCH-AI-SUBSCRIPTION.md Step 5 — live checkout URL) **or** hide the card until W39/checkout is ready. Correct the in-app consent copy (`AiOverlays.tsx:66`) so it doesn't promise BYOK before W40 ships (either soften to "coming soon" or remove the clause).
**Acceptance:** No unconditional "nothing leaves/touches" claim anywhere live; no counsel-template banner public; no dead/false purchase or BYOK promise on site or in app.
**Surface:** `marketing/public/{privacy,features,index,pricing}.html`, `src/.../AiOverlays.tsx`. Marketing gates: test + tsc only (no lint in marketing).

### W39 — trial-gating (LAUNCH-CRITICAL)
Implement Decision 1: dollar-allowance trial bucket reusing meter + hard-stop.
- Non-subscriber trial users get a server-side credit allowance (config constant, ~$1.50 start).
- Existing meter UI + hard-stop apply to trial users; non-AI features stay fully usable after exhaustion.
- Soft nudge near exhaustion (reuse `aiMeterStatus` thresholds, not a new 10-left counter).
- Instrument: trial allowance consumption visible in the per-license request log (cheap-metrics path, weeks 1-4).
**Acceptance:** A fresh trial user hits the dollar ceiling and is hard-stopped on AI only; meter shows live cost; abuse is bounded at the constant; verified end-to-end (CDP smoke per project oracle — green vitest ≠ working).
**Surface:** `marketing/functions/_lib/credits.ts` + webhook/session path; app `ai.helpers.ts`/meter wiring; `trial.ts`/`license.gate.ts` for the non-subscriber bucket.

### W43 — site-launch-surface (LAUNCH-CRITICAL)
The site additions the launch-readiness gate requires.
- Features-page AI section: name **Claude**, add the controllable-context + live-cost-meter claim (lift from pricing card), "Claude, built into your editor."
- Mac waitlist: email capture via **Tally/Buttondown/ConvertKit** (no hand-built infra) — captures emails, "Mac — join the waitlist."
- UTM on all CTA/download links (hero installer, pricing download, footer) so Reddit traffic is attributable.
**Acceptance:** Features page names Claude + controllable-context; Mac waitlist captures a test email; every outbound CTA/download link carries a UTM.
**Surface:** `marketing/public/{features,index,pricing}.html` + waitlist embed/config.

--- fast-follow (gate later cadence posts, not the launch post) ---

### W40 — BYOK Phase 1 (gates week-3 "local models / Ollama" post)
- Settings selector: Managed [default] / My key / Custom endpoint [greyed "coming soon"].
- Anthropic key path; key stored in **OS keychain** (NOT SQLite — new `aiAnthropicKey`, separate from the existing subscription `aiLicenseKey`). Research the Tauri keychain plugin against pinned version before building (vendor-gotchas/ctx7).
- BYOK calls **must not** decrement the managed meter — verify explicitly.
**Acceptance:** A user pastes an Anthropic key → assists route through it → managed meter untouched; key persists in keychain, not the DB.

### W41 — Sonnet toggle — ABSORBED into W44 (2026-06-13)
Superseded: the Sonnet-only toggle is now a special case of W44's multi-provider model picker (Haiku/Sonnet are just the Anthropic entries). Do not run W41 standalone; its acceptance criteria fold into W44.

### W44 — multi-provider models + unified credit (Cole priority, 2026-06-13)
Add a SECOND provider (OpenAI / "ChatGPT") under the managed subscription, with ONE unified credit the user sees; each model decrements that single pool by its cost (RATES-table extension). Generalizes W41 (Sonnet) — Anthropic + OpenAI models share one picker + one credit pool + the live cost-meter + hard-stop.
**Design status:** blueprint in progress — `2026-06-13-multi-provider-unified-credit-blueprint.md` (opus-architect, read-only). Money/live-proxy-adjacent → implementation waits for Cole + a formal decision-review (attack-decision) cell before the decision is locked.
**Axes (see blueprint):** worker provider-abstraction; unified credit/cost normalization (incl. cross-provider cached-input asymmetry); OpenAI→app SSE stream normalization; model-select UX (Haiku default); reservation/hard-stop across heterogeneous models; rollout + provider-outage fallback.
**Acceptance (provisional):** user picks any model (Anthropic or OpenAI) → routes to that provider → one credit pool decrements by that model's real cost → live meter stays accurate → hard-stop holds across providers.

### W42 — anti-AI-isms harness + blind eval (gates prose-quality posts)
- Implement Decision 2: worker appends versioned house-style block (AI-isms ban + show-don't-tell register + a few Variant-B exemplars). Instant-rollback path.
- Blind eval (Haiku vs Haiku+harness vs Sonnet) on ~12 real assist tasks — to learn which assist types to steer to Sonnet, NOT to claim prose quality at launch.
**Acceptance:** House-style block versioned + hot-rollbackable; eval run + results recorded; no prose-quality claim added to marketing.

---

## Launch-readiness gate → wave mapping
| Gate item | Wave | State |
|---|---|---|
| Features page AI section w/ controllable-context | W43 | to build |
| Pricing $14.99 + cost-shown-live | W38 (wire CTA) | card DONE, checkout pending |
| Trial-hero CTA + "we never store your writing" | W38 | hero DONE, privacy line fix |
| Mac waitlist | W43 | to build |
| BYOK toast not dead (works or "coming soon") | W38 (copy) / W40 (build) | net-new |
| Trial ceiling verified | W39 | now dollar-allowance |
| UTM on all links | W43 | to build |
| Reddit checked + Week-0 comment + Ben DM | — | Cole / promotion repo |

**Critical path to a launchable Tuesday post: W38 + W39 + W43.** W40/W41/W42 slip cheaply onto the weekly cadence (BYOK→wk3, harness→prose posts).
