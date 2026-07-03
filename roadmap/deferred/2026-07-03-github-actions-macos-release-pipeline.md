# CI release pipeline on GitHub Actions — retire Mac-rental release days

- **Status:** OPEN (deferred — post-first-Mac-release enhancement, no wave attached)
- **Filed:** 2026-07-03, during the first Mac day (v0.12.6), at Cole's request
- **Home rationale:** `deferred/` not `follow-ups/` — scheduled future work with no present
  defect; follow-up files are wrap-team-authored and this was filed free-form.

## Problem

macOS releases currently require renting a Mac for a day (`roadmap/coordination/mac-day-runbook.md`).
The first Mac day (2026-07-02/03) worked but surfaced how fragile the manual path is — each of
these cost a debugging round-trip before the runbook absorbed it:

1. First-submission notarization from a new Apple account blocked the build 1+ hours over SSH
   (runbook §4: tmux now mandatory).
2. `bundle_dmg.sh` dies headless without `CI=true` (Finder AppleScript; runbook §4 Step 2).
3. `TAURI_SIGNING_PRIVATE_KEY` silently base64-decodes a nonexistent key PATH as key CONTENT
   (runbook §3 pre-flight added).
4. wrangler 4 "uploaded" the DMG to a local simulated bucket (`publish-mac.sh` now pins
   `wrangler@4 --remote`; recovered from Windows).

Every future release repeats rental cost + setup + babysitting, even with the runbook.

## Proposed shape

GitHub Actions macOS runner + the official `tauri-apps/tauri-action`, replacing the rental:

- **Secrets** (GitHub encrypted secrets): the Developer ID .p12 (canonical copy now at
  `%USERPROFILE%\.tauri\writersnook-devid.p12`, exported per runbook §8) + its password;
  updater key + password (same pair as `publish.ps1`); `APPLE_ID` / `APPLE_PASSWORD`
  (app-specific) / `APPLE_TEAM_ID`. Keychain import on the runner is the standard
  `security import` + `set-key-partition-list` dance already documented in runbook §8.
- **Targets:** `aarch64-apple-darwin` to match today; consider `universal-apple-darwin` to fold
  Intel-Mac support into the same .dmg (Intel demand currently unproven — decide on data).
- **Manifest contract:** must preserve the two-publish `latest.json` upsert contract
  (`publish.ps1` header; `publish-mac.sh merge_manifest` is already isolated + testable via
  `--manifest-only`) and the R2 upload (explicit `--remote`, `CLOUDFLARE_API_TOKEN` as a secret).
- **Scope option:** Windows NSIS build can move to CI in the same workflow later; Mac is the
  half that hurts (no local Mac exists).

## Cost / constraints

- Private repo → macOS Actions minutes bill at 10× multiplier; at current release cadence this is
  single-digit dollars per month — trivially cheaper than rentals.
- CI=true is implicit on Actions (DMG styling auto-skipped — same cosmetic tradeoff as today).
- Notarization from CI is the industry-standard path (notarytool + app-specific password).

## Acceptance

A tag push (or manual dispatch) produces a signed + notarized `.dmg` + updater artifacts,
upserts `darwin-aarch64` into the tag's `latest.json` without clobbering `windows-x86_64`,
uploads to R2 with `--remote`, and an installed Mac app auto-updates to it — with no rented Mac
involved. Runbook gets collapsed to "CI does this; manual path archived."
