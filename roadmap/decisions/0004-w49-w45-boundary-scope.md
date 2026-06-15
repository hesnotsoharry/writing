---
status: ACTIVE
decided-in: wave-49
promoted-during: wave-49
---

# Decision 0004: W49 ↔ W45 boundary (scope)

**Context:** Wave 45 (local models) runs in parallel with Wave 49; both touch the Rust BYOK engine (`byok.rs`) and the model picker. This decision clarifies the responsibility boundary and reduces collision risk.

**Pick:** Wave 49 builds the provider-routed engine, the cloud OpenAI integration, the registry-driven picker, and the per-provider usage tracking. Wave 45 consumes the engine (passes custom local base URLs), and owns the custom-URL entry UI, the loopback/https/cert validation guardrails, and local model discovery. Wave 49 lands first.

**Rationale:** Building the engine once in the wave that owns it and having the other wave be a pure consumer minimizes collision on the two shared surfaces (`byok.rs` and the picker). Clear ownership reduces merge friction and makes the contract explicit.

**Consequences:** Wave 49's OpenAI adapter must be base-URL-parameterized from the start (even though it only passes the `api.openai.com` constant) so Wave 45 needs no Rust refactor. The picker must be registry-driven so Wave 45 appends provider entries structurally without modification.

**Enforcement:** advisory-only (cross-wave coordination; the registry-shape published in Phase 2 is the coordination artifact).
