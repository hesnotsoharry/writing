//! BYOK (bring-your-own-key) — direct-to-OpenAI AI pipeline (Wave 49, Phase 1).
//!
//! Sibling of `byok.rs` (Anthropic). The user's OpenAI API key lives ONLY in this
//! module's / the keychain's memory: OS keychain -> here -> outbound HTTPS header.
//! It MUST NOT be returned to JS, logged, included in any error string, or printed
//! via Debug. Error strings crossing the IPC boundary are fixed constants (mirrors
//! the W40 Anthropic hardening).
//!
//! Emits the SAME `crate::byok::NormalizedEvent` union the Anthropic path emits, so
//! the WebView consumes one normalized stream regardless of provider.
//!
//! ── ORCHESTRATOR-AUTHORED FROZEN CONTRACT (Wave 49) ──────────────────────────
//! The two parser helpers below (`extract_openai_text_delta`, `extract_openai_usage`),
//! the `OpenAiUsage` struct, and the `#[cfg(test)] mod tests` block are the boundary
//! contract for the OpenAI Chat Completions streaming wire format. Phase 1's
//! implementer adds the keychain commands (`byok-openai` entry), the
//! `byok_openai_chat` streaming command (the byte-stream drain loop, mirroring
//! `byok_chat`), and the lib.rs registration AROUND these — but MUST NOT modify the
//! struct shape, the helper signatures, or the tests.
//!
//! Why this is the frozen contract: OpenAI's `usage.prompt_tokens` INCLUDES
//! `prompt_tokens_details.cached_tokens` (unlike Anthropic, whose `input_tokens`
//! EXCLUDES cache). Passing `prompt_tokens` straight through double-counts the cached
//! portion. `extract_openai_usage` does the subtraction once, here, tested below.
//! Wire-shape grounding: `roadmap/wave-49-byok-multi-provider-research.md` §1–2.

use keyring_core::Entry;
use serde::Deserialize;

// ── Constants ─────────────────────────────────────────────────────────────────

/// Same SERVICE as the Anthropic keychain entry — both keys live under the app's
/// service identifier. The USER discriminates them: 'byok-anthropic' vs 'byok-openai'.
const SERVICE: &str = "com.coles.writing";
const USER_OPENAI: &str = "byok-openai";
const OPENAI_ENDPOINT: &str = "https://api.openai.com/v1/chat/completions";

// ── Keychain commands ─────────────────────────────────────────────────────────

/// Store the user's OpenAI API key in the OS keychain.
/// Mirror of `byok_set_key` (Anthropic path) but uses `USER_OPENAI` so the two
/// keys live under distinct entries and cannot cross-fire.
#[tauri::command]
pub async fn byok_openai_set_key(api_key: String) -> Result<(), String> {
    let trimmed = api_key.trim().to_string();
    if trimmed.is_empty() {
        return Err("API key cannot be empty".to_string());
    }
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let entry = Entry::new(SERVICE, USER_OPENAI)
            .map_err(|_| "Keychain entry creation failed".to_string())?;
        entry
            .set_password(&trimmed)
            .map_err(|_| "Failed to store API key in keychain".to_string())
    })
    .await
    .map_err(|_| "Keychain task failed".to_string())?
}

/// Returns `true` iff a non-empty OpenAI API key is currently stored in the OS
/// keychain. Safe to call from JS — returns only a boolean, never the key itself.
#[tauri::command]
pub async fn byok_openai_has_key() -> bool {
    tokio::task::spawn_blocking(|| {
        Entry::new(SERVICE, USER_OPENAI)
            .ok()
            .and_then(|e| e.get_password().ok())
            .filter(|p| !p.trim().is_empty())
    })
    .await
    .unwrap_or(None)
    .is_some()
}

