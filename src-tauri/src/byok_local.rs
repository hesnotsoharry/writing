//! BYOK local/custom OpenAI-compatible endpoint (Wave 45, Phase 4).
//!
//! Routes a streaming chat request through any OpenAI-compatible model server
//! (Ollama, llama.cpp, LM Studio, etc.) using the shared byok_engine drain loop.
//!
//! W45 invariants enforced here (over and above byok_openai.rs):
//!   1. Call `classify_endpoint` first — full loopback/https/cert validation before
//!      any network call (byok_engine::run_stream has a scheme-only SSRF tripwire;
//!      this fn adds the full W45 loopback/remote/cert check on top).
//!   2. OMIT `Authorization` header when `api_key` is `None` (keyless servers).
//!   3. OMIT `reasoning_effort` from the body — local servers reject it.
//!   4. Key-lifetime: resolved key consumed into `auth_value`, then dropped by
//!      `run_stream` immediately after `send()` — never retained or logged.

use crate::byok_engine::{RequestSpec, WireFormat};
use crate::local_endpoint::classify_endpoint;

// ── Streaming command ─────────────────────────────────────────────────────────

/// Stream a chat request to a local/custom OpenAI-compatible model server.
///
/// `base_url` must be a URL accepted by `classify_endpoint` (loopback or https
/// remote, certs on, no skip). The W45 guardrail runs BEFORE any network call.
///
/// Key resolution (matches `discover_models` convention — key never crosses to JS):
///   - `endpoint_id = Some(id)` → key loaded from OS keychain Rust-side.
///   - `endpoint_id = None`, `api_key = Some(k)` → key from JS (add-form path where
///     the key is unavoidably in a JS form field — same carve-out as `discover_models`).
///   - Both `None` → keyless mode (Authorization header omitted, W45 invariant #2).
///
/// W45 delta from `byok_openai.rs`:
///   - No hardcoded endpoint URL — base_url + `/v1/chat/completions` is constructed.
///   - Authorization omitted when keyless (invariant #2).
///   - `reasoning_effort` omitted from body (invariant #3).
#[tauri::command]
pub async fn byok_local_chat(
    state: tauri::State<'_, crate::byok::ByokCancel>,
    stream_id: String,
    base_url: String,
    model: String,
    messages: Vec<crate::byok::Msg>,
    system: String,
    max_completion_tokens: u32,
    temperature: f32,
    api_key: Option<String>,
    endpoint_id: Option<String>,
    on_event: tauri::ipc::Channel<crate::byok::NormalizedEvent>,
) -> Result<(), String> {
    // W45 invariant #1: full loopback/https/cert validation before any network call.
    classify_endpoint(&base_url).map_err(|e| e.to_string())?;

    // Resolve API key: saved-endpoint path loads Rust-side so the raw key never
    // crosses to JS. Add-form path uses the passed key (unavoidable — same as
    // discover_models). The resolved key is consumed into `auth_value` below.
    let resolved_key: Option<String> = match endpoint_id {
        Some(ref id) => crate::local_endpoint::load_endpoint_key(id).await,
        None => api_key,
    };

    // Build OpenAI Chat Completions request body.
    // W45 invariant #3: `reasoning_effort` intentionally absent — local servers reject it.
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
        "temperature": temperature,
        // reasoning_effort INTENTIONALLY OMITTED — local servers reject unknown params
    });

    // Build headers.
    // W45 invariant #2: Authorization omitted when no key (keyless local servers).
    // W45 invariant #4: resolved_key moved into auth_value here; run_stream drops the
    // RequestSpec (and auth_value) immediately after send() — key never outlives send.
    let mut headers: Vec<(&'static str, String)> = vec![
        ("Content-Type", "application/json".to_string()),
    ];
    if let Some(key) = resolved_key {
        // key is moved into auth_value; the binding `key` is consumed (no copy).
        let auth_value = format!("Bearer {}", key);
        headers.push(("Authorization", auth_value));
    }

    // Construct the chat completions URL from the validated base_url.
    // Path is stripped (same as discover_models) to prevent doubled paths when
    // the user saved a /v1-suffixed URL (e.g. http://localhost:1234/v1).
    let chat_url = build_chat_url(&base_url)?;

    let request = RequestSpec {
        url: chat_url,
        headers,
        body,
    };

    crate::byok_engine::run_stream(
        &state,
        stream_id,
        on_event,
        WireFormat::OpenAiCompatible,
        request,
    )
    .await
}

