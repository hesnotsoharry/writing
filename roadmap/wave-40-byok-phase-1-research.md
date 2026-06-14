# Wave 40 — research grounding (current-API specs)

> Sidecar to `wave-40-DRAFT.md`. Distilled from this session's `haiku-research-extractor` + `sonnet-architect` passes (2026-06-13). Grounding, not gospel — verify against the pinned version before relying on a line.

## keyring crate v4.0.1 (OS keychain) — the v3→v4 break

**Critical:** keyring v4 was split into separate crates. v3's `--features windows-native` flag **no longer exists** (`cargo add keyring --features windows-native` errors "no features available"). Platform backends are now auto-pulled per target via Cargo target-specific deps.

- `keyring = "4"` — provides `use_native_store()` / `release_store()` store-selection helpers.
- `keyring-core = "1"` — provides the `Entry` API (the actual surface the app calls).
- Platform backend (`windows-native-keyring-store` on Windows) is pulled automatically; no feature flag.

**Footgun:** you MUST call `use_native_store(false)` once at startup. Without it, keyring has **no active store** and operations fail / fall back to a non-persistent path. This is the single highest-value research finding — it would otherwise be a silent "key doesn't persist across restart" debug loop.

Entry API (keyring-core):
```rust
use keyring::use_native_store;
use keyring_core::Entry;

use_native_store(false)?;                                  // once, at app startup
let entry = Entry::new("com.coles.writing", "byok-anthropic")?;
entry.set_password("sk-ant-...")?;                          // store
let key = entry.get_password()?;                            // retrieve (Result<String>)
entry.delete_credential()?;                                 // remove
```
- Sync API → wrap calls in `tokio::task::spawn_blocking` inside async Tauri commands (don't block the executor thread).
- Error type: `keyring_core::Error` (variants `NoEntry`, `Ambiguous`, `Invalid`, `NotSupportedByStore`, platform errors). `NoEntry` is the "key not set" signal for `byok_has_key`.
- **Secret-leak discipline:** do NOT return the raw `keyring_core::Error` Debug to JS. `map_err(|_| "fixed message")`. Verify the Debug impl doesn't echo the secret before shipping (the docs don't promise it doesn't).
- Service/user target name must be unique (`com.coles.writing` / `byok-anthropic`) — Windows Credential Manager is per-user-process-readable; a generic name risks cross-app collision.
- Windows Credential Manager: 20-cred/app limit (we use 1), ~32KB size cap (an API key is ~100 chars — fine), DPAPI per-user encryption.
- macOS forward-compat: `use_native_store()` auto-selects Keychain on macOS; same Entry code path. No Phase-1 work.

## Anthropic Messages API — direct streaming (raw SSE)

BYOK calls `POST https://api.anthropic.com/v1/messages` directly from Rust (reqwest). Because there's no proxy, the client now owns **raw Anthropic SSE parsing** (the managed path never did — the proxy normalized it).

- Headers: `x-api-key: <user key>`, `anthropic-version: 2023-06-01`, `content-type: application/json`. (The `anthropic-dangerous-direct-browser-access` header is a *browser-origin* signal — NOT needed when the call originates from Rust/reqwest, which has no CORS.)
- Body: `{ model, max_tokens, temperature, system, messages, stream: true }`. Phase 1 model = `claude-haiku-4-5-20251001` for all verbs.
- SSE wire format: each event is two physical lines — `event: <name>\n` then `data: <json>\n`, separated by blank lines. The Rust parser splits on `\n`, keeps only `data:`-prefixed lines, JSON-parses the payload. Event types that matter:
  - `message_start` → `data.message.usage.input_tokens` (capture for the Done event).
  - `content_block_delta` → `data.delta.text` (a `text_delta`) → emit a `Token` NormalizedEvent.
  - `message_delta` → `data.usage.output_tokens` (capture) → emit `Done`.
  - `error` → `data.error.message` → emit `Error` (sanitized).
  - (`ping`, `content_block_start/stop`, `message_stop` are ignorable for Phase 1.)
- reqwest: add the `stream` feature (`reqwest = { version = "0.12", features = ["json", "stream"] }`) for `Response::bytes_stream()`. Draining the stream with `.next().await` needs `StreamExt` → add `futures = "0.3"` (currently absent — code will not compile without it).

## The IPC contract (NormalizedEvent) — highest-risk seam

The Rust enum MUST serde-serialize to EXACTLY the existing TS union shape, or events arrive but match no branch (silent: no tokens render, no error thrown).

```rust
#[derive(serde::Serialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum NormalizedEvent {
    Token { text: String },
    Done { input_tokens: u32, output_tokens: u32, credits_cost: u32 },  // credits_cost always 0 for BYOK
    Error { message: String },
}
```
- `#[serde(tag = "type")]` → produces `{"type":"token", ...}` / `{"type":"done", ...}` / `{"type":"error", ...}`. Verify the variant tag lowercases to match the TS union (`token`/`done`/`error`) — `rename_all = "camelCase"` lowercases the first letter of single-word variants. **Pin this with a Rust unit test** asserting `serde_json::to_string(&Token{...})` == `{"type":"token","text":"..."}`. This is the Phase-1 walking-skeleton acceptance test.

## Tauri Channel (Rust → JS streaming)

- `Channel<T>` is in `@tauri-apps/api/core` — NOT currently imported anywhere in this codebase (must add the import).
- JS: `const ch = new Channel<NormalizedEvent>(); ch.onmessage = onEvent; await invoke("byok_chat", { ..., onEvent: ch })`. The `invoke` promise resolves when the Rust command returns (stream end); events arrive incrementally via `ch.onmessage`.
- Rust: command takes `on_event: tauri::ipc::Channel<NormalizedEvent>`; call `on_event.send(ev)?` per token.
- No Tauri capability/permission entry needed — custom app commands (registered in `invoke_handler`) are not gated by the capability allow-list (verified against this app's `capabilities/*.json`: existing `greet`/`backup_database`/`activate_license` commands have no capability entries and ship working).
- Cancellation: store a `tokio_util::sync::CancellationToken` (or `oneshot`) keyed by a `stream_id` in Tauri-managed state; `byok_stop(stream_id)` fires it; the `byok_chat` drain loop checks it each chunk.
