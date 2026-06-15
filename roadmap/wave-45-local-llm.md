---
status: SHIPPED
created: 2026-06-14
shipped: 2026-06-15
merged_to_master: true
---
# Wave 45 — local-LLM / custom OpenAI-compatible endpoint

Result: All 5 phases complete. Phases 1–3 (Rust `validate_endpoint` + `discover_models` commands, saved-endpoint manager UI with localStorage persistence + per-endpoint keychain under `local-endpoint/*` namespace, smart per-endpoint consent copy + per-verb client config) built W49-independent; Phases 4–5 built post-W49 integration (rebase onto `d40a156`), wiring local through `byok_engine.rs` via new `byok_local.rs` and appending a `'local'` group to `PROVIDER_REGISTRY`. Wave-end gates: lint PASS · tsc PASS · vitest 1590/1590. Live CDP smoke confirmed all W45 surfaces (endpoint manager CRUD, picker LOCAL group, free-path gating, friendly compose error through the real Rust engine). ADR renumber: four W40/49 decision files renumbered 0010–0013 to resolve collision with the original wave-4 sequence; all citations updated.

Vendor-gotchas: [ollama](../.claude/vendor-gotchas/ollama.md) (new)
Research sidecar retained: [wave-45-local-llm-research.md](wave-45-local-llm-research.md)