/// Remove the OpenAI API key from the OS keychain. Idempotent.
#[tauri::command]
pub async fn byok_openai_clear_key() -> Result<(), String> {
    tokio::task::spawn_blocking(|| -> Result<(), String> {
        let entry = Entry::new(SERVICE, USER_OPENAI)
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

// ── Streaming command ─────────────────────────────────────────────────────────

/// Stream a chat request directly to `api.openai.com`.
///
/// Mirrors `byok_chat` (Anthropic) in structure: the key is fetched from the OS
/// keychain, placed in the `Authorization: Bearer` header inside `RequestSpec`,
/// and dropped by `byok_engine::run_stream` immediately after `send()` returns.
/// It NEVER crosses the IPC boundary in either direction after `byok_openai_set_key`.
///
/// Chat Completions has no top-level `system` field — the system prompt is folded
/// into a leading `{"role":"system","content":...}` message.
///
/// Terminal-signal contract (same as byok_chat): `NormalizedEvent::Done` is ALWAYS
/// the final event on every exit path, including error exits. JS must use `Done`
/// (not `Error`) as the cleanup trigger.
///
/// Reuses `crate::byok::ByokCancel` — stream_ids are UUIDs so there is no collision
/// risk between in-flight Anthropic and OpenAI streams sharing the same map.
#[tauri::command]
pub async fn byok_openai_chat(
    state: tauri::State<'_, crate::byok::ByokCancel>,
    stream_id: String,
    model: String,
    messages: Vec<crate::byok::Msg>,
    system: String,
    max_completion_tokens: u32,
    temperature: f32,
    on_event: tauri::ipc::Channel<crate::byok::NormalizedEvent>,
) -> Result<(), String> {
    use crate::byok::NormalizedEvent;

    // 1. Fetch the key from the keychain (sync API → spawn_blocking).
    let api_key = {
        let result = tokio::task::spawn_blocking(|| -> Result<String, String> {
            let entry = Entry::new(SERVICE, USER_OPENAI)
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

    // 2. Build OpenAI Chat Completions request body.
    //    Chat Completions has NO top-level system field — fold it into a leading
    //    system message. reasoning_effort:'none' + temperature is the Standard path.
    let mut messages_json: Vec<serde_json::Value> = Vec::new();
    let trimmed_system = system.trim();
    if !trimmed_system.is_empty() {
        messages_json.push(serde_json::json!({ "role": "system", "content": trimmed_system }));
    }
    messages_json.extend(
        messages
            .into_iter()
            .map(|m| serde_json::json!({ "role": m.role, "content": m.content })),
    );
    let body = serde_json::json!({
        "model": model,
        "messages": messages_json,
        "stream": true,
        "stream_options": { "include_usage": true },
        "max_completion_tokens": max_completion_tokens,
        "reasoning_effort": "none",
        "temperature": temperature,
    });

    // Build RequestSpec; delegate cancel registration, POST, drain, and terminal
    // Done to byok_engine::run_stream (the shared engine).
    // The api_key is formatted into the Authorization value (creating a new String),
    // then the original api_key binding is explicitly dropped before run_stream
    // so the engine's drop(request) is the sole cleanup site for the copy in headers.
    let auth_value = format!("Bearer {}", api_key);
    drop(api_key); // drop original; only auth_value (in headers) remains
    let request = crate::byok_engine::RequestSpec {
        url: OPENAI_ENDPOINT.to_string(),
        headers: vec![
            ("Authorization", auth_value),
            ("Content-Type", "application/json".to_string()),
        ],
        body,
    };

    crate::byok_engine::run_stream(
        &state,
        stream_id,
        on_event,
        crate::byok_engine::WireFormat::OpenAiCompatible,
        request,
    )
    .await
}

/// Cancel an in-flight `byok_openai_chat` stream by stream_id.
/// No-op if the stream_id is not found or already finished.
/// Reuses `crate::byok::ByokCancel` — the same cancellation map as the Anthropic path.
#[tauri::command]
pub async fn byok_openai_stop(
    state: tauri::State<'_, crate::byok::ByokCancel>,
    stream_id: String,
) -> Result<(), String> {
    let mut map = state.0.lock().map_err(|_| "State lock failed".to_string())?;
    if let Some(tx) = map.remove(&stream_id) {
        let _ = tx.send(());
    }
    Ok(())
}

// ── Frozen contract (do NOT modify) ──────────────────────────────────────────

/// Canonical token buckets normalized from an OpenAI streaming `usage` object.
///
/// `input_tokens` is the NON-cached input (`prompt_tokens − cached_tokens`).
/// `cached_tokens` is the cache-read bucket (billed at the discounted rate by the
/// Phase 5 usage readout; OpenAI has no cache-WRITE premium so there is no write
/// bucket). `output_tokens` is `completion_tokens`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct OpenAiUsage {
    pub input_tokens: u32,
    pub cached_tokens: u32,
    pub output_tokens: u32,
}

/// Shape of the OpenAI streaming usage object (final chunk only). Internal — never
/// serialized back to JS; it folds into `NormalizedEvent::Done`.
#[derive(Debug, Deserialize)]
struct RawUsage {
    #[serde(default)]
    prompt_tokens: u32,
    #[serde(default)]
    completion_tokens: u32,
    #[serde(default)]
    prompt_tokens_details: Option<RawPromptDetails>,
}

#[derive(Debug, Deserialize)]
struct RawPromptDetails {
    #[serde(default)]
    cached_tokens: u32,
}

/// Extract the incremental text from a single OpenAI Chat Completions streaming
/// `data:` JSON payload (the JSON after the `data: ` prefix has been stripped).
///
/// Returns `Some(text)` ONLY for a chunk carrying `choices[0].delta.content`.
/// Returns `None` for the role-only opening chunk (`delta.role` with no `content`),
/// the final usage-only chunk (empty `choices` array), `finish_reason` chunks with
/// no content, and malformed JSON. (The literal `data: [DONE]` terminator is handled
/// by the drain loop, never reaches this fn.)
pub fn extract_openai_text_delta(data_json: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(data_json).ok()?;
    v.pointer("/choices/0/delta/content")?
        .as_str()
        .map(str::to_owned)
}

/// Normalize an OpenAI streaming `usage` object into canonical buckets.
///
/// Returns `None` when the payload has no non-null `usage` object (every non-final
/// chunk: `usage` is absent or `null`). On the final chunk, performs the critical
/// subtraction `input_tokens = prompt_tokens − cached_tokens` (saturating, so a
/// pathological `cached > prompt` can never underflow) to avoid double-counting the
/// cached input bucket.
pub fn extract_openai_usage(data_json: &str) -> Option<OpenAiUsage> {
    let v: serde_json::Value = serde_json::from_str(data_json).ok()?;
    let usage_val = v.get("usage")?;
    if usage_val.is_null() {
        return None;
    }
    let raw: RawUsage = serde_json::from_value(usage_val.clone()).ok()?;
    let cached = raw.prompt_tokens_details.map_or(0, |d| d.cached_tokens);
    Some(OpenAiUsage {
        input_tokens: raw.prompt_tokens.saturating_sub(cached),
        cached_tokens: cached,
        output_tokens: raw.completion_tokens,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---------------------------------------------------------------------
    // FROZEN CONTRACT — Wave 49, orchestrator-authored. Do NOT modify.
    // Pins the OpenAI Chat Completions streaming wire format → normalized
    // buckets. The cached-token subtraction is the costliest silent bug
    // (double-billing cached input); it is asserted here so it cannot regress.
    // ---------------------------------------------------------------------

    #[test]
    fn extracts_text_from_content_delta() {
        let line = r#"{"id":"x","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}],"usage":null}"#;
        assert_eq!(extract_openai_text_delta(line), Some("Hello".to_string()));
    }

    #[test]
    fn ignores_role_only_opening_chunk() {
        // First streaming chunk carries delta.role but no content.
        let line = r#"{"choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}"#;
        assert_eq!(extract_openai_text_delta(line), None);
    }

    #[test]
    fn ignores_final_usage_only_chunk_for_text() {
        // Final chunk: empty choices, populated usage — no text.
        let line = r#"{"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5}}"#;
        assert_eq!(extract_openai_text_delta(line), None);
    }

    #[test]
    fn ignores_finish_reason_chunk_and_malformed() {
        assert_eq!(
            extract_openai_text_delta(r#"{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}"#),
            None
        );
        assert_eq!(extract_openai_text_delta("not json"), None);
        assert_eq!(extract_openai_text_delta("[DONE]"), None);
    }

    #[test]
    fn usage_subtracts_cached_from_prompt_tokens() {
        // THE double-bill trap: prompt_tokens INCLUDES cached_tokens.
        // 1000 prompt, 800 cached → 200 non-cached input, 800 cached-read, 50 output.
        let line = r#"{"choices":[],"usage":{"prompt_tokens":1000,"completion_tokens":50,"prompt_tokens_details":{"cached_tokens":800}}}"#;
        assert_eq!(
            extract_openai_usage(line),
            Some(OpenAiUsage { input_tokens: 200, cached_tokens: 800, output_tokens: 50 })
        );
    }

    #[test]
    fn usage_with_no_cache_details_treats_cached_as_zero() {
        let line = r#"{"choices":[],"usage":{"prompt_tokens":120,"completion_tokens":34}}"#;
        assert_eq!(
            extract_openai_usage(line),
            Some(OpenAiUsage { input_tokens: 120, cached_tokens: 0, output_tokens: 34 })
        );
    }

    #[test]
    fn usage_saturates_when_cached_exceeds_prompt() {
        // Pathological / impossible per spec, but must never underflow.
        let line = r#"{"choices":[],"usage":{"prompt_tokens":50,"completion_tokens":10,"prompt_tokens_details":{"cached_tokens":80}}}"#;
        assert_eq!(
            extract_openai_usage(line),
            Some(OpenAiUsage { input_tokens: 0, cached_tokens: 80, output_tokens: 10 })
        );
    }

    #[test]
    fn usage_none_for_non_final_chunks() {
        // Non-final chunks have usage:null or no usage key.
        assert_eq!(
            extract_openai_usage(r#"{"choices":[{"delta":{"content":"hi"}}],"usage":null}"#),
            None
        );
        assert_eq!(
            extract_openai_usage(r#"{"choices":[{"delta":{"content":"hi"}}]}"#),
            None
        );
        assert_eq!(extract_openai_usage("not json"), None);
    }
}
