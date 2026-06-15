//! BYOK (bring-your-own-key) — direct-to-Anthropic AI pipeline (Wave 40).
//!
//! The user's Anthropic API key lives ONLY in this module's Rust memory:
//! OS keychain -> here -> outbound HTTPS header. It MUST NOT be returned to JS,
//! logged, included in any error string, or printed via Debug. Error strings
//! crossing the IPC boundary are fixed constants (see Phase 4 hardening).
//!
//! Phase 1 (walking skeleton): keychain commands + a `byok_chat` streaming
//! command that calls api.anthropic.com directly (reqwest stream), parses raw
//! Anthropic SSE, and pushes `NormalizedEvent`s to the WebView via a Tauri
//! `Channel`. The `NormalizedEvent` enum + the `#[cfg(test)] mod tests` block
//! below are the ORCHESTRATOR-AUTHORED FROZEN CONTRACT — implementers add the
//! command/keychain/streaming code AROUND them but MUST NOT modify the enum
//! shape or the tests.

use std::collections::HashMap;
use std::sync::Mutex;

use keyring_core::Entry;
use serde::{Deserialize, Serialize};

// ── Frozen contract (do NOT modify) ──────────────────────────────────────────

/// Streaming event pushed to the WebView via `Channel<NormalizedEvent>`.
///
/// MUST serialize to exactly the TS `NormalizedEvent` union in
/// `src/features/ai/ai.client.ts` (the `token` / `done` / `error` arms), or
/// events arrive but match no branch — a silent failure (no tokens render, no
/// error thrown). Pinned by the tests below.
///
/// Note: `#[serde(tag = "type", rename_all = "camelCase")]` on the enum renames
/// the VARIANT tags (`token`/`done`/`error`) but NOT the fields inside struct
/// variants — hence the per-variant `rename_all` on `Done` to get
/// `inputTokens`/`outputTokens`/`creditsCost`. `credits_cost` is always 0 for
/// BYOK (no managed meter).
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum NormalizedEvent {
    Token {
        text: String,
    },
    #[serde(rename_all = "camelCase")]
    Done {
        input_tokens: u32,
        output_tokens: u32,
        credits_cost: u32,
    },
    Error {
        message: String,
    },
}

/// Extract the incremental text from a single Anthropic SSE `data:` JSON payload
/// (the JSON string after the `data: ` prefix has been stripped).
///
/// Returns `Some(text)` ONLY for a `content_block_delta` carrying a `text_delta`;
/// returns `None` for every other event type (`message_start`, `message_delta`,
/// `ping`, `content_block_start`/`stop`, `message_stop`, malformed JSON, etc.).
pub fn extract_text_delta(data_json: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(data_json).ok()?;
    if v.get("type")?.as_str()? != "content_block_delta" {
        return None;
    }
    let delta = v.get("delta")?;
    if delta.get("type")?.as_str()? != "text_delta" {
        return None;
    }
    delta.get("text")?.as_str().map(str::to_owned)
}

// ── Cancellation state ────────────────────────────────────────────────────────

/// Managed state: a map of in-flight stream IDs to their cancellation senders.
///
/// Approach: `tokio::sync::oneshot` (not `tokio-util::CancellationToken`) — avoids
/// an extra crate dependency. `byok_stop` sends `()` on the channel; the drain
/// loop checks it via `tokio::select! { biased; _ = &mut cancel_rx => break, ... }`.
pub struct ByokCancel(pub Mutex<HashMap<String, tokio::sync::oneshot::Sender<()>>>);

impl Default for ByokCancel {
    fn default() -> Self {
        ByokCancel(Mutex::new(HashMap::new()))
    }
}

// ── Message shape ─────────────────────────────────────────────────────────────

