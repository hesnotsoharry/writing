import type { ErrorKind } from "../../shared/licenseErrors";

const ACTIVATE_URL = "https://api.lemonsqueezy.com/v1/licenses/activate";
const WRITERSNOOK_VARIANTS = new Set([1_773_908, 1_748_920]);

export type MobileActivationResult =
  | { ok: true; instanceId: string; activationLimit: number; activationUsage: number }
  | { ok: false; kind: Exclude<ErrorKind, "format_error">; message: string };

interface ActivationBody {
  activated: boolean;
  error: string | null;
  instanceId: string | null;
  activationLimit: number;
  activationUsage: number;
  variantId: number | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parseActivationBody(value: unknown): ActivationBody | null {
  const body = record(value);
  if (!body || typeof body["activated"] !== "boolean") return null;
  const instance = record(body["instance"]); const license = record(body["license_key"]);
  const meta = record(body["meta"]); const error = body["error"];
  return {
    activated: body["activated"], error: typeof error === "string" ? error : null,
    instanceId: typeof instance?.["id"] === "string" ? instance["id"] : null,
    activationLimit: numberOr(license?.["activation_limit"], 0),
    activationUsage: numberOr(license?.["activation_usage"], 0),
    variantId: typeof meta?.["variant_id"] === "number" ? meta["variant_id"] : null,
  };
}

function classify(body: ActivationBody, status: number): MobileActivationResult {
  if (body.activated && !WRITERSNOOK_VARIANTS.has(body.variantId ?? -1)) {
    return { ok: false, kind: "rejected", message: "This license key is not for WritersNook." };
  }
  if (body.activated && body.instanceId) return { ok: true, instanceId: body.instanceId,
    activationLimit: body.activationLimit, activationUsage: body.activationUsage };
  if (status === 404) return { ok: false, kind: "invalid_key", message: body.error ?? "License key not found." };
  return { ok: false, kind: "rejected", message: body.error ?? "License key was rejected by the license server." };
}

export async function activateMobileLicense(
  licenseKey: string,
  fetcher: typeof fetch = fetch,
): Promise<MobileActivationResult> {
  try {
    const form = new URLSearchParams({ license_key: licenseKey, instance_name: "WritersNook mobile" });
    const response = await fetcher(ACTIVATE_URL, { method: "POST", headers: {
      Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded",
    }, body: form.toString() });
    const body = parseActivationBody(await response.json());
    if (!body) return { ok: false, kind: "rejected", message: "Unexpected response from the license server — please try again." };
    return classify(body, response.status);
  } catch { return { ok: false, kind: "network", message: "Could not reach the license server. Check your internet connection." }; }
}
