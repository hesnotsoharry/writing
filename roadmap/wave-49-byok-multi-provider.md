---
status: SHIPPED
created: 2026-06-14
shipped: 2026-06-15
merged_to_master: true
commits: bb03e9c..05efe17
---
# Wave 49 — OpenAI BYOK multi-provider

Result: Extended BYOK from Anthropic-only to multi-provider: a user pastes their own OpenAI key in Settings and the assistant streams direct from Rust to `api.openai.com` (key never touches WritersNook servers — W40 privacy property preserved). Five phases (commits `bb03e9c..05efe17`, 25 files +2862/−366): OpenAI BYOK walking skeleton → provider-routed engine `byok_engine.rs` (enum-dispatch `WireFormat` + shared `run_stream`, key-drop/`[DONE]`/SSRF/cached-token discipline) → Settings OpenAI key row + unified `useByokKeys` → registry-driven merged picker + `BYOK_SEND` model→provider dispatch → persistent per-provider usage readout (localStorage, tokens + est USD with cached billed at the cache-read rate). Gates: cargo 37/37 · vitest 1505/1505 · lint 0 · tsc 0. Wave-end adversarial review PASS; mechanical review PASS (dead `PROVIDER_COMMAND` removed). Managed Cloudflare path untouched.

Promoted: [decisions/0012-w49-w45-boundary-scope.md](decisions/0012-w49-w45-boundary-scope.md) · [decisions/0013-rust-provider-engine-abstraction-shape.md](decisions/0013-rust-provider-engine-abstraction-shape.md)
Vendor-gotchas: [openai.md](../.claude/vendor-gotchas/openai.md) · [keyring.md](../.claude/vendor-gotchas/keyring.md)
Follow-up filed: [follow-ups/2026-06-15-agent-driven-ui-smoke-harness.md](follow-ups/2026-06-15-agent-driven-ui-smoke-harness.md)
Research sidecar retained: [wave-49-byok-multi-provider-research.md](wave-49-byok-multi-provider-research.md)
