---
project: writing
updated: 2026-07-03
---

## Current state
- Branch: master · Latest commit: fed1514 (marketing Mac launch) · Tag: v0.12.6
- Active wave: none · Status: between waves (Mac launch shipped)
- **v0.12.6 shipped on BOTH platforms.** Windows released earlier via publish.ps1. macOS = FIRST Mac release ever: signed + notarized + stapled, on GitHub release v0.12.6 with merged latest.json (windows-x86_64 + darwin-aarch64 keys), .dmg on R2 (downloads.writersnook.app, stable + versioned keys). Cole field-verified download + install on a real Mac.
- Marketing site LIVE with the Mac launch (commit fed1514): platform-aware download CTAs (detectMac/wirePlatformDl), Apple-silicon disclosure on all 4 download surfaces (GLM adversarial FLAG on Intel-Mac disclosure gap — fixed by GLM implementer), Windows flow regression-clean.
- First Mac day executed via roadmap/coordination/mac-day-runbook.md on a RENTAL Mac. Four traps permanently absorbed into runbook + scripts:
  1. tmux mandatory for the notarization wait (first-submission new-account scan = hours).
  2. CI=true required for DMG bundling over SSH (bundle_dmg.sh Finder AppleScript).
  3. Updater key loaded as file CONTENTS not path + new 5-sec signer-sign pre-flight (runbook §3).
  4. wrangler 4 defaults r2 put to LOCAL — publish-mac.sh now pins wrangler@4 --remote; publish.ps1 carries a version-trap comment (marketing pins wrangler ^3, remote-default).
- Developer ID cert PRIVATE KEY rescued off the rental before expiry: .p12 at %USERPROFILE%\.tauri\writersnook-devid.p12 (password in Cole's password manager; email backup). Runbook §8 documents export + restore — future Mac days skip §2a cert ceremony entirely. Rental now disposable.
- Net effect: runbook + scripts + rescued .p12 make the next Mac day disposable-hardware and ceremony-free — no rental-time lost to re-discovery.

## Next 3 steps
1. **CI release pipeline** (tauri-action + GH secrets) to retire Mac rentals: [roadmap/deferred/2026-07-03-github-actions-macos-release-pipeline.md](deferred/2026-07-03-github-actions-macos-release-pipeline.md). Also the natural home for a universal-binary (Intel) build if user demand appears, and later the iOS lane (different cert type — Apple Distribution + provisioning profile, same Apple account).
2. **W51 (AI cost-display)** still HELD on worktree writing-wave-51, ready to merge when picked up — pre-existing state, verify against current HANDOFF before carrying forward.
3. **navigator.platform deprecation** in site.js detectMac(): functional everywhere, only Safari-viable option; future UA-CH-only swap noted in GLM implementer report (minor, no urgency).

## Active work
- No app wave in flight (Mac launch shipped). Gates last seen green: eslint 0, tsc 0, cargo check green, vitest 1835 pass — only the 6 pre-existing W46 eval-harness failures remain (untouched, NOT regressions).
- W46 eval-harness continues on its own thread: those 6 failing scorer/eval-runner tests are in-progress rig work.
- Open follow-ups: 4 carried forward · [inbox](follow-ups/) — top item: assistant-entity-strip-staleness (stale entity refs in About-section AI context).
- macOS smoke note: no CDP-9222 on macOS (WebView2 debug port is Windows-only) — Mac verification stays manual click-through.
- Standing GLM routing (per glm-dispatch.md) used for review + implementer today, worked well (one Z.ai overload night 07-02, fine by morning).
- Working tree clean — all 7 key commits pushed to master: ade1ba0, 5f0b64b, 72806c7, 917d192, a4a223d, 8250500, fed1514.
- Pushing master auto-deploys marketing/public/ to writersnook.app via Cloudflare Pages (fed1514 was the live Mac-launch deploy).

## Reference index
- [roadmap/coordination/mac-day-runbook.md](coordination/mac-day-runbook.md) — Mac-day execution script (now field-proven, +§8 cert export/restore).
- [roadmap/wave-55-macos-prep.md](wave-55-macos-prep.md) — locked decisions for the macOS port (aarch64-only, platform-config auto-merge).
- [roadmap/deferred/2026-07-03-github-actions-macos-release-pipeline.md](deferred/2026-07-03-github-actions-macos-release-pipeline.md) — next: CI release matrix.
- [research/2026-07-02-macos-port-audit.md](../research/2026-07-02-macos-port-audit.md) + [-requirements.md](../research/2026-07-02-macos-port-requirements.md) — GLM portability audit + Tauri-2-on-macOS checklist.
- [.claude/vendor-gotchas/tauri.md](../.claude/vendor-gotchas/tauri.md) — macOS entries incl. wrangler --remote fix.
- [marketing/.claude/vendor-gotchas/](../marketing/.claude/vendor-gotchas/) — Cloudflare Pages / wrangler / Lemon Squeezy traps.
- [knowledge/platforms.md](../knowledge/platforms.md) — per-platform facts (write-time freshness-gated).
- [CLAUDE.md](../CLAUDE.md) — publish.ps1 + publish-mac.sh manifest contract.
- [decisions/](../decisions/) · [decisions/RECENT.md](../decisions/RECENT.md) — durable ADRs + newest-10 digest (root-level home per M-64).
- [.claude/baseline-ledger.md](../.claude/baseline-ledger.md) — conformance-to-baseline metrics snapshot.
- Shared DB + smoke oracle: dev + installed read/write %APPDATA%\com.coles.writing\writing.db; smoke via CDP port 9222 + tauri-devtools MCP (ProseMirror not jsdom-testable). Do NOT run publish.ps1 from agent context.
