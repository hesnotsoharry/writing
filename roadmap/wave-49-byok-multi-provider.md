# Wave 49 — BYOK multi-provider (bring-your-own key beyond Anthropic)

> **Status: PLANNED — scope-capture stub, not yet built.** Expand into a full plan with
> `/wave-plan-lite` when scheduled. Created 2026-06-14 during the W40→W44 merge, when the
> BYOK×model-picker interaction surfaced the gap. Depends on W44 (ProviderAdapter seam) being merged.

## Goal

Extend BYOK from Anthropic-only (W40 Phase 1) to **multi-provider**: a user pastes their own
**OpenAI/ChatGPT key** (and later other cloud providers) and the assistant routes **direct to
that provider's API** — key + prose never touch WritersNook servers — reusing W40's pattern
(Rust-direct call + `keyring` v4 storage + "Your key" badge + managed-meter suppression).

This is the BYOK sibling of two already-planned waves:
- **W44 (managed multi-provider)** — OpenAI under the *unified managed credit*, via the
  `ProviderAdapter`/`OpenAIAdapter` seam. W49 reuses that adapter shape but routes with the
  user's own key instead of the managed proxy.
- **W45 (local-LLM)** — local models (llama.cpp/ollama) as a *non-managed inference source*.
  W49 + W45 together are "user brings their own compute/keys"; coordinate the picker UX so
  managed / BYOK-cloud / local are one coherent model-selection surface, not three bolt-ons.

## Why now (the breadcrumb from the W40→W44 merge)

W44's model picker offers Anthropic + OpenAI/GPT models. W40's BYOK is Anthropic-key-only.
**Interim resolution applied at the W44 merge (2026-06-14):** in BYOK mode the picker is
**restricted to Anthropic models** (a user's Anthropic key can't call OpenAI). **W49 lifts that
restriction** — in BYOK mode the picker shows models for whichever providers the user has
supplied a key for. Search the W44-merge commit for the `byokMode` picker gate; that gate is
the seam W49 opens up.

## Open questions (resolve at `/wave-plan-lite` time)

1. **Key storage:** one `keyring` entry per provider (`writing/byok/anthropic`, `writing/byok/openai`, …)?
2. **Picker behavior in BYOK mode:** show models only for providers with a key present; what's the
   empty/partial state (one key set, another not)?
3. **Provider order for Phase 2:** OpenAI first (W44 already built the OpenAIAdapter to reuse);
   Gemini / others after?
4. **Custom endpoint / OpenAI-compatible base URL:** does this subsume part of W45 (local models
   are often OpenAI-compatible servers)? Decide the W45↔W49 boundary before building either.
5. **Cost visibility:** ties directly to the queued *BYOK own-key usage-visibility* follow-up —
   with multiple providers, a rough per-provider usage signal matters more. Fold that follow-up in.

## Relationship index
- W40 (the BYOK pattern to extend): `roadmap/wave-40-byok-phase-1.md` + decisions `0002` (direct-to-Anthropic) / `0003` (keyring v4).
- W44 (ProviderAdapter seam): `roadmap/discovery/2026-06-13-multi-provider-unified-credit-blueprint.md`.
- W45 (local models): referenced in `roadmap/discovery/2026-06-13-reddit-launch-readiness.md` (no wave file yet).