/// A single turn in the conversation. Matches the TS `AiMessage` shape.
/// Deserialized from the JS invoke call; not exposed to JS (no Serialize needed).
#[derive(Debug, Deserialize)]
pub struct Msg {
    pub role: String,
    pub content: String,
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SERVICE: &str = "com.coles.writing";
const USER: &str = "byok-anthropic";
const ANTHROPIC_ENDPOINT: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";

// ── Private helpers ───────────────────────────────────────────────────────────

/// Verb → (temperature, max_tokens). Phase 1 model is fixed; only policy varies.
fn verb_policy(verb: &str) -> (f32, u32) {
    match verb {
        "proofread" => (0.3, 2048),
        "critique" => (0.7, 2048),
        "betaread" => (0.7, 2048),
        _ => (1.0, 1024), // brainstorm + any future verb default
    }
}

/// Extract `input_tokens` from a `message_start` SSE event.
pub fn extract_input_tokens(data_json: &str) -> Option<u32> {
    let v: serde_json::Value = serde_json::from_str(data_json).ok()?;
    if v.get("type")?.as_str()? != "message_start" {
        return None;
    }
    v.pointer("/message/usage/input_tokens")
        ?.as_u64()
        .map(|n| n as u32)
}

/// Extract `output_tokens` from a `message_delta` SSE event.
pub fn extract_output_tokens(data_json: &str) -> Option<u32> {
    let v: serde_json::Value = serde_json::from_str(data_json).ok()?;
    if v.get("type")?.as_str()? != "message_delta" {
        return None;
    }
    v.pointer("/usage/output_tokens")
        ?.as_u64()
        .map(|n| n as u32)
}

/// Returns `true` if a `data:` JSON payload is an Anthropic mid-stream error
/// event (`{"type":"error",...}`). These arrive after HTTP 200 and must be
/// detected explicitly; the caller sends a fixed `Error` event and breaks the
/// drain loop (followed by the terminal `Done`).
pub fn is_stream_error(data_json: &str) -> bool {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(data_json) else {
        return false;
    };
    v.get("type").and_then(|t| t.as_str()) == Some("error")
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Store the user's Anthropic API key in the OS keychain.
/// The key is trimmed before storage. An empty/whitespace key is rejected.
/// The key is accepted from JS exactly once; after storage it NEVER re-enters
/// the WebView or appears in any error string.
#[tauri::command]
pub async fn byok_set_key(api_key: String) -> Result<(), String> {
    let trimmed = api_key.trim().to_string();
    if trimmed.is_empty() {
        return Err("API key cannot be empty".to_string());
    }
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let entry = Entry::new(SERVICE, USER)
            .map_err(|_| "Keychain entry creation failed".to_string())?;
        entry
            .set_password(&trimmed)
            .map_err(|_| "Failed to store API key in keychain".to_string())
    })
    .await
    .map_err(|_| "Keychain task failed".to_string())?
}

/// Returns `true` iff a non-empty BYOK API key is currently stored in the OS
/// keychain. A stored empty or whitespace-only string reads as "no key."
/// Safe to call from JS — returns only a boolean, never the key itself.
#[tauri::command]
pub async fn byok_has_key() -> bool {
    tokio::task::spawn_blocking(|| {
        Entry::new(SERVICE, USER)
            .ok()
            .and_then(|e| e.get_password().ok())
            .filter(|p| !p.trim().is_empty())
    })
    .await
    .unwrap_or(None)
    .is_some()
}

/// Remove the BYOK API key from the OS keychain. Idempotent — returns Ok even if
/// no key is stored (treats `NoEntry` as success).
#[tauri::command]
pub async fn byok_clear_key() -> Result<(), String> {
    tokio::task::spawn_blocking(|| -> Result<(), String> {
        let entry = Entry::new(SERVICE, USER)
            .map_err(|_| "Keychain entry creation failed".to_string())?;
        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring_core::Error::NoEntry) => Ok(()), // idempotent
            Err(_) => Err("Failed to clear API key from keychain".to_string()),
        }
    })
    .await
    .map_err(|_| "Keychain task failed".to_string())?
}

