---
status: ACTIVE
decided-in: wave-49
promoted-during: wave-49
---

# Decision 0005: Rust provider-engine abstraction shape

**Context:** Generalize the duplicated Rust BYOK drain loops (`byok_chat` for Anthropic + `byok_openai_chat` for OpenAI) into one shared engine that is behavior-preserving for the shipped Anthropic path and published for Wave 45 (local models) to consume without re-forking.

**Pick:** Enum dispatch + a new `byok_engine.rs` module containing:
- `enum WireFormat { Anthropic, OpenAiCompatible }` — determines SSE parsing strategy
- `enum ParseLine` — provider-agnostic parse events
- `struct RequestSpec { url, headers: Vec<(&'static str, String)>, body: serde_json::Value }` — the call contract
- `async fn run_stream(...)` — the shared drain loop

Per-provider SSE parser helpers stay in `byok.rs` and `byok_openai.rs`; `WireFormat::parse_line` dispatches to them. `byok_chat` gains a `model: String` parameter (drops the hardcoded `MODEL` constant). Existing cargo tests stay green (behavior-preservation guard).

**Rationale:** Enum dispatch ensures **compile-time exhaustiveness** (a new wire format becomes a compile error, not a silent `Ignore`) and provides **zero allocation on the per-SSE-line hot path** with **zero new crates**. The per-provider variation is entirely synchronous, so async traits are unnecessary.

**Consequences:**
- The central `WireFormat` enum is a coordination hotspot for future wire formats (Gemini-class, etc.). Each new format adds an enum variant + a `parse_line` arm + a `byok_engine` import. Currently 2 formats; Wave 45's local provider reuses `OpenAiCompatible` (adds no variant).
- `ParseLine::SetUsage` carries cached tokens (`{ input, cached, output }`). `run_stream` accumulates all three. This forward-compatibility allows Phase 5 to surface cached cost without re-plumbing the parse boundary.
- **Key-lifetime invariant (hard requirement):** `run_stream` must consume/drop the `RequestSpec` (which owns the API-key string in `headers`) immediately after `send()` returns, before the drain loop. The key never lives across the stream. The `RequestSpec` must NOT be retained for logging/retry.
- **`ParseLine` control-flow contract:** The literal `data: [DONE]` is detected by the drain loop BEFORE `parse_line` is called (never routed through it). `ParseLine::StreamError` ⇒ engine emits `NormalizedEvent::Error` + breaks. Terminal `Done` fires on every exit path (cancel / read-error / `[DONE]` / stream-error).
- **SSRF backstop (defense-in-depth):** `run_stream` rejects any `url` whose scheme is not `http`/`https` and never relaxes TLS — a minimal tripwire complementing Wave 45's loopback/https/cert validation.

**Enforcement:** Decision ratified via the in-wave decision-review cell (sonnet-architect → sonnet-adversarial-reviewer with `Posture: attack-decision` → orchestrator adjudication, all flags addressed). Behavior-preservation enforced by existing cargo test suite. Key-drop, `[DONE]` detection, and SSRF-tripwire requirements are advisory-to-the-implementer, carried in the Phase 2 brief and verified by phase review.
