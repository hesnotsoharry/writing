---
class: knowledge
category: environment
lastVerified: 2026-06-21
verifyEvery: 90d
---

Environment / deploy facts for the `writing` (WritersNook) app.

## app-identifier
value: Tauri bundle identifier is `com.coles.writing`; productName is WritersNook. This identifier drives the per-user data directory.
lastVerified: 2026-06-21
evidence: identifier field in src-tauri/tauri.conf.json
assert: grep:com.coles.writing:src-tauri/tauri.conf.json

## shared-db
value: Dev AND installed builds share ONE database at %APPDATA%\com.coles.writing\writing.db (real manuscripts + the license row). Use the DB-swap smoke protocol; never edit it live.
lastVerified: 2026-06-21
evidence: bundle identifier com.coles.writing (src-tauri/tauri.conf.json) determines the %APPDATA% path
assert: grep:com.coles.writing:src-tauri/tauri.conf.json

## release-pipeline
value: `.\publish.ps1` builds a signed NSIS bundle → latest.json updater manifest → GitHub release. Interactive (prompts for the updater-key password) — Cole runs it, agents don't. Bump the version in package.json + src-tauri/{Cargo.toml,Cargo.lock,tauri.conf.json} and tag vX.Y.Z first. Artifact selection is version-anchored — do not weaken it to a bare glob.
lastVerified: 2026-06-21
evidence: publish.ps1 at repo root
assert: file-exists:publish.ps1

## marketing-deploy
value: Pushing master auto-deploys the marketing site — Cloudflare Pages is git-connected to this repo and ships marketing/public/ to writersnook.app on every push. `npm run deploy` (direct wrangler) fails in agent sessions (interactive auth); push IS the deploy pipeline. Marketing-only changes still trigger a deploy.
lastVerified: 2026-06-21
evidence: marketing/ tree present in repo; documented in repo CLAUDE.md "Pushing master deploys the live marketing site"
