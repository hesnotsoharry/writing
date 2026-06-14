/**
 * W44 Phase C — ORCHESTRATOR-AUTHORED ACCEPTANCE TEST (written before the implementation).
 *
 * Pins the server-side model-resolution contract. The implementer builds:
 *   chat.ts → export `MANAGED_MODELS: ReadonlySet<string>`  (the allowlist)
 *   chat.ts → export `resolveModelConfig(verbKey, verbConfig, clientModel)` (pure resolver)
 *     returns { ok: true, config } | { ok: false }   (ok:false → handler responds 400)
 *
 * Rules (Decision 4 + Cole Q2/Q5):
 *  - proofread ALWAYS uses its cheap verb-default model, ignoring any client model (mechanical).
 *  - any other verb: a client model that IS in MANAGED_MODELS overrides verbConfig.model
 *    (temperature/maxTokens preserved from the verb); a client model NOT in MANAGED_MODELS,
 *    or a non-string, → ok:false (400). Absent client model → verb default.
 *  - MANAGED_MODELS ⊆ Object.keys(RATES): no allowlisted model may resolve to the Haiku
 *    rate fallback (the silent-under-bill guard).
 */
import { describe, expect, it } from 'vitest';

import { RATES } from '../../_lib/credits';
import { getAdapter } from '../../_lib/providers';
import { VERB_CONFIG } from '../../_lib/verb-config';
import { MANAGED_MODELS, resolveModelConfig } from './chat';

const HAIKU = 'claude-haiku-4-5-20251001';

describe('W44 MANAGED_MODELS ↔ RATES sync guard (silent-under-bill defense)', () => {
  it('every allowlisted model has a real RATES entry (never resolves to the fallback)', () => {
    for (const model of MANAGED_MODELS) {
      expect(Object.prototype.hasOwnProperty.call(RATES, model)).toBe(true);
    }
  });

  it('every allowlisted model resolves via getAdapter to its declared provider (not a misroute)', () => {
    for (const model of MANAGED_MODELS) {
      expect(getAdapter(model).provider).toBe(RATES[model].provider);
    }
  });

  it('offers the full Q1 lineup: Haiku, Sonnet, gpt-5.4-mini, gpt-5.4 (standard) + Opus, gpt-5.5 (premium)', () => {
    expect(MANAGED_MODELS.has('claude-haiku-4-5-20251001')).toBe(true);
    expect(MANAGED_MODELS.has('claude-sonnet-4-6')).toBe(true);
    expect(MANAGED_MODELS.has('gpt-5.4-mini')).toBe(true);
    expect(MANAGED_MODELS.has('gpt-5.4')).toBe(true);
    expect(MANAGED_MODELS.has('claude-opus-4-8')).toBe(true);
    expect(MANAGED_MODELS.has('gpt-5.5')).toBe(true);
  });
});

describe('W44 resolveModelConfig — proofread stays cheap-tier (mechanical, un-bypassable)', () => {
  it('proofread + a premium client model → resolves to the proofread verb-default (Haiku), ignoring the client', () => {
    const r = resolveModelConfig('proofread', VERB_CONFIG.proofread, 'gpt-5.5');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.model).toBe(VERB_CONFIG.proofread.model);
      expect(r.config.model).toBe(HAIKU);
    }
  });

  it('proofread + an Opus client model → still Haiku (no override path for proofread)', () => {
    const r = resolveModelConfig('proofread', VERB_CONFIG.proofread, 'claude-opus-4-8');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.model).toBe(HAIKU);
  });
});

describe('W44 resolveModelConfig — model override for non-proofread verbs', () => {
  it('brainstorm + an allowlisted OpenAI model → overrides the model, preserves verb temperature/maxTokens', () => {
    const r = resolveModelConfig('brainstorm', VERB_CONFIG.brainstorm, 'gpt-5.4');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.model).toBe('gpt-5.4');
      // verb policy preserved — only the model is overridden
      expect(r.config.maxTokens).toBe(VERB_CONFIG.brainstorm.maxTokens);
      if ('temperature' in VERB_CONFIG.brainstorm && 'temperature' in r.config) {
        expect(r.config.temperature).toBe(VERB_CONFIG.brainstorm.temperature);
      }
    }
  });

  it('critique + an allowlisted Anthropic model (Sonnet) → overrides to Sonnet', () => {
    const r = resolveModelConfig('critique', VERB_CONFIG.critique, 'claude-sonnet-4-6');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.model).toBe('claude-sonnet-4-6');
  });

  it('brainstorm + NO client model → falls back to the verb default', () => {
    const r = resolveModelConfig('brainstorm', VERB_CONFIG.brainstorm, undefined);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.model).toBe(VERB_CONFIG.brainstorm.model);
  });

  it('brainstorm + a NON-allowlisted model string → ok:false (handler → 400, never bills it)', () => {
    const r = resolveModelConfig('brainstorm', VERB_CONFIG.brainstorm, 'gpt-9-ultra');
    expect(r.ok).toBe(false);
  });

  it('brainstorm + a non-string client model → ok:false (400)', () => {
    const r = resolveModelConfig('brainstorm', VERB_CONFIG.brainstorm, { sneaky: true });
    expect(r.ok).toBe(false);
  });

  it('a model present in RATES but NOT in MANAGED_MODELS would be rejected (allowlist is the gate, not RATES)', () => {
    // sanity: if some future RATES key is intentionally not offered, it must 400, not route.
    const r = resolveModelConfig('brainstorm', VERB_CONFIG.brainstorm, 'totally-unknown-model');
    expect(r.ok).toBe(false);
  });
});
