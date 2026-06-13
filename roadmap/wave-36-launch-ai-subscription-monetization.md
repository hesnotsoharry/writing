---
status: PLANNED
created: 2026-06-13
---

# Wave 36 — Launch / AI-subscription monetization (marketing)

## Plan

### Status

DRAFT · target: marketing deploy (no desktop app version bump — desktop release versioning belongs to Wave 35) · drafted 2026-06-13.

### Goal

After this wave the WritersNook marketing site presents the **$14.99/mo AI assistant subscription** (subscription-only — no BYOK) on the pricing, home, and features pages; the subscription webhook **emails the license key to new subscribers via Resend** (the `sendSubscriptionKeyEmail` no-op seam is wired to the existing live `sendEmail()` helper); and a complete, **dress-rehearsed launch runbook** plus documented secrets turn the test→live Lemon Squeezy flip into a single gated, Cole-executed step rather than a blind flip. All work lands on the `wave-36-launch-monetization` worktree branch; nothing reaches writersnook.app until the coordinated launch merge to master (push = deploy), which Cole performs after the GDPR/DPA + privacy-policy review clears. No desktop (`src/`) code is touched — that surface belongs to the in-flight Wave 35.

### Scope

**In scope:**

- **Marketing copy (subscription-only, reviewed wording verbatim, NO BYOK):**
  - `marketing/public/pricing.html` — a third `.pcard` in the `price-grid` (line ~59) presenting the $14.99/mo AI assistant subscription + one AI FAQ entry.
  - `marketing/public/index.html` — an AI item in the `.price-teaser` strip (line ~297).
  - `marketing/public/features.html` — an AI-assistant feature `.fcard` in the card grid (line ~268).
- **Resend wiring:** replace the no-op `sendSubscriptionKeyEmail` stub (`marketing/functions/api/webhooks/lemon-squeezy-subscription.ts:185-192`) with a `sendEmail()` call (subject/html/text + `Idempotency-Key`, never-throw) reusing `marketing/functions/_lib/resend.ts`.
- **Launch readiness (code + verification):** add the three undocumented vars (`LS_SUB_VARIANT_ID`, `LS_TOPUP_VARIANT_ID`, `LS_API_KEY`) to `marketing/.dev.vars.example`; author `marketing/LAUNCH-AI-SUBSCRIPTION.md` documenting every test→live flip step; run a test-mode end-to-end dress rehearsal (test subscription → webhook → key email) and record evidence.
- **The live flip (Phase D — Cole-executed, irreversible):** swap the three LS vars to live values on Cloudflare Pages project `writing`; create the live-mode LS subscription webhook; enable license-key generation on the live subscription product; fill the live subscribe-CTA checkout URL; merge to master. HARD-gated on Cole's confirmation that the GDPR/DPA + privacy-policy review has cleared.

**Out of scope:**

