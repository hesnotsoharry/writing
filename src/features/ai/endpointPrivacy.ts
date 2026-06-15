// Honest, per-endpoint privacy copy for the endpoint add/edit form (Wave 45 Phase 3).
//
// We control the honesty of our framing; the user controls where their data goes.
// A loopback endpoint keeps text on the machine; a remote endpoint sends text to a
// server the user configured (we never see it). This classifies a typed URL for
// COPY purposes only — the authoritative security gate is the Rust `validate_endpoint`
// command fired on save (Phase 2). Client-side loopback detection here just chooses
// which honest line to show as the user types.

export type EndpointPrivacyKind = "local" | "remote" | "unknown";

export type EndpointPrivacy = { kind: EndpointPrivacyKind; message: string };

function isLoopback(hostname: string): boolean {
  // URL constructor brackets IPv6: "[::1]" → strip before comparing
  const host = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
  if (host === "localhost" || host === "::1") return true;
  // 127.0.0.0/8: dotted-quad with first octet === 127. Require all four parts to
  // be numeric — a domain like "127.internal.corp.com" is remote, not loopback,
  // and must NOT be shown the "stays on your machine" copy (egress under-statement).
  const parts = host.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p)) && parts[0] === "127") {
    return true;
  }
  return false;
}

/**
 * Classify a typed endpoint URL for privacy-copy purposes:
 * - loopback host (localhost / 127.0.0.0/8 / ::1) → kind "local", "stays on your machine" copy
 * - any other parseable host → kind "remote", "sent to a server you control" copy
 * - empty / unparseable → kind "unknown", a neutral prompt
 */
export function endpointPrivacyCopy(url: string): EndpointPrivacy {
  if (!url.trim()) {
    return { kind: "unknown", message: "Enter your endpoint's address." };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "unknown", message: "Enter your endpoint's address." };
  }
  if (isLoopback(parsed.hostname)) {
    return {
      kind: "local",
      message: "Your text stays on your machine — nothing leaves this device.",
    };
  }
  return {
    kind: "remote",
    message: `Your text will be sent to ${parsed.hostname} — a server you control. We never see it.`,
  };
}
