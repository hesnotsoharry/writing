//! Local / custom OpenAI-compatible endpoint support (Wave 45).
//!
//! Pure URL-classification + discovery-parse logic. Stubs declared by the
//! orchestrator (Phase-1 oracle); bodies implemented in Phase 1.
//!
//! Guardrail (W45 Decision D2): `http://` is permitted ONLY for loopback hosts
//! (localhost, 127.0.0.0/8, ::1). Any non-loopback host MUST use `https://`, and
//! TLS certificate validation is enforced at request time and never relaxed
//! (no `danger_accept_invalid_certs`, no user-facing "skip cert" control).

use keyring_core::Entry;
use serde::Deserialize;
use url::{Host, Url};

/// Classification of a user-typed endpoint URL.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EndpointKind {
    /// Loopback host (localhost / 127.0.0.0/8 / ::1) — `http://` permitted.
    Loopback,
    /// Non-loopback host — `https://` required, cert validation enforced.
    Remote,
}

/// Why a user-typed endpoint URL was rejected.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EndpointError {
    /// URL could not be parsed.
    Malformed,
    /// Scheme is neither `http` nor `https`.
    UnsupportedScheme,
    /// A non-loopback host was given with `http://` (plaintext to a remote host).
    HttpsRequiredForRemote,
}

impl std::fmt::Display for EndpointError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let msg = match self {
            EndpointError::Malformed => "That doesn't look like a valid URL.",
            EndpointError::UnsupportedScheme => "Endpoint must start with http:// or https://.",
            EndpointError::HttpsRequiredForRemote => {
                "Remote endpoints must use https:// — plaintext would expose your text on the network."
            }
        };
        f.write_str(msg)
    }
}

/// Parse + classify a user-typed endpoint URL, enforcing the W45 guardrail
/// documented in this module's header.
///
/// Returns `EndpointKind::Loopback` for loopback hosts (any scheme),
/// `EndpointKind::Remote` for non-loopback hosts on `https://`, and an
/// `EndpointError` otherwise.
pub fn classify_endpoint(raw: &str) -> Result<EndpointKind, EndpointError> {
    let url = Url::parse(raw).map_err(|_| EndpointError::Malformed)?;

    let scheme = url.scheme();
    if scheme != "http" && scheme != "https" {
        return Err(EndpointError::UnsupportedScheme);
    }

    let is_loopback = match url.host() {
        Some(Host::Domain(s)) => s == "localhost",
        Some(Host::Ipv4(addr)) => addr.is_loopback(),
        Some(Host::Ipv6(addr)) => addr.is_loopback(),
        None => return Err(EndpointError::Malformed),
    };

    if is_loopback {
        Ok(EndpointKind::Loopback)
    } else if scheme == "https" {
        Ok(EndpointKind::Remote)
    } else {
        Err(EndpointError::HttpsRequiredForRemote)
    }
}

// ── Private deserialization structs + helpers ─────────────────────────────────

#[derive(Deserialize)]
struct OllamaModel {
    name: String,
}

#[derive(Deserialize)]
struct OllamaTags {
    models: Vec<OllamaModel>,
}

#[derive(Deserialize)]
struct OpenAiModel {
    id: String,
}

#[derive(Deserialize)]
struct OpenAiList {
    data: Vec<OpenAiModel>,
}

/// Extract model names from an Ollama `GET /api/tags` JSON body
/// (`{ "models": [ { "name": "...", ... } ] }`). Order preserved.
pub fn parse_ollama_tags(body: &str) -> Result<Vec<String>, String> {
    let parsed: OllamaTags = serde_json::from_str(body).map_err(|e| e.to_string())?;
    Ok(parsed.models.into_iter().map(|m| m.name).collect())
}