/// Stream a chat request directly to `api.anthropic.com`.
///
/// The API key is fetched from the OS keychain at call time, placed in the
/// outbound HTTPS header inside `RequestSpec`, and dropped by `byok_engine::run_stream`
/// immediately after `send()` returns — it NEVER crosses the IPC boundary in
/// either direction after the initial `byok_set_key`.
///
/// Events are pushed to the WebView via the `on_event` Channel as they arrive.
/// The fn always returns `Ok(())` — errors are sent as `NormalizedEvent::Error`
/// through the channel so the JS side sees them in the conversation thread.
///
/// `stream_id` must be unique per in-flight request; `byok_stop(stream_id)` cancels it.
///
/// Terminal-signal contract: `NormalizedEvent::Done` is ALWAYS the final event on
/// every exit path — including error exits. The JS side must use `Done` (not
/// `Error`) as the cleanup trigger; `Error` signals a problem but is always
/// followed by exactly one `Done`.
#[tauri::command]
pub async fn byok_chat(
    state: tauri::State<'_, ByokCancel>,
    stream_id: String,
    model: String, // W49 Phase 2: replaces hardcoded MODEL const; picker wires real selection in Phase 4
    messages: Vec<Msg>,
    system: String,
    verb: String,
    on_event: tauri::ipc::Channel<NormalizedEvent>,
) -> Result<(), String> {
    // 1. Fetch the key from the keychain (sync API → spawn_blocking).
    //    On failure, send Error + Done via the channel and return Ok so JS sees
    //    the error in-band rather than as a rejected Tauri command.
    let api_key = {
        let result = tokio::task::spawn_blocking(|| -> Result<String, String> {
            let entry = Entry::new(SERVICE, USER)
                .map_err(|_| "Keychain entry failed".to_string())?;
            entry
                .get_password()
                .map_err(|_| "No API key stored".to_string())
        })
        .await
        .map_err(|_| "Keychain task failed".to_string())?;

        match result {
            Ok(key) => key,
            Err(_) => {
                let _ = on_event.send(NormalizedEvent::Error {
                    message: "No API key set — add one in Settings".to_string(),
                });
                let _ = on_event.send(NormalizedEvent::Done {
                    input_tokens: 0,
                    output_tokens: 0,
                    credits_cost: 0,
                });
                return Ok(());
            }
        }
    };

    // 2. Build RequestSpec; delegate cancel registration, POST, drain, and
    //    terminal Done to byok_engine::run_stream (the shared engine).
    //    verb_policy resolves temperature + max_tokens for this verb.
    let (temperature, max_tokens) = verb_policy(&verb);
    let messages_json: Vec<serde_json::Value> = messages
        .into_iter()
        .map(|m| serde_json::json!({"role": m.role, "content": m.content}))
        .collect();
    let body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "system": system,
        "messages": messages_json,
        "stream": true,
    });

    // api_key is MOVED into the headers vec here (not cloned) — the original
    // binding is gone after this point. run_stream drops the RequestSpec
    // (and thus the key) immediately after send() returns.
    let request = crate::byok_engine::RequestSpec {
        url: ANTHROPIC_ENDPOINT.to_string(),
        headers: vec![
            ("x-api-key", api_key),
            ("anthropic-version", ANTHROPIC_VERSION.to_string()),
            ("content-type", "application/json".to_string()),
        ],
        body,
    };

    crate::byok_engine::run_stream(
        &state,
        stream_id,
        on_event,
        crate::byok_engine::WireFormat::Anthropic,
        request,
    )
    .await
}

