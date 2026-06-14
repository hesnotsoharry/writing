---
project: writing
updated: 2026-06-14
---

## Current state
- Branch: wave-40-byok-phase-1  · Latest commit: 9c2e2c4  · Tag: v0.8.0 (pre-merge)
- Active wave: [wave-40-byok-phase-1](wave-40-byok-phase-1.md) — Code-complete, gates green, CDP smoke PASS (live-stream check pending)

## Next 3 steps
1. Cole: paste real Anthropic key in running dev build, send a prompt, confirm token streaming + UTF-8 output.
2. Cole: merge wave-40-byok-phase-1 → master, bump version in 4 files (package.json, Cargo.toml, Cargo.lock, tauri.conf.json), then `.\publish.ps1`.
3. Decide: `roadmap/follow-ups/2026-06-14-ai-license-key-entry-ui.md` — managed subscription aiLicenseKey has no entry UI; product call needed (is it the AI key or a separate entry?).

## Active work
- Wave 40 BYOK Phase 1: **shipped to branch**, awaiting Cole's live-key check + master merge + release publish.
- What BYOK does: user pastes own Anthropic key in Settings → routes DIRECT to api.anthropic.com from Rust (key never touches writersnook servers) → key stored in Windows Credential Manager → managed meter hidden, BYOK badge shown.
- Smoke coverage: Settings row + Coming-soon stub ✓; badge + hidden meter + cost-cue suppression ✓; key set/clear ✓; 401 → sanitized error (no key leak) ✓; BYOK↔managed transition ✓.
- Open follow-ups: 1 new (managed key entry UI — W40-filed), plus pre-existing Phase-D webhook RPC-error blocker.
- Deferred to Phase 2: custom-endpoint/other-providers (stubbed), Sonnet/Opus model picker, macOS Keychain.

## Reference index
- Wave 40 file: [wave-40-byok-phase-1.md](wave-40-byok-phase-1.md) + research: [wave-40-byok-phase-1-research.md](wave-40-byok-phase-1-research.md)
- Durable decisions (NEW): [0002-byok-routing-direct-to-anthropic-from-rust.md](decisions/0002-byok-routing-direct-to-anthropic-from-rust.md) · [0003-key-storage-keyring-crate-v4-key-stays-in-rust.md](decisions/0003-key-storage-keyring-crate-v4-key-stays-in-rust.md)
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) — keyring (NEW), tauri (Channel/serde/CDP), anthropic (direct streaming)
- Prior context: Wave 37 (AI harness, live proxy), Wave 36 (launch monetization); Phase-D runbook: [marketing/LAUNCH-AI-SUBSCRIPTION.md](../marketing/LAUNCH-AI-SUBSCRIPTION.md)