/// Extract model ids from an OpenAI-compatible `GET /v1/models` JSON body
/// (`{ "data": [ { "id": "...", ... } ] }`). Order preserved.
pub fn parse_openai_models(body: &str) -> Result<Vec<String>, String> {
    let parsed: OpenAiList = serde_json::from_str(body).map_err(|e| e.to_string())?;
    Ok(parsed.data.into_iter().map(|m| m.id).collect())
}

const MAX_BODY_BYTES: usize = 2 * 1024 * 1024; // 2 MB

/// Read a response body into a `String`, capping at `MAX_BODY_BYTES`.
/// Prevents memory exhaustion from unexpectedly large replies on a fast loopback.
async fn read_capped(resp: reqwest::Response) -> Result<String, String> {
    use futures::StreamExt;
    let mut stream = resp.bytes_stream();
    let mut buf: Vec<u8> = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        if buf.len() + chunk.len() > MAX_BODY_BYTES {
            return Err("Endpoint response too large.".to_string());
        }
        buf.extend_from_slice(&chunk);
    }
    String::from_utf8(buf).map_err(|e| e.to_string())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Validate a user-typed endpoint URL against the W45 security guardrail.
/// Returns `"loopback"` or `"remote"` on success; the `EndpointError` Display
/// message as the Err string on failure.
#[tauri::command]
pub async fn validate_endpoint(url: String) -> Result<String, String> {
    classify_endpoint(&url)
        .map(|kind| match kind {
            EndpointKind::Loopback => "loopback".to_string(),
            EndpointKind::Remote => "remote".to_string(),
        })
        .map_err(|e| e.to_string())
}

/// Load the stored API key for `endpoint_id` from the OS keychain (Rust-side only).
/// Returns `None` if no key is stored or the keychain is unavailable.
/// Used by `discover_models` so the raw key never crosses to JS for saved endpoints.
async fn load_endpoint_key(endpoint_id: &str) -> Option<String> {
    let account = endpoint_account(endpoint_id);
    tokio::task::spawn_blocking(move || {
        Entry::new(SERVICE, &account)
            .ok()
            .and_then(|e| e.get_password().ok())
            .filter(|p| !p.trim().is_empty())
    })
    .await
    .unwrap_or(None)
}

/// Probe a model server at `url` and return the list of available model names.
/// Tries Ollama `GET /api/tags` first; falls back to OpenAI `GET /v1/models`.
///
/// Key resolution: if `endpoint_id` is `Some`, the bearer key is loaded from the OS
/// keychain Rust-side (key never crosses to JS). If `None`, `api_key` is used directly
/// (covers the add-form case where the user typed a key into the form field).
/// TLS defaults apply: cert validation is ON and is never relaxed.
/// Redirects are disabled — a validated loopback URL must never redirect off-loopback.
#[tauri::command]
pub async fn discover_models(
    url: String,
    api_key: Option<String>,
    endpoint_id: Option<String>,
) -> Result<Vec<String>, String> {
    // Reject invalid / insecure URLs before any network call.
    classify_endpoint(&url).map_err(|e| e.to_string())?;

    // Resolve bearer key: saved-endpoint path loads from keychain Rust-side;
    // add-form path uses the typed value that is unavoidably in the JS form field.
    let resolved_key: Option<String> = match endpoint_id {
        Some(ref id) => load_endpoint_key(id).await,
        None => api_key,
    };

    // Build the base URL from origin only (scheme + host + optional port),
    // discarding any path/query/fragment. This ensures /v1-suffixed bases
    // (e.g. LM Studio's http://localhost:1234/v1) don't produce doubled paths
    // like /v1/v1/models. Path-prefixed reverse-proxy endpoints are not
    // supported in Phase 1 — that's an accepted limitation.
    let parsed_url = Url::parse(&url).map_err(|e| e.to_string())?;
    let base = match parsed_url.port() {
        Some(port) => format!(
            "{}://{}:{}",
            parsed_url.scheme(),
            parsed_url.host_str().unwrap_or(""),
            port
        ),
        None => format!("{}://{}", parsed_url.scheme(), parsed_url.host_str().unwrap_or("")),
    };

    // Short timeout so a down server fails fast rather than hanging the UI.
    // Redirects disabled: a validated loopback URL must never redirect to a
    // non-loopback host, which would bypass the http-only-for-loopback guardrail.
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;

    // ── Try Ollama /api/tags ──────────────────────────────────────────────────
    let mut ollama_req = client.get(format!("{}/api/tags", base));
    if let Some(ref key) = resolved_key {
        ollama_req = ollama_req.bearer_auth(key);
    }
    let ollama_models = match ollama_req.send().await {
        Ok(resp) if resp.status().is_success() => {
            read_capped(resp).await.ok().and_then(|body| parse_ollama_tags(&body).ok())
        }
        _ => None,
    };
    if let Some(models) = ollama_models {
        return Ok(models);
    }

    // ── Fall back to OpenAI /v1/models ────────────────────────────────────────
    let mut openai_req = client.get(format!("{}/v1/models", base));
    if let Some(ref key) = resolved_key {
        openai_req = openai_req.bearer_auth(key);
    }
    match openai_req.send().await {
        Ok(resp) if resp.status().is_success() => {
            let body = read_capped(resp).await?;
            parse_openai_models(&body)
        }
        Ok(resp) => Err(format!(
            "Endpoint returned HTTP {} — check URL and API key.",
            resp.status()
        )),
        Err(_) => Err(
            "Couldn't reach the endpoint — is your model server running?".to_string(),
        ),
    }
}

