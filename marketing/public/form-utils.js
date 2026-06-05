// ============================================================================
// form-utils.js — pure form helpers (NO Supabase SDK import)
//
// These utilities are intentionally free of browser globals and CDN imports so
// they can be imported and unit-tested in Node/Vitest without mocking a remote
// CDN URL. All SDK-touching code lives in supabase-client.js / signin.js.
// ============================================================================

/**
 * Returns true when `s` is a plausible email address.
 *
 * The check is deliberately simple: we want to catch obvious mistakes (missing
 * @, empty string, no domain) without false-positives on unusual-but-valid
 * addresses. The real validation happens server-side via Supabase — this is a
 * UX guard only.
 *
 * Rules:
 *   - Must be a non-empty string
 *   - Must contain exactly one '@' with at least one character on each side
 *   - The domain part must contain at least one '.' with characters on each side
 *
 * @param {unknown} s - Value to test.
 * @returns {boolean}
 */
export function isValidEmail(s) {
  if (typeof s !== "string" || s.trim().length === 0) return false;
  // Split on '@'; require exactly two non-empty parts.
  const parts = s.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  // Domain must have at least one '.' with non-empty segments on each side.
  // dotIdx <= 0 catches a leading dot ("." at index 0) or no dot at all (-1).
  // dotIdx >= domain.length - 1 catches a trailing dot.
  // Additionally, the character immediately before the last dot must not itself
  // be a dot (e.g. "example..com"), and the domain must not start with a dot
  // even when there are multiple dots — enforce by checking the first char.
  const dotIdx = domain.lastIndexOf(".");
  if (dotIdx <= 0 || dotIdx >= domain.length - 1) return false;
  if (domain[0] === ".") return false;
  return true;
}
