---
project: writing
updated: 2026-07-02
---

## Current state
- Branch: master · Latest commit: 5bd7d99 (W55 P6) · Tag: v0.12.5 (W54 — W55 is not a release)
- Active wave: none · Status: between waves (W55 COMPLETE)
- **W55 "macOS-prep (Windows-side)" COMPLETE** — 6 commits on master (c2baeb2 P1 → 5bd7d99 P6).
  Every macOS-port item NOT needing the physical Mac is done, so the one Mac day is pure execution against roadmap/coordination/mac-day-runbook.md. All changes are INERT on Windows (2-polarity inertness test).
  - P1: platform detection (tauri-plugin-os + isMac()).
  - P2: native traffic lights via auto-merged tauri.macos.conf.json (Windows byte-identical) + WKWebView -webkit-backdrop-filter compat.
  - P3: manifest contract documented in publish.ps1 (comment-only).
  - P4: new publish-mac.sh (Apple Silicon build+notarize+manifest-merge, fixture-tested on Windows via --manifest-only).
  - P5: bundle.macOS config + mac-day runbook + 2 GLM research reports → research/.
  - P6: inertness test + wave close.
  - Not a release: no version bump. Ships inertly in the NEXT Windows release whenever Cole runs publish.ps1; latest tag stays v0.12.5 (W54).
  - Impl routed to GLM-5.2 workers (Cole's standing routing); Opus orchestrated gates/adjudication/commits. 2 GLM adversarial reviews (P4 pipeline + P1/P2 code) both FLAG→addressed, no BLOCK.
- Gates at wrap: eslint 0, tsc 0, cargo check green, vitest 1835 pass — only the 6 pre-existing W46 eval-harness failures (scorer.test.ts, eval-runner.test.ts) remain, untouched, NOT regressions.

## Next 3 steps
1. **THE MAC DAY** (when Cole has the Mac): execute roadmap/coordination/mac-day-runbook.md end-to-end —
   toolchain, Developer ID cert, env block, publish.ps1 on Windows FIRST then publish-mac.sh on the Mac, tune trafficLightPosition + the 78px .tb-left reserve, manual smoke (no CDP-9222 on macOS).
2. Next Windows release: W55 rides along inertly in whatever publish.ps1 run Cole does next (no dedicated release needed).
3. W46 eval-harness continues on its own thread (6 failing scorer/eval-runner tests are in-progress W46 rig work, not regressions).

## Active work
- No app wave in flight (W55 complete).
- W55 follow-up candidates (roadmap/wave-55-macos-prep.md — all future/conditional, none block):
  - GitHub Actions release matrix (make the Mac build one-time).
  - Marketing Mac download button (blocked until a real .dmg exists).
  - Universal binary (only if an Intel-Mac user appears).
  - Mac updater mid-window UX + WKWebView agent-smoke alternative (extends the existing 2026-06-15 smoke-harness follow-up).
- Open follow-ups: 4 carried forward (none touched by W55) · [inbox](follow-ups/)
  - Top priority: assistant-entity-strip-staleness (stale entity refs in About-section AI context).
  - Backlog: w39-phase4-smoke (acceptance gate), agent-driven-smoke-harness (smoke config + CDP orchestration), turnstile-captcha (Cloudflare hardening).
- Working tree clean (W55 fully committed). Note: pushing master auto-deploys marketing/public/ to writersnook.app via Cloudflare Pages — W55 touched no marketing files, so its push is a benign no-op rebuild.

## Reference index
- [roadmap/wave-55-macos-prep.md](wave-55-macos-prep.md) — locked decisions (aarch64-only ship target, platform-config auto-merge) + follow-up candidates + Result.
- [roadmap/coordination/mac-day-runbook.md](coordination/mac-day-runbook.md) — THE Mac-day execution script.
- [research/2026-07-02-macos-port-audit.md](../research/2026-07-02-macos-port-audit.md) + [-requirements.md](../research/2026-07-02-macos-port-requirements.md) — GLM portability audit + Tauri-2-on-macOS checklist.
- [.claude/vendor-gotchas/tauri.md](../.claude/vendor-gotchas/tauri.md) — +5 macOS entries (platform-config auto-merge, native traffic lights, updater TargetsNotFound, keyring-on-macOS, bundle.category placement).
- [CLAUDE.md](../CLAUDE.md) Commands — publish.ps1 + publish-mac.sh manifest contract.
- [decisions/](decisions/) — durable ADRs; [decisions/RECENT.md](decisions/RECENT.md) — newest-10 digest.
- Shared DB + smoke oracle: dev + installed both read/write %APPDATA%\com.coles.writing\writing.db (real manuscripts + license). Smoke via CDP port 9222 + tauri-devtools MCP (ProseMirror not jsdom-testable). Do NOT run publish.ps1 from agent context; do NOT send live AI requests during smoke.