- **BYOK (bring-your-own-key) tier** — depends on Wave 35 Phase H Settings (not shipped); deferred to a later wave. Marketing advertises the subscription only; BYOK appears in NO marketing copy (locked, wave-35 Decision 6).
- **Any desktop app `src/` code, incl. `src/features/ai/**`** — Wave 35, possibly still in flight.
- **GDPR/DPA + privacy-policy formalization** — Cole + counsel, non-software. Flagged as a real-money launch blocker gating Phase D; surfaced, not resolved here.
- **`account.html` subscription-status wiring** — the existing static `WN_M4` stub stays static; live subscription-status display is a separate effort.
- **Buyer-facing top-up checkout flow** — the topup webhook handler exists server-side; the buyer-facing top-up UI is a future wave.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| A | AI subscription copy across marketing pages | sonnet-implementer | trophy · internal-only (static HTML, no logic) · `reviewTier: single` + smoke. Add a third `.pcard` to the pricing.html `price-grid` ($14.99/mo, reviewed copy from `assistant-handoff/HANDOFF.md`, subscription-only — NO BYOK mention), one AI FAQ entry, an AI item in the index.html `.price-teaser`, and an AI feature `.fcard` in features.html. Subscribe CTA target is a placeholder filled at launch (Phase D) — do NOT hardcode a test checkout UUID (LS test→live mints a NEW UUID, lemonsqueezy.md 2026-06-10). | The pricing page renders a third card reading "$14.99 / month" for the AI assistant, and the features page shows an AI-assistant card — both visible in a browser at the local preview. |
| B | Resend wiring in the subscription key-email seam | sonnet-implementer | honeycomb · cross-boundary (sends an email on a webhook event) · `reviewTier: single`. Replace the `sendSubscriptionKeyEmail` no-op (lemon-squeezy-subscription.ts:185-192) with `sendEmail(env, {to, subject, html, text, idempotencyKey: \`sub-key-${licenseKey}\`})` per resend.md (never-throw sentinel return, Bearer auth, verified `from`). Orchestrator authors a failing acceptance test BEFORE dispatch. | After a test-mode subscription purchase, the new subscriber's license-key email appears in the Resend "Emails" dashboard send log and lands in the test inbox. |
| C | Launch readiness: secrets doc + runbook + dress rehearsal | sonnet-implementer | trophy · internal-only · `reviewTier: single`. Add `LS_SUB_VARIANT_ID`/`LS_TOPUP_VARIANT_ID`/`LS_API_KEY` to `.dev.vars.example` with comments; author `marketing/LAUNCH-AI-SUBSCRIPTION.md` enumerating every test→live step (new variant IDs + checkout UUID, live webhook URL+secret, live product license-key toggle, fail-loud guard at line 337, post-flip verification). Run a test-mode E2E dress rehearsal and record the evidence in the runbook. | Run through the runbook in test mode, a subscription purchase delivers the license-key email to the test inbox end-to-end — confirming the path works before any live flip. |
| D | Live-mode flip (Cole-executed, GDPR-gated, irreversible) | orchestrator | trophy · cross-boundary (real-money LS + live webhook) · `reviewTier: single`. **HARD PRECONDITION: Cole confirms the GDPR/DPA + privacy-policy review has cleared — surface the status before this phase ships; do NOT flip blind.** Cole sets the three live LS vars on Pages project `writing`, creates the live subscription webhook (URL = `/api/webhooks/lemon-squeezy-subscription`, same signing secret), enables license-key generation on the live product, fills the live subscribe-CTA checkout URL into the Phase A card, then merges to master (= deploy). Orchestrator verifies post-flip via the runbook. No automated commit — dashboard/secret config + a Cole-run merge. | A final live-test (or first real) subscription purchase processes a live webhook event — the subscriber receives their license-key email and the subscription appears in the live Supabase data — observable in the Resend dashboard and the customer's inbox. |

Wave verification strategy: Phases A and the dress-rehearsal side of C are smoked in a browser (chrome-devtools MCP against the local `marketing/public/` files or a `wrangler pages dev` preview). Phase B's email send is observed in the Resend dashboard / test inbox after a test-mode subscription. Phase D is observed post-flip in the live Resend dashboard + Supabase. Nothing in this wave is smoked through the desktop app (different surface, different wave).

### Acceptance criteria

- [ ] `marketing/public/pricing.html` contains a third `.pcard` whose price displays `$14.99` and `/month`; `grep -c "14.99" marketing/public/pricing.html` ≥ 1.
- [ ] No marketing HTML advertises BYOK: `grep -ri "bring your own\|your own.*api key\|BYOK" marketing/public/` returns zero hits.
- [ ] `marketing/public/features.html` contains an AI-assistant feature card and `marketing/public/index.html` price-teaser includes an AI item (grep for an AI-assistant marker string in each).
- [ ] `sendSubscriptionKeyEmail` in `lemon-squeezy-subscription.ts` calls `sendEmail(...)` with an `idempotencyKey` and no longer contains the `void env; void email; void licenseKey;` no-op markers.
- [ ] A Phase B acceptance test exists, fails before the wiring and passes after — asserting `sendEmail` is invoked with the recipient, the license key, and an idempotency header when `subscription_created` is processed.
- [ ] `marketing/.dev.vars.example` lists all three of `LS_SUB_VARIANT_ID`, `LS_TOPUP_VARIANT_ID`, `LS_API_KEY`.
- [ ] `marketing/LAUNCH-AI-SUBSCRIPTION.md` exists and enumerates: re-reading live variant IDs + the new checkout UUID, creating the live webhook (URL + signing secret), the live product license-key toggle, the fail-loud guard, and post-flip verification.
- [ ] The Phase A subscribe CTA uses a placeholder/config target, not a hardcoded test checkout UUID: a grep for the test checkout UUID pattern in the new card returns zero hits.
- [ ] `npm run test` (run inside `marketing/`) passes and `tsc` is clean. (Marketing gates are test + tsc only — no lint; do NOT touch the root `eslint.config.mjs`, which belongs to the Tauri app.)
- [ ] The plan + runbook state that the GDPR/DPA review must clear before the live flip, and the live flip is NOT performed by this wave's automated phases (Phase D is Cole-executed).

