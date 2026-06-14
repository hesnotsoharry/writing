/**
 * W44 Phase B — ORCHESTRATOR-AUTHORED ACCEPTANCE TEST (written before the implementation).
 *
 * This file pins the cross-provider adapter contract. The implementer MUST make these pass
 * WITHOUT weakening the assertions. The #1 gate is the cached-token subtraction: OpenAI's
 * `prompt_tokens` INCLUDES `cached_tokens`, so the adapter must compute
 *   inputTokens = prompt_tokens − cached_tokens
 * or cached input is billed twice (once at `input`, once at `cacheRead`).
 *
 * Contract under test (the implementer builds exactly this surface):
 *   _lib/providers/types.ts   → `CanonicalUsage` { inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens }
 *                               `ProviderAdapter` { provider, buildRequest(...), pump(upstreamBody, writeToken) }
 *   _lib/providers/openai.ts  → `OpenAIAdapter` implementing ProviderAdapter (provider:'openai')
 *   _lib/providers/index.ts   → `getAdapter(model)` selecting the adapter from RATES[model].provider
 */
import { describe, expect, it } from 'vitest';

import { actualCredits } from '../credits';
import { getAdapter } from './index';
import { OpenAIAdapter } from './openai';
import type { CanonicalUsage } from './types';

/** Build a ReadableStream<Uint8Array> from a raw SSE wire string (Chat Completions shape). */
function sseStream(raw: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(raw);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      // deliver in two arbitrary slices to exercise the line-buffer across chunk boundaries
      const mid = Math.floor(bytes.length / 2);
      controller.enqueue(bytes.slice(0, mid));
      controller.enqueue(bytes.slice(mid));
      controller.close();
    },
  });
}

async function pumpAll(
  adapter: { pump: (b: ReadableStream<Uint8Array>, w: (t: string) => Promise<void>) => Promise<CanonicalUsage> },
  raw: string,
): Promise<{ text: string; usage: CanonicalUsage }> {
  let text = '';
  const usage = await adapter.pump(sseStream(raw), async (t: string) => {
    text += t;
  });
  return { text, usage };
}

describe('W44 OpenAIAdapter.pump — the cached-token double-bill gate', () => {
  // OpenAI Chat Completions streaming wire format: content deltas, then a final usage-bearing
  // chunk with an EMPTY choices array, then the literal [DONE] terminator.
  const wire = [
    'data: {"choices":[{"delta":{"content":"Hello"}}]}',
    '',
    'data: {"choices":[{"delta":{"content":", world"}}]}',
    '',
    'data: {"choices":[],"usage":{"prompt_tokens":1000,"completion_tokens":50,"prompt_tokens_details":{"cached_tokens":800}}}',
    '',
    'data: [DONE]',
    '',
  ].join('\n');

  it('emits the concatenated token text', async () => {
    const { text } = await pumpAll(new OpenAIAdapter(), wire);
    expect(text).toBe('Hello, world');
  });

  it('subtracts cached_tokens from prompt_tokens for inputTokens (THE billing gate)', async () => {
    const { usage } = await pumpAll(new OpenAIAdapter(), wire);
    expect(usage.inputTokens).toBe(200); // 1000 prompt_tokens − 800 cached_tokens
    expect(usage.cacheReadTokens).toBe(800);
    expect(usage.cacheCreationTokens).toBe(0); // OpenAI has no cache-write bucket
    expect(usage.outputTokens).toBe(50);
  });

  it('bills cached tokens exactly ONCE (no double-bill) via actualCredits', async () => {
    const { usage } = await pumpAll(new OpenAIAdapter(), wire);
    const billed = actualCredits(
      usage.inputTokens,
      usage.outputTokens,
      'gpt-5.4',
      usage.cacheCreationTokens,
      usage.cacheReadTokens,
      '5m',
    );
    // Correct: 200×0.25 (non-cached input) + 50×1.5 (output) + 800×0.025 (cache-read) = 50 + 75 + 20 = 145
    expect(billed).toBe(145);
    // The double-bill bug would compute input from the FULL prompt_tokens (1000) and ALSO charge
    // cacheRead on 800 → 1000×0.25 + 50×1.5 + 800×0.025 = 250 + 75 + 20 = 345. Must NOT happen.
    expect(billed).not.toBe(345);
  });

  it('handles a stream with NO cached tokens (cached_tokens absent → 0)', async () => {
    const noCacheWire = [
      'data: {"choices":[{"delta":{"content":"Hi"}}]}',
      '',
      'data: {"choices":[],"usage":{"prompt_tokens":500,"completion_tokens":10}}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    const { text, usage } = await pumpAll(new OpenAIAdapter(), noCacheWire);
    expect(text).toBe('Hi');
    expect(usage.inputTokens).toBe(500);
    expect(usage.cacheReadTokens).toBe(0);
    expect(usage.cacheCreationTokens).toBe(0);
    expect(usage.outputTokens).toBe(10);
  });
});

describe('W44 getAdapter — provider routing off RATES[model].provider (no prefix-sniffing)', () => {
  it('routes OpenAI models to the openai provider adapter', () => {
    expect(getAdapter('gpt-5.4').provider).toBe('openai');
    expect(getAdapter('gpt-5.4-mini').provider).toBe('openai');
    expect(getAdapter('gpt-5.5').provider).toBe('openai');
  });

  it('routes Claude models to the anthropic provider adapter', () => {
    expect(getAdapter('claude-haiku-4-5-20251001').provider).toBe('anthropic');
    expect(getAdapter('claude-sonnet-4-6').provider).toBe('anthropic');
    expect(getAdapter('claude-opus-4-8').provider).toBe('anthropic');
  });
});
