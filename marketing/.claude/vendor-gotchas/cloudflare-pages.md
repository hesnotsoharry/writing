# Cloudflare Pages — vendor gotchas

> lastVerified: 2026-06-10 · project: writers-nook-marketing (`marketing/wrangler.toml`,
> `pages_build_output_dir = "public"`, custom domain `writersnook.app`)

> **CORRECTION (2026-06-13):** The DEPLOYED Cloudflare Pages project is named **`writing`**, not
> `writers-nook-marketing`. The `name = "writers-nook-marketing"` in `marketing/wrangler.toml` is
> stale and does not match the deployed project. Per HANDOFF.md (2026-06-12): the live site,
> live secrets (`LS_SUB_VARIANT_ID`, etc.), and the correct `--project-name` for `wrangler pages
> secret put` are all on project **`writing`**. Do not use `writers-nook-marketing` as a target
> for any dashboard action or CLI command involving the deployed site.

## Push to master IS the production deploy

The Pages project is **git-connected** to `github.com/hesnotsoharry/writing` (master). Every push to
master auto-builds and deploys `marketing/public/` to writersnook.app — including pushes whose diff
is "just docs" (deploy runs regardless; harmless but visible in the dashboard deploy list).
Consequence: there is no staging step on master. Anything committed under `marketing/public/` goes
live within ~a minute of push. (Observed 2026-06-10: two pushes, two auto-deploys, verified live.)

## `npm run deploy` (wrangler direct upload) fails in agent sessions

`wrangler pages deploy` in a non-interactive shell exits with: "In a non-interactive environment,
it's necessary to set a CLOUDFLARE_API_TOKEN environment variable." No cached OAuth is available to
agent sessions. Don't burn cycles on it — push to master instead (see above). If a direct upload is
ever genuinely needed, Cole runs it interactively (`! cd marketing && npm run deploy`) or sets
`CLOUDFLARE_API_TOKEN` (Pages:Edit scope).

## Web Analytics: one-click enable, custom-domain CORS trap

- Preferred setup (verified against CF docs 2026-06-10): dashboard → Pages project → **Metrics** →
  **Enable Web Analytics**. Auto-injects the beacon on next deploy; no code change.
- Manual fallback: every page in `public/` already carries a commented-out beacon snippet
  (`TODO(cole)` marker). If using it, the Web Analytics site MUST be registered under
  **`writersnook.app`**, not `*.pages.dev` — hostname mismatch causes CORS errors (documented in CF
  Web Analytics FAQ).

## Asset-generation pattern (not CF-specific, lives here for discoverability)

`public/og-card.html` (1200×630 social card) and `public/favicon-source.html` (128×128 favicon
tile) are screenshot sources, regenerated via headless Edge:
`msedge --headless --hide-scrollbars --window-size=W,H --screenshot=<out.png> file:///<source.html>`
(add `--default-background-color=00000000` for transparency, e.g. favicon rounded corners). Both
ship in `public/` with `noindex` — harmless. Re-screenshot after editing either source.

## WebView2 (Tauri) makes CORS preflight requests to Pages Functions

Source: wave-34-ai-assistant-foundation, commit 264c564

**Gotcha:** Pages Functions endpoints accessed from a Tauri WebView2 client receive CORS preflight
(OPTIONS) requests. If the endpoint does not respond with the correct CORS headers, the browser
(WebView2) blocks the actual request (POST/GET) with a CORS error. This surprised the team because
direct curl or browser requests work fine; the CORS wall only appears when a Tauri app makes the call.

**Workaround:** add CORS headers to the Pages Function response. At a minimum, return:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```
For preflight (OPTIONS), respond with 204 + these headers. For actual requests (POST), include the
same headers in the response. The Pages Functions pattern (handler exports, middleware) allows a
centralized CORS middleware or per-endpoint headers.

**Why:** WebView2 enforces the same CORS policy as a desktop browser (for security). The desktop app
has a different origin (tauri://) from the hosted Pages Functions endpoint, triggering the preflight
check. curl bypasses CORS (it is not a browser); direct browser requests may be on the same origin
or exempt (data: URIs, extensions, localhost).
