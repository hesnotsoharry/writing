/**
 * formatLicenseKeyInput — formats raw input (typically pasted) into the canonical
 * UUID format: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 *
 * Strips all non-hex characters, caps at 32 hex digits, and re-inserts hyphens at
 * the standard UUID group boundaries (8-4-4-4-12).
 *
 * Handles messy pasted input: whitespace, extra hyphens, newlines, etc. are all
 * normalized to the canonical form.
 *
 * Examples:
 * - "" → ""
 * - "38b1460a" → "38b1460a"
 * - "38b1460a5104" → "38b1460a-5104"
 * - "38b1460a-5104-4067-a91d-77b872934d51" → "38b1460a-5104-4067-a91d-77b872934d51"
 * - "38b1460a 5104 4067 a91d 77b872934d51" → "38b1460a-5104-4067-a91d-77b872934d51"
 */
export function formatLicenseKeyInput(raw: string): string {
  // Strip all characters except 0-9, a-f, A-F
  const hexOnly = raw.replace(/[^0-9a-fA-F]/g, "");

  // Cap at 32 hex chars (full UUID without hyphens)
  const capped = hexOnly.slice(0, 32);

  // Re-insert hyphens at canonical UUID boundaries (8-4-4-4-12)
  const formatted = capped
    .slice(0, 8)
    .concat(capped.length > 8 ? "-" + capped.slice(8, 12) : "")
    .concat(capped.length > 12 ? "-" + capped.slice(12, 16) : "")
    .concat(capped.length > 16 ? "-" + capped.slice(16, 20) : "")
    .concat(capped.length > 20 ? "-" + capped.slice(20, 32) : "");

  return formatted;
}

/**
 * isLicenseKeyShaped — validates that a string matches the UUID format used by
 * Lemon Squeezy license keys: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 *
 * Accepts uppercase and lowercase hex characters.
 */
export function isLicenseKeyShaped(value: string): boolean {
  const uuidPattern =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return uuidPattern.test(value);
}
