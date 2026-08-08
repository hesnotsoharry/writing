---
status: RESEARCH — recommendation below NOT yet ratified by Cole (as of 2026-07-10 memory-retirement pass; re-verify against decisions/ before treating as settled)
researched: 2026-06-15
---

# Adult/Explicit Content Policy Research — Frontier API Constraints

Researched 2026-06-15 (4 parallel passes). Hard finding, confirmed 4 ways: **no app can resell
frontier-provider API access (Anthropic/OpenAI) for adult/explicit fiction under a managed
subscription** — it is architecturally impossible, not a policy choice this app can configure
around.

## The finding

Both providers' ToS ban raw resale/wrapper use for this purpose, and both refuse explicit content
at the model level. **Anthropic moderates at the INPUT stage** ("Claude may moderate content
deemed particularly dangerous regardless of the prompt used") — so even a benign task
(proofread/critique) on a manuscript chapter that *contains* an explicit scene gets refused, and
repeated attempts risk **Cole's own** managed-tier account (Anthropic deactivated ~1.45M accounts
in 6 months as of this research, ~3.3% appeal success rate). End-user-ID / `safety_identifier`
tags reduce but do NOT eliminate dev-account liability — they're a targeting mechanism, not a
shield.

**Practical line (creative tasks):**
- **Claude:** romance/sensual/fade-to-black OK, explicit REFUSED (categorical, baked into the
  weights, consistent across Haiku/Sonnet/Opus).
- **OpenAI:** Model Spec has a "transformation exception" (editing user-provided restricted
  content is theoretically allowed, generating new explicit detail is not); real-world behavior
  was inconsistent as of late-2025; adult-mode was paused indefinitely (March 2026); the
  moderation endpoint flags but doesn't auto-block (opt-in).

## Market pattern (how other tools solve this)

Three paths observed across the market — none use a frontier managed API for NSFW:
1. **Own/finetuned models** — NovelAI, Sudowrite-Muse, DreamGen: managed subscription, age-gated.
2. **BYOK + an uncensored aggregator** (e.g. NovelCrafter via OpenRouter uncensored models).
3. **Local/self-host** (KoboldAI).

## Recommended architecture for WritersNook (NOT yet ratified by Cole)

- **Managed tier** (Cole's Anthropic/OpenAI keys) stays **non-explicit writing only** — don't
  position it for adult content. Keeps the account safe.
- **Adult/explicit path = BYOK + a permissive model**, via the EXISTING OpenAI-compatible
  BYOK/local-endpoint support (shipped W45/W49) — liability sits on the user's own key. This path
  is already mostly built; it needs to become a documented, intentional feature rather than an
  incidental capability.
- **Do NOT build a managed uncensored lane** (Cole proxying an OpenRouter-uncensored model)
  unless he's willing to become a moderation operator (age-gate + CSAM block + ToS enforcement).
- Quality gap of permissive models vs. frontier is small at the researched time: Dolphin 3.0
  Mistral 24B, Hermes 3/4, NovelAI Erato — within single digits on reasoning, roughly
  margin-of-error on prose quality.

## Real, unhandled UX problem

A romance writer pasting a chapter containing an explicit scene into the MANAGED tier hits a
silent refusal. Don't fail silently — detect/warn and point to BYOK/local for those scenes.

**Defense-in-depth plan (Cole-ratified 2026-06-15 as a design direction, captured at the time in
W46's `## Follow-up candidates` as a paired slice — verify current status in
`roadmap/follow-ups/` and the wave-46 file before assuming this is still open):**
1. Granular per-text-range "hide from AI" — a TipTap `aiExclude` Mark, Yjs-persisted, stripped at
   `assembleContext()` (`ai.context.ts:118`) before `buildGrounding()`; register in
   `buildExtensions()` (`Editor.tsx:96`). Composes with — does NOT replace — the existing coarse
   `AiContextPicker` ("What the assistant sees" modal, `AiOverlays.tsx:258`, scene/entity/About
   level only).
2. Reactive managed-refusal warning (needs a scout pass on how the refusal actually surfaces).
   User-driven marking (#1) can't fully replace this reactive warning + BYOK/local fallback.

**Verified at research time:** the harness (house-style/anti-slop scaffolding) applies to ALL
paths including local/custom models — `buildMessages` is upstream of the provider split — so the
BYOK/local adult path is first-class, not a degraded experience.

## Eval-harness consequence (W46)

Keep explicit content OUT of any eval matrix run on Cole's generation keys — it would measure
refusals rather than writing quality, and risks account strikes. Content-permissiveness is a
SEPARATE screening concern that applies only to the permissive models' own access; the eval's
"recommended default" conclusion is scoped to the managed (SFW) tier and is unaffected by this
finding.

## Hard line — do not conflate

CSAM is a universal hard line (NCMEC reporting, every tier, no exceptions) — entirely separate
from the adult-content question above. See `decisions/` for the managed-tier billing model this
interacts with (the allowance economics, not the content policy).
