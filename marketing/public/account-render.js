// ============================================================================
// account-render.js — PURE mapping layer (no SDK import).
//
// renderAccount(purchaseRow, email) maps a Supabase `purchases` row (or null)
// + the signed-in email to a flat display-value object that account.js applies
// to the DOM. This is the testable seam: account.js feeds it SDK data;
// account-render.test.js exercises it in Vitest without a browser or network.
//
// Column names (from account-render.test.js ROW fixture):
//   license_key   — the license key string
//   order_id      — order ID string
//   product_name  — human product name string
//   total         — purchase total in cents as a string (e.g. "2900")
//   created_at    — ISO 8601 timestamp string (e.g. "2026-06-04T12:00:00.000000Z")
// ============================================================================

/**
 * Format a cents string to a dollar amount string.
 * "2900" → "$29.00", "0" → "$0.00", "4900" → "$49.00"
 * Uses integer arithmetic only — no floating point.
 *
 * @param {string} centsStr
 * @returns {string}
 */
export function formatPrice(centsStr) {
  const cents = parseInt(centsStr, 10) || 0;
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return "$" + dollars + "." + String(remainder).padStart(2, "0");
}

/**
 * Format an ISO 8601 timestamp to a deterministic, locale-independent
 * human date string: "Jun 4, 2026".
 * Parses the date components directly from the string so output is
 * identical on every machine and timezone.
 *
 * @param {string} isoString — e.g. "2026-06-04T12:00:00.000000Z"
 * @returns {string}         — e.g. "Jun 4, 2026"
 */
export function formatDate(isoString) {
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  // Parse YYYY-MM-DD from the leading segment — avoids any TZ conversion.
  const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoString; // fall back to the raw value if unparseable
  const year = match[1];
  const month = parseInt(match[2], 10) - 1; // 0-based index into MONTHS
  const day = parseInt(match[3], 10);
  return MONTHS[month] + " " + day + ", " + year;
}

/**
 * Map a purchases row (or null) + email to display-value object.
 *
 * @param {object|null} purchaseRow  — a Supabase purchases row, or null
 * @param {string}      email        — the signed-in user's email
 * @returns {{ email, hasPurchase, licenseKey, orderId, product, amount, purchaseDate }}
 */
export function renderAccount(purchaseRow, email) {
  if (!purchaseRow) {
    return {
      email,
      hasPurchase: false,
      licenseKey: null,
      orderId: null,
      product: null,
      amount: null,
      purchaseDate: null,
    };
  }

  return {
    email,
    hasPurchase: true,
    licenseKey: purchaseRow.license_key ?? null,
    orderId: purchaseRow.order_id ?? null,
    product: purchaseRow.product_name ?? null,
    amount: purchaseRow.total != null ? formatPrice(String(purchaseRow.total)) : null,
    purchaseDate: purchaseRow.created_at ? formatDate(purchaseRow.created_at) : null,
  };
}
