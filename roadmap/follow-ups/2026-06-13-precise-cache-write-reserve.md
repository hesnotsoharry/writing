---
status: OPEN
created: 2026-06-13
qualifying-criterion: multi-file
cannot-be-cleared-by: single sonnet-implementer dispatch — requires coordinating `estimateCredits` reserve logic with `shouldAttachCache` signal across `marketing/functions/_lib/` files
present-harm: K2 — service silently under-charges ~`system_tokens × 0.025` units on a first-turn cache-write over the 4096-token Haiku floor; a false invariant that "reserve ≥ actual" breaks exactly when caching fires (marketing/functions/_lib/credits.ts `estimateCredits` vs `actualCredits`, wave-37 phase 4 Decision 1 D3, 2026-06-13). Negligible for the 2-user app but a documented false invariant plus a small revenue leak.
---

# Follow-up: Precise cache-write reserve in `estimateCredits`

## Context

Wave 37 Phase 4 ([F] server-side VERB_CONFIG + model-aware billing) implemented the "reserve-then-reconcile" credit model: `estimateCredits` calculates the maximum possible cost, `reserve_credits` holds that amount atomically, and `actualCredits` (post-request) reconciles the actual usage.

The reserve-vs-actual contract states: "reserve ≥ actual in normal operation, EXCEPTION: on a first-turn cache-write, `actualCredits` applies the 1.25× `cacheWrite5m` premium to cached system tokens, so actual MAY slightly exceed reserve on that turn. Refund-only reconciliation — the user is never over-charged." (credits.ts lines 73–78)

However, the implementation has a gap: `estimateCredits` does not account for the cache-write rate when `shouldAttachCache` would fire. It bills system tokens at the base `input` rate always, but `actualCredits` bills cache-write system tokens at the premium rate.

## Issue

**Current behavior:**
- `estimateCredits(charCount, maxTokens, model)` computes: `inputEst = ceil((charCount/4) × rates.input)` + `outputReserve`
- This treats ALL input (system + messages) at base `rates.input`, never at `rates.cacheWrite5m`
- `actualCredits` applies `cacheCreationTokens × rates.cacheWrite5m` when caching fires
- Result: **reserve < actual** on a first-turn cache-write with a system block ≥ 4096 tokens

**Example (Haiku rates):**
- System + messages = 8000 characters → ~2000 tokens
- Estimated: `2000 × 0.1 (input) + 1536 (output) = 1736 units`
- System ≥ 4096 tokens → caching fires; system becomes ~4000 cached tokens, messages ~-2000
- Actual: `(2000 - sysTokens) × 0.1 + sysTokens × 0.125 + 1536 × 0.5 = ~1750 units` (over by ~14 units)
- Service charges `min(reserve, actual) = min(1736, 1750) = 1736` ✓ (user not overcharged, but reserve was insufficient)

The contract says "reserve ≥ actual" except on first-turn cache-write. The implementation does NOT honor the exception path — it silently under-reserves.

## Why this is a follow-up and not Phase 0 inline

Fixing this requires:

1. **Multi-file coordination:** `estimateCredits` in `credits.ts` must know whether caching will fire
   - Import or call `shouldAttachCache` from `prompt-cache.ts`
   - OR: pass a `shouldCache` boolean/flag to `estimateCredits`
   - Refactor the function signature and/or logic in two files

2. **Logic placement decision:** where does the cache-decision logic belong?
   - Call site in `chat.ts` (line 394) knows `systemLength` but `estimateCredits` doesn't
   - Option A: pass `systemLength` + `model` to `estimateCredits`, let it call `shouldAttachCache` internally
   - Option B: compute `shouldAttachCache` in `chat.ts`, pass a `cacheWriteTtl` param to `estimateCredits`
   - This design choice spans the call site (`chat.ts`) and the reserve function

3. **Test update:** The (model × cache-type) `actualCredits` unit test matrix must be extended or refined to cover the reserve-side assertion

This is a **bounded but multi-file refactor** (credits.ts call signature + chat.ts call site + optional prompt-cache coordination) and a **design question** (where the cache-decision logic sits) that a single sonnet-implementer dispatch can execute once the design is settled.

## Suggested approach

1. **Decide the design:** determine whether `estimateCredits` calls `shouldAttachCache` or receives a computed `cacheWriteTtl` param. (Likely: pass `systemLength` and let `estimateCredits` call `shouldAttachCache` internally — keeps the decision localized.)

2. **Refactor `estimateCredits` signature:**
   ```typescript
   export function estimateCredits(
     charCount: number,
     maxTokens: number,
     model: string,
     systemLength?: number,  // new param; if absent, no caching assumption
   ): number
   ```

3. **Implement the caching logic in `estimateCredits`:**
   - If `systemLength` is provided: compute `estimatedPrefixTokens = ceil(systemLength / 4)`
   - Call `shouldAttachCache(estimatedPrefixTokens, model)`
   - If true: apply `cacheWrite5m` rate to system tokens, base rate to message tokens
   - If false: apply base input rate to all

4. **Update the call site in `chat.ts` (line 393–394):**
   ```typescript
   const reserve = estimateCredits(totalChars, verbConfig.maxTokens, verbConfig.model, system?.length);
   ```

5. **Verify the invariant:** write or extend a unit test that asserts `estimateCredits(..., systemLength) ≥ actualCredits(...)` for a post-cache-write request at every (model × cache-type) combo.

6. **Update the comment** in `credits.ts` to reflect the fixed behavior: "reserve ≥ actual in all cases, including cache-writes" (remove the EXCEPTION clause).

---

*Qualified from wave-37 follow-up candidates (present-harm K2 with evidence pointers). Multi-file (credits.ts + chat.ts + prompt-cache.ts import), design-coordination required, cannot be cleared by single dispatch.*
