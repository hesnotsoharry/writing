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
lastVerified: 2026-07-10
evidence: marketing/ tree present in repo; documented in repo CLAUDE.md "Pushing master deploys the live marketing site"

## authenticode-signing
value: publish.ps1 signs via signtool + Microsoft.Trusted.Signing.Client dlib (assets in ~/.artifact-signing/ — dlib under client\bin\x64\, metadata.json → endpoint https://eus.codesigning.azure.net, account `writersnook`, profile `writersnook-pub`). Auth = AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET User-scope env vars (app registration `writersnook-signer`, role "Artifact Signing Certificate Profile Signer"); agent shells don't inherit fresh User-scope vars — load via [Environment]::GetEnvironmentVariable($v,'User'). Two 403 traps: the service 403s (not 404s) on WRONG account/profile NAMES (anti-enumeration), and the Azure-portal IAM picker once resolved writersnook-signer to a stale duplicate service principal — on 403, pull ground truth via az CLI (`az ad sp show --id <client-id>`, compare objectId against `az role assignment list`), never trust portal display names. The rust wrappers (trusted-signing-cli etc.) are dead ends for subscription-less SPs. CLEANUP PENDING: rotate the client secret (exposed in a session transcript ~2026-06-10); optionally delete failed profile `writersnook-public` + the stale 9989b5e4 role assignment.
lastVerified: 2026-07-10
evidence: wired 2026-06-10 commit 930b8d6; salvaged from retired agent memory M-73 2026-07-10 — 403 gotchas observed live 2026-06-10
assert: file-exists:publish.ps1
