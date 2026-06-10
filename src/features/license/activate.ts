/**
 * activateLicense — frontend wrapper for the Rust `activate_license` command.
 *
 * Decision D2: HTTP is done Rust-side via reqwest (never from the webview).
 * Decision D3: LS response shapes — activated/error/httpStatus/instanceId/...
 */
import { invoke } from "@tauri-apps/api/core";

// ─── Rust command output shape (camelCase from #[serde(rename_all = "camelCase")]) ──

interface LsCommandResult {
  activated: boolean;
  error: string | null;
  httpStatus: number;
  instanceId: string | null;
  activationLimit: number | null;
  activationUsage: number | null;
  licenseStatus: string | null;
}

// ─── Public result union ───────────────────────────────────────────────────

export type ActivationResult =
  | {
      ok: true;
      instanceId: string;
      activationLimit: number;
      activationUsage: number;
    }
  | { ok: false; kind: "invalid_key"; message: string }
  | { ok: false; kind: "rejected"; message: string }
  | { ok: false; kind: "network"; message: string };

// ─── Wrapper ───────────────────────────────────────────────────────────────

/**
 * Map an activated Rust result to an ActivationResult.
 * Extracted to keep activateLicense within the 40-line function limit.
 * Guards against a null/empty instanceId that should never occur on a true
 * activated response — returns rejected rather than fabricating a blank id.
 */
function mapActivated(r: LsCommandResult): ActivationResult {
  if (!r.instanceId) {
    return {
      ok: false,
      kind: "rejected",
      message: "Unexpected response from the license server — please try again.",
    };
  }
  return {
    ok: true,
    instanceId: r.instanceId,
    activationLimit: r.activationLimit ?? 0,
    activationUsage: r.activationUsage ?? 0,
  };
}

/**
 * Activate a Lemon Squeezy license key.
 *
 * - Ok result → activated successfully; carries instanceId + usage counters.
 * - invalid_key → HTTP 404 (key not found in LS); show a friendly "check your
 *   key" message, using the verbatim LS error as the technical detail.
 * - rejected → 400/422/other LS business error (limit reached, disabled, …);
 *   surface the verbatim LS error string.
 * - network → invoke threw (DNS, offline, timeout); show a distinct
 *   "couldn't reach the license server" message.
 */
export async function activateLicense(
  licenseKey: string,
): Promise<ActivationResult> {
  try {
    const result = await invoke<LsCommandResult>("activate_license", {
      licenseKey,
    });

    if (result.activated) return mapActivated(result);

    if (result.httpStatus === 404) {
      return {
        ok: false,
        kind: "invalid_key",
        message: result.error ?? "License key not found.",
      };
    }

    return {
      ok: false,
      kind: "rejected",
      message: result.error ?? "License key was rejected by the license server.",
    };
  } catch (e) {
    return {
      ok: false,
      kind: "network",
      message:
        typeof e === "string"
          ? e
          : "Could not reach the license server. Check your internet connection.",
    };
  }
}