/// Cancel an in-flight `byok_chat` stream by stream_id.
/// No-op (returns Ok) if the stream_id is not found or already finished.
#[tauri::command]
pub async fn byok_stop(
    state: tauri::State<'_, ByokCancel>,
    stream_id: String,
) -> Result<(), String> {
    let mut map = state.0.lock().map_err(|_| "State lock failed".to_string())?;
    if let Some(tx) = map.remove(&stream_id) {
        let _ = tx.send(());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---------------------------------------------------------------------
    // FROZEN CONTRACT — Wave 40, orchestrator-authored. Do NOT modify.
    // The Channel<NormalizedEvent> serialization must match the TS union in
    // ai.client.ts EXACTLY, or events silently match no branch on the JS side.
    // ---------------------------------------------------------------------

    #[test]
    fn token_event_serializes_to_ts_shape() {
        let ev = NormalizedEvent::Token { text: "hi".into() };
        assert_eq!(
            serde_json::to_string(&ev).unwrap(),
            r#"{"type":"token","text":"hi"}"#
        );
    }

    #[test]
    fn done_event_serializes_to_ts_shape() {
        let ev = NormalizedEvent::Done {
            input_tokens: 12,
            output_tokens: 34,
            credits_cost: 0,
        };
        assert_eq!(
            serde_json::to_string(&ev).unwrap(),
            r#"{"type":"done","inputTokens":12,"outputTokens":34,"creditsCost":0}"#
        );
    }

    #[test]
    fn error_event_serializes_to_ts_shape() {
        let ev = NormalizedEvent::Error {
            message: "Invalid API key".into(),
        };
        assert_eq!(
            serde_json::to_string(&ev).unwrap(),
            r#"{"type":"error","message":"Invalid API key"}"#
        );
    }

    #[test]
    fn extracts_text_from_content_block_delta() {
        let line = r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}"#;
        assert_eq!(extract_text_delta(line), Some("Hello".to_string()));
    }

    #[test]
    fn ignores_non_text_delta_events() {
        assert_eq!(extract_text_delta(r#"{"type":"ping"}"#), None);
        assert_eq!(
            extract_text_delta(r#"{"type":"message_start","message":{"usage":{"input_tokens":5}}}"#),
            None
        );
        assert_eq!(extract_text_delta("not json"), None);
    }

    // ---------------------------------------------------------------------
    // New tests — Wave 40 Phase 1 correctness fixes
    // ---------------------------------------------------------------------

    #[test]
    fn is_stream_error_detects_anthropic_error_event() {
        // Anthropic overloaded_error mid-stream shape
        let overloaded = r#"{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}"#;
        assert!(is_stream_error(overloaded));
    }

    #[test]
    fn is_stream_error_returns_false_for_non_error_types() {
        assert!(!is_stream_error(r#"{"type":"ping"}"#));
        assert!(!is_stream_error(r#"{"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}"#));
        assert!(!is_stream_error(r#"{"type":"message_stop"}"#));
        assert!(!is_stream_error("not json at all"));
        assert!(!is_stream_error(""));
    }

    #[test]
    fn is_stream_error_requires_type_field_to_be_error() {
        // A JSON object with no "type" key must not match
        assert!(!is_stream_error(r#"{"error":{"message":"something"}}"#));
    }

    #[test]
    fn byok_set_key_rejects_empty_string() {
        // byok_set_key is async/Tauri — test the trim+empty logic inline
        let key = "   ".to_string();
        let trimmed = key.trim().to_string();
        assert!(trimmed.is_empty(), "whitespace-only key must be treated as empty");
    }

    #[test]
    fn byok_has_key_empty_password_reads_as_no_key() {
        // Mirror the filter logic used in byok_has_key
        let stored: Option<String> = Some("".to_string());
        let has_key = stored.filter(|p| !p.trim().is_empty()).is_some();
        assert!(!has_key, "empty stored password must report no key");

        let stored_ws: Option<String> = Some("   ".to_string());
        let has_key_ws = stored_ws.filter(|p| !p.trim().is_empty()).is_some();
        assert!(!has_key_ws, "whitespace stored password must report no key");

        let stored_real: Option<String> = Some("sk-ant-abc123".to_string());
        let has_key_real = stored_real.filter(|p| !p.trim().is_empty()).is_some();
        assert!(has_key_real, "non-empty key must report has key");
    }

    #[test]
    fn utf8_line_split_on_complete_bytes_avoids_replacement_chars() {
        // Simulate two TCP chunks where an em-dash (U+2014, 3 bytes: E2 80 94)
        // is split across chunk boundary: chunk1 = [E2], chunk2 = [80, 94, 0A].
        // The byte-buffer approach collects both chunks before splitting on 0x0A;
        // from_utf8_lossy on the complete 3-byte sequence must NOT produce U+FFFD.
        let mut buf: Vec<u8> = Vec::new();
        buf.extend_from_slice(&[0xE2]);             // chunk 1: first byte of —
        buf.extend_from_slice(&[0x80, 0x94, 0x0A]); // chunk 2: rest of — + newline

        let pos = buf.iter().position(|&b| b == b'\n').unwrap();
        let line = String::from_utf8_lossy(&buf[..pos]).into_owned();
        assert_eq!(line, "\u{2014}", "em-dash must survive a chunk-boundary split");
        assert!(!line.contains('\u{FFFD}'), "no replacement chars expected");
    }
}
