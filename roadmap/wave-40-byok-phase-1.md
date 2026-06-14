---
status: SHIPPED
created: 2026-06-13
shipped: 2026-06-14
merged_to_master: false
commits: e946df6..9c2e2c4 (+ wrap)
---
# Wave 40: BYOK Phase 1

Result: Bring-your-own-key (Anthropic). User pastes their own key in Settings → AI assists route **direct to api.anthropic.com from Rust** (key + prose never touch writersnook servers); key lives in Windows Credential Manager via `keyring` v4 — never localStorage/SQLite/WebView; managed meter hidden + "Your key" badge in BYOK mode. Gates: cargo 19/19, vitest 1407/1407, lint/tsc 0. Wave-end adversarial review PASS. **CDP smoke PASS** (keychain set→Credential-Manager-entry / clear→gone; Settings row + Coming-soon stub; badge + hidden meter + no allowance copy; invalid key → real Anthropic 401 → sanitized "Invalid API key — check Settings", no key leak; BYOK→managed transition). **Pending Cole:** live happy-path stream (real key), merge → master, `.\publish.ps1`.

Promoted: [decisions/0002-byok-routing-direct-to-anthropic-from-rust.md](decisions/0002-byok-routing-direct-to-anthropic-from-rust.md) · [decisions/0003-key-storage-keyring-crate-v4-key-stays-in-rust.md](decisions/0003-key-storage-keyring-crate-v4-key-stays-in-rust.md)
Vendor-gotchas: [keyring](../.claude/vendor-gotchas/keyring.md) (new) · [tauri](../.claude/vendor-gotchas/tauri.md) · [anthropic](../.claude/vendor-gotchas/anthropic.md) (new)
Follow-up filed: [follow-ups/2026-06-14-ai-license-key-entry-ui.md](follow-ups/2026-06-14-ai-license-key-entry-ui.md)
Research sidecar retained: [wave-40-byok-phase-1-research.md](wave-40-byok-phase-1-research.md)
