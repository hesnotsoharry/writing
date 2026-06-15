// Per-verb generation parameters for local/custom endpoints (Wave 45 Phase 3).
//
// The managed path resolves temperature/maxTokens server-side (Cloudflare Worker
// VERB_CONFIG). Local endpoints bypass that proxy, so the client must carry its
// own mirror. The *model* is whatever the user picked for the endpoint — only the
// per-verb temperature/maxTokens live here. Values mirror the server's
// marketing/functions/_lib/verb-config.ts (model field intentionally dropped).

import type { VerbKey } from "./ai.types";

export type LocalVerbParams = { temperature: number; maxTokens: number };

/** Per-verb temperature/maxTokens mirror of the server VERB_CONFIG. */
export const LOCAL_VERB_CONFIG: Record<VerbKey, LocalVerbParams> = {
  ask:       { temperature: 0.7, maxTokens: 2048 },
  brainstorm:{ temperature: 1.0, maxTokens: 2048 },
  critique:  { temperature: 1.0, maxTokens: 2048 },
  betaread:  { temperature: 0.7, maxTokens: 2048 },
  proofread: { temperature: 0.1, maxTokens: 4096 },
};

/** Return the {temperature, maxTokens} for a verb. */
export function getLocalVerbConfig(verb: VerbKey): LocalVerbParams {
  return LOCAL_VERB_CONFIG[verb];
}
