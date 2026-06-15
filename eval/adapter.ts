/**
 * Eval adapter bootstrap — constructs NodeSdkTransport from process.env keys
 * and returns a ProviderAdapter via createAdapter().
 *
 * Keys are read from:
 *   ANTHROPIC_API_KEY   — for claude-* models
 *   OPENAI_API_KEY      — for gpt-* models
 *   OPENROUTER_API_KEY  — for openrouter models (not in cost pilot; future use)
 *
 * Store keys in eval/.env.eval (gitignored). Load with:
 *   node --env-file=eval/.env.eval -e "import('./eval/runner.ts')"
 * or export them manually before running the eval script.
 *
 * In --dry-run mode this module is imported but bootstrapAdapter() is only
 * called if the live path is exercised — safe to import without valid keys.
 */

import { createAdapter } from "../src/features/ai/adapter/index.ts";
import { NodeSdkTransport } from "../src/features/ai/adapter/node.transport.ts";
import type { ProviderAdapter } from "../src/features/ai/adapter/types.ts";

/** Build the adapter from env keys. Keys may be empty in dry-run mode. */
export function bootstrapAdapter(): ProviderAdapter {
  const transport = new NodeSdkTransport({
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
    openaiKey: process.env.OPENAI_API_KEY ?? "",
    openrouterKey: process.env.OPENROUTER_API_KEY ?? "",
  });
  return createAdapter(transport);
}