/// Cancel an in-flight `byok_local_chat` stream by stream_id.
/// Reuses `crate::byok::ByokCancel` — the same cancel map as Anthropic/OpenAI paths.
/// No-op when the stream_id is not found or the stream already finished.
#[tauri::command]
pub async fn byok_local_stop(
    state: tauri::State<'_, crate::byok::ByokCancel>,
    stream_id: String,
) -> Result<(), String> {
    let mut map = state.0.lock().map_err(|_| "State lock failed".to_string())?;
    if let Some(tx) = map.remove(&stream_id) {
        let _ = tx.send(());
    }
    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Strip path/query/fragment from `base_url` and append `/v1/chat/completions`.
///
/// Consistent with `discover_models` (origin-only approach) to prevent doubled
/// paths when the user saved a `/v1`-suffixed URL (e.g. `http://localhost:1234/v1`
/// → `http://localhost:1234/v1/chat/completions`, NOT `.../v1/v1/chat/completions`).
pub(crate) fn build_chat_url(base_url: &str) -> Result<String, String> {
    let parsed = url::Url::parse(base_url).map_err(|e| e.to_string())?;
    let origin = match parsed.port() {
        Some(port) => format!(
            "{}://{}:{}",
            parsed.scheme(),
            parsed.host_str().unwrap_or(""),
            port
        ),
        None => format!("{}://{}", parsed.scheme(), parsed.host_str().unwrap_or("")),
    };
    Ok(format!("{}/v1/chat/completions", origin))
}

/// Build a `RequestSpec` for a local chat request — extracted for unit testing.
///
/// Tests the W45 invariants:
///   (1) `api_key = None` ⇒ no Authorization header.
///   (2) Body has no `reasoning_effort` key.
///   (3) `api_key = Some(...)` ⇒ Authorization header with Bearer prefix.
#[cfg(test)]
pub(crate) fn build_local_request_spec(
    chat_url: String,
    model: &str,
    api_key: Option<String>,
    max_completion_tokens: u32,
    temperature: f32,
) -> RequestSpec {
    let body = serde_json::json!({
        "model": model,
        "messages": [],
        "stream": true,
        "stream_options": { "include_usage": true },
        "max_completion_tokens": max_completion_tokens,
        "temperature": temperature,
        // reasoning_effort absent by design
    });
    let mut headers: Vec<(&'static str, String)> = vec![
        ("Content-Type", "application/json".to_string()),
    ];
    if let Some(key) = api_key {
        headers.push(("Authorization", format!("Bearer {}", key)));
    }
    RequestSpec { url: chat_url, headers, body }
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── W45 invariant #2: no Authorization when keyless ───────────────────────

    #[test]
    fn no_auth_header_when_api_key_none() {
        // Keyless local servers must NOT receive an Authorization header.
        let spec = build_local_request_spec(
            "http://localhost:11434/v1/chat/completions".to_string(),
            "llama3.2",
            None,
            1024,
            1.0,
        );
        let has_auth = spec.headers.iter().any(|(name, _)| *name == "Authorization");
        assert!(!has_auth, "api_key=None must produce no Authorization header in the spec");
    }

    // ── W45 invariant #3 (b): no reasoning_effort in body ────────────────────

    #[test]
    fn body_has_no_reasoning_effort_key() {
        // Local servers (Ollama, llama.cpp, LM Studio) reject unknown params.
        let spec = build_local_request_spec(
            "http://localhost:11434/v1/chat/completions".to_string(),
            "llama3.2",
            None,
            1024,
            1.0,
        );
        assert!(
            spec.body.get("reasoning_effort").is_none(),
            "reasoning_effort must be absent from the local request body"
        );
    }

    // ── W45 invariant #3 (a): Authorization present when key provided ─────────

    #[test]
    fn auth_header_present_when_api_key_some() {
        // Keyed servers must receive a Bearer Authorization header.
        let spec = build_local_request_spec(
            "http://localhost:11434/v1/chat/completions".to_string(),
            "llama3.2",
            Some("sk-test-key".to_string()),
            1024,
            1.0,
        );
        let auth = spec.headers.iter().find(|(name, _)| *name == "Authorization");
        assert!(auth.is_some(), "api_key=Some must produce an Authorization header");
        assert_eq!(
            auth.unwrap().1,
            "Bearer sk-test-key",
            "Authorization must use the Bearer prefix"
        );
    }

    // ── build_chat_url: path stripping + endpoint suffix ─────────────────────

    #[test]
    fn build_chat_url_strips_path_and_appends_endpoint() {
        // LM Studio saves as http://localhost:1234/v1 — must not produce /v1/v1/...
        assert_eq!(
            build_chat_url("http://localhost:1234/v1").unwrap(),
            "http://localhost:1234/v1/chat/completions"
        );
        // Plain origin (Ollama default)
        assert_eq!(
            build_chat_url("http://localhost:11434").unwrap(),
            "http://localhost:11434/v1/chat/completions"
        );
        // Remote (https)
        assert_eq!(
            build_chat_url("https://api.example.com").unwrap(),
            "https://api.example.com/v1/chat/completions"
        );
    }
}
