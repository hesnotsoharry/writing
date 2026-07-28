---
project: writing
updated: 2026-07-28
---

## Current state
- Branch: master · Latest commit: 5e5097b (mac webview dialog fix) · Last tag: v0.12.6 · working version 0.12.7
- **v0.12.6 shipped on BOTH platforms.** Windows released via publish.ps1. macOS = FIRST Mac release ever: signed + notarized + stapled, on GitHub release v0.12.6 with merged latest.json (windows-x86_64 + darwin-aarch64 keys), .dmg on R2 (downloads.writersnook.app, stable + versioned keys). Cole field-verified download + install on a real Mac.
- Marketing site LIVE with the Mac launch (commit fed1514): platform-aware download CTAs (detectMac/wirePlatformDl), Apple-silicon disclosure on all 4 download surfaces, Windows flow regression-clean. Fathom click-event tracking added since (6aff66e).
- First Mac day executed via roadmap/coordination/mac-day-runbook.md on a RENTAL Mac. Four traps permanently absorbed into runbook + scripts:
  1. tmux mandatory for the notarization wait (first-submission new-account scan = hours).
  2. CI=true required for DMG bundling over SSH (bundle_dmg.sh Finder AppleScript).
  3. Updater key loaded as file CONTENTS not path + new 5-sec signer-sign pre-flight (runbook §3).
  4. wrangler 4 defaults r2 put to LOCAL — publish-mac.sh now pins wrangler@4 --remote; publish.ps1 carries a version-trap comment (marketing pins wrangler ^3, remote-default).
- Developer ID cert PRIVATE KEY rescued off the rental before expiry: .p12 at %USERPROFILE%\.tauri\writersnook-devid.p12 (password in Cole's password manager; email backup). Runbook §8 documents export + restore — future Mac days skip the cert ceremony entirely. Rental now disposable.
- Gates last seen green: eslint 0, tsc 0, cargo check green, vitest 1835 pass — only the 6 pre-existing eval-harness failures remain (in-progress rig work under `eval/`, NOT regressions).
- macOS smoke note: no CDP-9222 on macOS (WebView2 debug port is Windows-only) — Mac verification stays manual click-through.
- Pushing master auto-deploys marketing/public/ to writersnook.app via Cloudflare Pages.

## What's next
- **CI release pipeline on GitHub Actions** (macOS runner + `tauri-apps/tauri-action`) to retire Mac rentals. Needs GH secrets: Developer ID .p12 (`%USERPROFILE%\.tauri\writersnook-devid.p12`) + password, updater key + password, `APPLE_ID`/`APPLE_PASSWORD` (app-specific)/`APPLE_TEAM_ID`, `CLOUDFLARE_API_TOKEN`; keychain import per runbook §8. Must preserve the two-publish `latest.json` upsert contract and the R2 `--remote` flag. Target `aarch64-apple-darwin` (universal/Intel only if demand appears). Private-repo macOS minutes bill 10× — still far cheaper than rentals. Natural home later for the iOS lane (Apple Distribution cert, same account).
- **W51 (AI cost-display)** still HELD on worktree `writing-wave-51`, ready to merge when picked up — verify against current master before carrying forward.
- **Trial-abuse gating has never been smoked live.** Global $25/day cap + per-IP grant cap + exhaustion guard are unit-verified only (55 worker tests) while `TRIAL_AI_ENABLED=true` is in production spending real money. Cole-owned manual oracle: mint a trial key, watch the footer meter, spend to zero → `ExhaustedAllowanceGuard` renders and editor/binder stay usable; then probe the worker directly for `403 trial_disabled`, `429 trial_ip_capped`, `429 trial_budget_exhausted`.
- **No CAPTCHA on `/api/ai/trial-session`.** The global cap bounds dollars but not budget monopoly — a Sybil/VM attacker can drain the day's $25 and starve real trial users during a traffic spike. Turnstile needs a WebView2 rendering spike first (system-browser deep-link fallback if it won't render), then worker-side verify + Pages config.
- **Assistant context-strip staleness** (`src/features/ai/AssistantPanel.tsx:355`): `entityRefreshKey` only bumps on the in-panel exclusion toggle, so adding an entity in the Story Bible while the panel is open leaves the chip strip stale — the entity IS sent (assembleContext re-fetches at send time), just not displayed. Needs an entity-mutation signal from the story-bible store.
- **navigator.platform deprecation** in site.js `detectMac()`: functional everywhere, only Safari-viable option; UA-CH-only swap someday (minor, no urgency).

## Reference index
- [roadmap/coordination/mac-day-runbook.md](coordination/mac-day-runbook.md) — Mac-day execution script (field-proven, +§8 cert export/restore).
- [roadmap/wave-55-macos-prep.md](wave-55-macos-prep.md) — locked decisions for the macOS port (aarch64-only, platform-config auto-merge).
- [research/2026-07-02-macos-port-audit.md](../research/2026-07-02-macos-port-audit.md) + [-requirements.md](../research/2026-07-02-macos-port-requirements.md) — portability audit + Tauri-2-on-macOS checklist.
- [.claude/known-issues.md](../.claude/known-issues.md) — verified fixes for recurring traps (CDP smoke is the only runtime oracle, etc.).
- [.claude/vendor-gotchas/tauri.md](../.claude/vendor-gotchas/tauri.md) — Tauri traps incl. macOS + wrangler --remote fix.
- [marketing/.claude/vendor-gotchas/](../marketing/.claude/vendor-gotchas/) — Cloudflare Pages / wrangler / Lemon Squeezy traps.
- [knowledge/platforms.md](../knowledge/platforms.md) — per-platform facts.
- [CLAUDE.md](../CLAUDE.md) — stack, commands, gotchas, publish.ps1 + publish-mac.sh manifest contract.
- [decisions/](../decisions/) · [decisions/RECENT.md](../decisions/RECENT.md) — durable ADRs + newest-10 digest.
- Shared DB: dev + installed read/write %APPDATA%\com.coles.writing\writing.db; smoke via CDP port 9222 + tauri-devtools MCP (ProseMirror not jsdom-testable). Do NOT run publish.ps1 from agent context.
