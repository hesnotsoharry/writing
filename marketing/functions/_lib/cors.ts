/**
 * CORS helpers for the AI proxy endpoints.
 *
 * Origin allowlist: Vite dev server (http://localhost:1420) and packaged
 * Tauri WebView2 origins (http/https://tauri.localhost).
 *
 * Non-matching or absent Origin → no CORS headers returned.  The request is
 * still served because the bearer token is the auth boundary, not CORS.
 */

export const ALLOWED_ORIGINS = [
  "http://localhost:1420",
  "http://tauri.localhost",
  "https://tauri.localhost",
] as const;

/**
 * Returns CORS response headers for a matched origin, or an empty object when
 * the request origin is absent or not in the allowlist.
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  if (!origin || !(ALLOWED_ORIGINS as readonly string[]).includes(origin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
  };
}

/**
 * Handle a CORS preflight (OPTIONS) request.
 * Returns 204 with full preflight headers for allowed origins,
 * or 204 with no CORS headers for unrecognized / absent origins.
 */
export function handleOptions(request: Request): Response {
  const origin = request.headers.get("Origin");
  if (!origin || !(ALLOWED_ORIGINS as readonly string[]).includes(origin)) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    },
  });
}