// ── Per-endpoint keychain commands (Wave 45 Phase 2) ─────────────────────────
//
// Each saved endpoint gets its own OS keychain entry, keyed under the same
// service namespace as BYOK but with a distinct `local-endpoint-{id}` account
// string — preventing any collision with the global `byok-anthropic` entry.

const SERVICE: &str = "com.coles.writing";

fn endpoint_account(endpoint_id: &str) -> String {
    format!("local-endpoint-{}", endpoint_id)
}

/// Store an API key for a specific saved endpoint in the OS keychain.
/// Rejects empty/whitespace keys. Key MUST NOT re-enter JS after this call.
#[tauri::command]
pub async fn local_endpoint_set_key(endpoint_id: String, api_key: String) -> Result<(), String> {
    let trimmed = api_key.trim().to_string();
    if trimmed.is_empty() {
        return Err("API key cannot be empty".to_string());
    }
    let account = endpoint_account(&endpoint_id);
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let entry = Entry::new(SERVICE, &account)
            .map_err(|_| "Keychain entry creation failed".to_string())?;
        entry
            .set_password(&trimmed)
            .map_err(|_| "Failed to store API key in keychain".to_string())
    })
    .await
    .map_err(|_| "Keychain task failed".to_string())?
}

/// Returns `true` iff a non-empty API key is stored for this endpoint.
/// Safe to call from JS — returns only a boolean, never the key.
#[tauri::command]
pub async fn local_endpoint_has_key(endpoint_id: String) -> bool {
    let account = endpoint_account(&endpoint_id);
    tokio::task::spawn_blocking(move || {
        Entry::new(SERVICE, &account)
            .ok()
            .and_then(|e| e.get_password().ok())
            .filter(|p| !p.trim().is_empty())
    })
    .await
    .unwrap_or(None)
    .is_some()
}

/// Remove the API key for this endpoint from the OS keychain.
/// Idempotent — `NoEntry` is treated as success (mirrors `byok_clear_key`).
#[tauri::command]
pub async fn local_endpoint_clear_key(endpoint_id: String) -> Result<(), String> {
    let account = endpoint_account(&endpoint_id);
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let entry = Entry::new(SERVICE, &account)
            .map_err(|_| "Keychain entry creation failed".to_string())?;
        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring_core::Error::NoEntry) => Ok(()),
            Err(_) => Err("Failed to clear API key from keychain".to_string()),
        }
    })
    .await
    .map_err(|_| "Keychain task failed".to_string())?
}

