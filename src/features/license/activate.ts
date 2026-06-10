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

    if (result.activated) {
      return {
        ok: true,
        instanceId: result.instanceId ?? "",
        activationLimit: result.activationLimit ?? 0,
        activationUsage: result.activationUsage ?? 0,
      };
    }

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

// ─── DEV smoke hook ────────────────────────────────────────────────────────
// Exposes activateLicense on window so a CDP console session can drive the
// full Rust→LS→parse→frontend path during smoke without any UI.
// WAVE30-P4: remove
if (import.meta.env.DEV && typeof window !== "undefined") {
  (
    window as Window & {
      __wnActivateLicense?: typeof activateLicense;
    }
  ).__wnActivateLicense = activateLicense;
}
