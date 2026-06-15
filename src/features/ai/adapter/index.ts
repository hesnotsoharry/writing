/**
 * Adapter factory — transport-agnostic ProviderAdapter implementation.
 *
 * Responsibilities:
 *   - Looks up provider + baseUrl from the model registry (AdapterCallParams.modelId).
 *   - Builds WireRequest for the transport.
 *   - Normalizes WireResponse (stop-reason mapping) into AdapterResult.
 *
 * NOT responsible for:
 *   - Error normalization (transport throws ProviderAdapterError directly).
 *   - API key management (transport manages its own keys).
 *   - SDK-specific wire formats (transport owns those).
 */

import { getModel } from "../providerModels";
import type {
  AdapterCallParams,
  AdapterResult,
  ProviderAdapter,
  ProviderTransport,
  WireRequest,
  WireResponse,
} from "./types";

// ── Stop-reason normalization ─────────────────────────────────────────────────

/**
 * Maps raw provider stop-reason strings to the normalized union.
 *
 * Key rule (Amendment A3): Anthropic's pause_turn means mid-turn continuation,
 * not completion. It MUST map to "other" — never "end_turn".
 * Collapsing it would let the eval harness score truncated output as complete.
 */
function normalizeStopReason(raw: string): AdapterResult["stopReason"] {
  if (raw === "end_turn" || raw === "stop_sequence" || raw === "stop") {
    return "end_turn";
  }
  if (raw === "max_tokens" || raw === "length") return "max_tokens";
  if (raw === "refusal" || raw === "content_filter") return "content_filter";
  if (raw === "tool_use" || raw === "tool_calls") return "tool_use";
  // "other" covers: pause_turn, function_call (OAI deprecated), and future values.
  return "other";
}

// ── Wire mapping ──────────────────────────────────────────────────────────────

function wireToResult(wire: WireResponse): AdapterResult {
  return {
    text: wire.text,
    usage: {
      inputTokens: wire.inputTokens,
      outputTokens: wire.outputTokens,
      cacheReadTokens: wire.cacheReadTokens,
    },
    model: wire.model,
    stopReason: normalizeStopReason(wire.stopReason),
  };
}

function buildWireRequest(params: AdapterCallParams): WireRequest {
  const entry = getModel(params.modelId);
  if (!entry) {
    throw new Error(`Unknown modelId: "${params.modelId}" — add it to PROVIDER_MODELS`);
  }
  return {
    provider: entry.provider,
    // NodeSdkTransport uses its own constructor-provided keys; apiKey is reserved
    // for future transports that receive keys per-request. See WireRequest.apiKey doc.
    apiKey: "",
    baseUrl: entry.baseUrl,
    modelId: params.modelId,
    system: params.system,
    messages: params.messages,
    maxTokens: params.maxTokens,
    temperature: params.temperature,
    seed: params.seed,
  };
}

// ── Async runners ─────────────────────────────────────────────────────────────

async function runComplete(
  transport: ProviderTransport,
  params: AdapterCallParams,
): Promise<AdapterResult> {
  const wire = await transport.complete(buildWireRequest(params));
  return wireToResult(wire);
}

async function runStream(
  transport: ProviderTransport,
  params: AdapterCallParams,
  onToken: (text: string) => void,
  signal?: AbortSignal,
): Promise<AdapterResult> {
  const wire = await transport.stream(buildWireRequest(params), onToken, signal);
  return wireToResult(wire);
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a ProviderAdapter backed by the given transport.
 * Swap NodeSdkTransport for TauriTransport to switch environments — no other change needed.
 */
export function createAdapter(transport: ProviderTransport): ProviderAdapter {
  return {
    complete: (params) => runComplete(transport, params),
    stream: (params, onToken, signal) => runStream(transport, params, onToken, signal),
  };
}
