# Cloudflare Pages — vendor gotchas

> lastVerified: 2026-06-10 · project: writers-nook-marketing (`marketing/wrangler.toml`,
> `pages_build_output_dir = "public"`, custom domain `writersnook.app`)

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