### Files the next agent should read first

1. `marketing/.claude/vendor-gotchas/lemonsqueezy.md` — test→live flip gotchas: new variant IDs + new checkout UUID, the order-scoped subscription license-key fetch, the live-product license-key toggle. (This wave's current external-API grounding lives here, not in a research sidecar.)
2. `marketing/.claude/vendor-gotchas/resend.md` — the `sendEmail()` contract: verified-domain requirement, never-throw sentinel return, `Idempotency-Key` pattern.
3. `marketing/.claude/vendor-gotchas/cloudflare-pages.md` — push-to-master IS the deploy; secrets live on Pages project `writing`; `npm run deploy` fails in agent sessions.
4. `marketing/functions/api/webhooks/lemon-squeezy-subscription.ts` — the subscription webhook handler: the `sendSubscriptionKeyEmail` seam (line 185), the order-scoped key fetch (line 136), the variant-ID fail-loud guard (line 337).
5. `marketing/functions/_lib/resend.ts` — the live `sendEmail()` helper Phase B reuses.
6. `marketing/functions/_lib/supabase.ts` — `WebhookEnv` interface: env var names (`RESEND_*` lines 8-9, `LS_*` lines 31-39).
7. `marketing/public/pricing.html` — current pricing layout (`price-grid` line ~59, FAQ section) — the primary insertion surface.
8. `marketing/public/index.html` (`.price-teaser` ~line 297) + `marketing/public/features.html` (card grid ~line 268) — secondary insertion surfaces.
9. `assistant-handoff/HANDOFF.md` — "Pricing copy" row + "Copy inventory" section: the reviewed $14.99/mo wording (NB: the in-app consent copy references BYOK; marketing must NOT — strip that clause).
10. `roadmap/wave-35-assistant-redesign-port.md` `## Locked decisions` — Decision 5 (35/36 split) + Decision 6 (BYOK → wave 36): why this wave exists and what is deferred.
11. This wave file's `## Locked decisions` section.

### Note to the implementer

This is a **launch wave, not a feature wave** — its job is to present a price honestly, wire one email, and make an irreversible money-flip safe to perform. The whole surface is `marketing/`; touching `src/` (the desktop AI panel) means you've crossed into Wave 35. Resist three temptations: (1) advertising the BYOK tier — it does not exist yet and the marketing copy must stay subscription-only (wave-35 Decision 6); (2) "improving" the reviewed pricing/consent copy — port the $14.99/mo wording verbatim and drop the BYOK clause; (3) performing the live LS flip yourself — Phase D is Cole-executed and gated on the GDPR/DPA review, because pushing master deploys the live site and flipping LS variant IDs takes real money. First step: verify the `## Locked decisions` section below is filled in.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

> Decisions are NOT appended here freely. Per the decision-review cell (`~/.claude/rules/best-practice-spectrum.md`, M-42 P2): a non-trivial decision must run `sonnet-architect` → `sonnet-adversarial-reviewer` (`Posture: attack-decision`) → orchestrator adjudication BEFORE it is written into `## Locked decisions`. The `adversarial_review_enforce.mjs` hook denies the wave-file edit if the cell has not fired; genuinely trivial decisions skip via the `review-tier-{session_id}.json` sidecar.

### Decision 1: Marketing copy is subscription-only — no BYOK anywhere on the site

**Context:** The reviewed in-app consent copy reads "$14.99/month, or bring your own API key," but BYOK has no production plumbing until a later wave.
**Pick:** Marketing advertises the $14.99/mo subscription only; the BYOK clause is stripped from all marketing surfaces.  **Rationale:** Imported from wave-35 Decision 6 (Cole-locked 2026-06-12) — advertising a tier that cannot be purchased is a false promise to a paying audience.  **Consequences:** Marketing copy diverges intentionally from the in-app consent fine print until BYOK ships.  **Enforcement:** acceptance criterion (`grep` for BYOK in `marketing/public/` = 0) + adversarial reviewer attacks any BYOK mention.

### Decision 2: All wave-36 work lands on the `wave-36-launch-monetization` worktree; merge-to-master IS the launch

**Context:** Wave 35 is in flight on master in a parallel session, and pushing master auto-deploys writersnook.app. Two sessions committing to master interleave history and race the index.
**Pick:** A dedicated git worktree (`C:\Web App\writing-wave36-monetization`, branch `wave-36-launch-monetization`, forked off master `2f8af96`); the launch is the Cole-performed merge-to-master, coordinated with the desktop AI release and gated on GDPR/DPA.  **Rationale:** Disjoint file surfaces (`marketing/` vs `src/`) make a worktree clean; the worktree also holds the pricing copy out of production until the coordinated launch.  **Consequences:** Nothing in this wave is live until the merge; the merge is a deliberate launch act, not a routine push.  **Enforcement:** worktree isolation; Phase D precondition; the coordinated-launch coupling is surfaced to Cole at ship.

### Decision 3: The live LS flip is one Cole-executed, GDPR-gated step (Phase D), de-risked by a test-mode dress rehearsal

**Context:** Flipping LS to live mode and creating the live webhook is the one genuinely irreversible, real-money step in the wave; the GDPR/DPA review is an open Cole+counsel blocker.
**Pick:** Phase D is performed by Cole as dashboard/secret config (not an orchestrator-automated phase), only after the GDPR/DPA review clears; Phase C produces a runbook + a test-mode end-to-end dress rehearsal that proves the path before the flip.  **Rationale:** Reversible work (copy, email wiring) is automated; the irreversible step gets a human gate and a rehearsal rather than a blind flip.  **Consequences:** The wave's automated phases (A–C) leave a launch-ready branch; the go/no-go and the flip are Cole's.  **Enforcement:** Phase D Notes hard precondition; the runbook; status surfaced before the flip.

### Decision 4: Reuse the existing `sendEmail()` helper for the subscription key email — no new email infra

**Context:** The one-time-purchase flow already sends license-key emails via a live, verified-domain `sendEmail()` helper in `_lib/resend.ts`; the subscription seam is a no-op stub.
**Pick:** Wire `sendSubscriptionKeyEmail` to call `sendEmail()` with a deterministic `idempotencyKey` (`sub-key-${licenseKey}`) and the never-throw sentinel return per resend.md.  **Rationale:** The helper, env vars (`RESEND_API_KEY`/`RESEND_FROM`), and gotchas are already in place and verified; building parallel email infra would be duplication.  **Consequences:** Subscription emails inherit the same deliverability posture and idempotency guarantees as purchase emails.  **Enforcement:** Phase B brief + the failing-first acceptance test.

### Decision 5: The subscribe CTA checkout URL is a launch-time value, not hardcoded in Phase A

**Context:** LS test→live mints a NEW checkout UUID (lemonsqueezy.md 2026-06-10); hardcoding the test UUID in the pricing card would open a dead/test checkout for real customers.
**Pick:** Phase A ships the card with a placeholder/config CTA target; Phase D fills the live checkout URL at flip time, alongside the live variant IDs.  **Rationale:** Mirrors the existing app-checkout pattern and the documented test→live identifier churn.  **Consequences:** The AI card is not "buyable" until Phase D — acceptable, since nothing deploys before the launch merge anyway.  **Enforcement:** acceptance criterion (no test checkout UUID in the new card).

## Status

<!-- Per-phase rows added as work progresses: Phase | Dispatched | Completed | Commit SHA | Observation point hit -->

## Follow-up candidates

<!-- DEFAULT: empty. Stage only Tier-3 TRIPLE-gate items with present-harm: pointers. -->

## Result

<!-- Filled at ship by wrap team. -->
