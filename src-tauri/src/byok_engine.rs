//! Provider-routed BYOK stream engine (Wave 49, Phase 2).
//!
//! A single shared SSE drain loop, generic over wire format. This is the ONLY
//! place the drain loop lives. `byok.rs` (Anthropic) and `byok_openai.rs`
//! (OpenAI) each build a `RequestSpec` and call `run_stream`; this fn owns
//! cancel registration, POST, raw-byte buffer drain, and terminal `Done` on
//! every exit path.
//!
//! Published W45 contract: `byok_local.rs` builds a `RequestSpec` (Authorization
//! header omitted for keyless local servers) and calls
//! `run_stream(..., WireFormat::OpenAiCompatible, ...)`. No change to this file
//! is needed unless a local-server wire quirk forces a new `WireFormat` variant.

use futures::StreamExt;

// ── Wire format ───────────────────────────────────────────────────────────────

/// Which provider's SSE wire format to parse.
///
/// Compile-time exhaustiveness: a new format requires a new variant + a matching
/// `parse_line` arm — a compile error, not a silent `Ignore`.
pub enum WireFormat {
    Anthropic,
    OpenAiCompatible,
}

// ── ParseLine ─────────────────────────────────────────────────────────────────

/// What a single SSE `data:` line means after parsing.
///
/// `[DONE]` is NOT routed through `parse_line` — `run_stream` detects it
/// directly (engine-owned invariant) and breaks before calling this fn.
pub enum ParseLine {
    /// A text fragment for the user — emit as `NormalizedEvent::Token`.
    Token(String),
    /// Anthropic incremental input-token count — update accumulator.
    UpdateInput(u32),
    /// Anthropic incremental output-token count — update accumulator.
    UpdateOutput(u32),
    /// Final OpenAI usage chunk — set all three accumulators at once.
    ///
    /// `cached` is accumulated in `run_stream` but NOT yet emitted in this
    /// phase — Phase 5 adds `cached_tokens` to `NormalizedEvent::Done`.
    SetUsage { input: u32, cached: u32, output: u32 },
    /// Provider sent a mid-stream error event — engine emits `Error` and breaks.
    StreamError,
    /// Line is not actionable — skip.
    Ignore,
}

impl WireFormat {
    /// Parse a single SSE `data:` JSON payload (after stripping the `data: ` prefix).
    ///
    /// MUST NOT be called with `"[DONE]"` — `run_stream` detects `[DONE]` first
    /// and breaks without calling this fn (engine-owned invariant).
    pub fn parse_line(&self, json: &str) -> ParseLine {
        match self {
            WireFormat::Anthropic => {
                if let Some(text) = crate::byok::extract_text_delta(json) {
                    ParseLine::Token(text)
                } else if crate::byok::is_stream_error(json) {
                    ParseLine::StreamError
                } else if let Some(n) = crate::byok::extract_input_tokens(json) {
                    ParseLine::UpdateInput(n)
                } else if let Some(n) = crate::byok::extract_output_tokens(json) {
                    ParseLine::UpdateOutput(n)
                } else {
                    ParseLine::Ignore
                }
            }
            WireFormat::OpenAiCompatible => {
                if let Some(text) = crate::byok_openai::extract_openai_text_delta(json) {
                    ParseLine::Token(text)
                } else if let Some(u) = crate::byok_openai::extract_openai_usage(json) {
                    ParseLine::SetUsage {
                        input: u.input_tokens,
                        cached: u.cached_tokens,
                        output: u.output_tokens,
                    }
                } else {
                    ParseLine::Ignore
                }
            }
        }
    }

    /// Fixed sanitized HTTP-error message for this provider.
    ///
    /// NEVER includes the response body — only fixed constant strings cross the
    /// IPC boundary, so a key that appears in a server 401 body never leaks.
    pub fn http_error_msg(&self, status: u16) -> &'static str {
        match self {
            WireFormat::Anthropic => match status {
                401 => "Invalid API key — check Settings",
                429 => "Rate limited by Anthropic — wait a moment",
                _ => "Anthropic request failed — try again later",
            },
            WireFormat::OpenAiCompatible => match status {
                401 => "Invalid API key — check Settings",
                429 => "Rate limited by OpenAI — wait a moment",
                _ => "OpenAI request failed — try again later",
            },
        }
    }

    /// Fixed sanitized connection-error message for this provider.
    pub fn connection_error_msg(&self) -> &'static str {
        match self {
            WireFormat::Anthropic => "Failed to connect to Anthropic — check your network",
            WireFormat::OpenAiCompatible => "Failed to connect to OpenAI — check your network",
        }
    }

    /// Fixed sanitized mid-stream error message for this provider.
    pub fn stream_error_msg(&self) -> &'static str {
        match self {
            WireFormat::Anthropic => "Anthropic returned an error — try again",
            WireFormat::OpenAiCompatible => "OpenAI returned an error — try again",
        }
    }
}

// ── RequestSpec ───────────────────────────────────────────────────────────────

/// Everything needed to POST a streaming request to a provider.
///
/// Key-lifetime invariant (Decision 5, hard requirement): `run_stream` drops
/// this struct immediately after `send()` returns — before the drain loop.
/// The API key lives in `headers` and must NOT be retained for logging or retry.
pub struct RequestSpec {
    /// Full endpoint URL. Must use `http` or `https` scheme — `run_stream`
    /// enforces this with a SSRF tripwire before making any network connection.
    pub url: String,
    /// Request headers: static name + owned value (the API key lives here).
    pub headers: Vec<(&'static str, String)>,
    /// Request body serialized as JSON.
    pub body: serde_json::Value,
}

// ── Scheme validation ─────────────────────────────────────────────────────────

/// Check if a URL's scheme is http or https.
/// Returns false for URLs with no scheme, non-http(s) schemes, or empty string.
fn url_scheme_allowed(url: &str) -> bool {
    let scheme_end = url.find(':').unwrap_or(0);
    let scheme = url[..scheme_end].to_ascii_lowercase();
    scheme == "http" || scheme == "https"
}

// ── Shared drain ──────────────────────────────────────────────────────────────

/// Register cancel, POST, buffer raw bytes, parse SSE lines, dispatch events,
/// and always emit terminal `NormalizedEvent::Done` on every exit path.
///
/// Hard requirements (Decision 5, Phase 2 — non-negotiable):
/// 1. Key-drop: `request` is dropped immediately after `send()`, before the drain.
/// 2. `[DONE]` is detected by THIS fn before `parse_line` — never routed through.
/// 3. `StreamError` ⇒ emit `Error` + `break`; terminal `Done` on EVERY exit path.
/// 4. SSRF tripwire: rejects any non-http/https scheme; TLS never relaxed.
/// 5. `SetUsage` carries `cached`; accumulated but not emitted yet (Phase 5 adds it).
pub async fn run_stream(
    cancel: &crate::byok::ByokCancel,
    stream_id: String,
    on_event: tauri::ipc::Channel<crate::byok::NormalizedEvent>,
    wire: WireFormat,
    request: RequestSpec,
) -> Result<(), String> {
    use crate::byok::NormalizedEvent;

    // Hard requirement 4: SSRF tripwire.
    if !url_scheme_allowed(&request.url) {
        let _ = on_event.send(NormalizedEvent::Error {
            message: "Invalid endpoint URL".to_string(),
        });
        let _ = on_event.send(NormalizedEvent::Done {
            input_tokens: 0,
            output_tokens: 0,
            credits_cost: 0,
            cached_tokens: 0,
        });
        return Ok(());
    }

    // Register a oneshot cancellation channel for this stream_id.
    // `byok_stop` / `byok_openai_stop` send `()` on the sender; the drain loop
    // breaks via `tokio::select! { biased; _ = &mut cancel_rx => break }`.
    let (cancel_tx, cancel_rx) = tokio::sync::oneshot::channel::<()>();
    {
        let mut map = cancel.0.lock().map_err(|_| "State lock failed".to_string())?;
        map.insert(stream_id.clone(), cancel_tx);
    }

    // Build and POST the request.
    let client = reqwest::Client::new();
    let mut builder = client.post(&request.url);
    for (name, value) in &request.headers {
        builder = builder.header(*name, value.as_str());
    }
    builder = builder.json(&request.body);

    let response = match builder.send().await {
        Ok(r) => r,
        Err(_) => {
            // Capture the message before dropping the wire format and request.
            let msg = wire.connection_error_msg();
            // Hard requirement 1: drop request (and its api key) before returning.
            drop(request);
            let _ = on_event.send(NormalizedEvent::Error {
                message: msg.to_string(),
            });
            let _ = on_event.send(NormalizedEvent::Done {
                input_tokens: 0,
                output_tokens: 0,
                credits_cost: 0,
                cached_tokens: 0,
            });
            remove_cancel(cancel, &stream_id);
            return Ok(());
        }
    };

    // Hard requirement 1: key-drop — RequestSpec (api key in headers) is dropped
    // immediately after send() returns, BEFORE the drain loop begins.
    drop(request);

    // Map HTTP error codes to fixed sanitized messages (NEVER include response body).
    if !response.status().is_success() {
        let msg = wire.http_error_msg(response.status().as_u16());
        let _ = on_event.send(NormalizedEvent::Error {
            message: msg.to_string(),
        });
        let _ = on_event.send(NormalizedEvent::Done {
            input_tokens: 0,
            output_tokens: 0,
            credits_cost: 0,
            cached_tokens: 0,
        });
        remove_cancel(cancel, &stream_id);
        return Ok(());
    }

    // Drain the SSE byte stream.
    //
    // RAW BYTES are buffered so that multi-byte UTF-8 characters (é, em-dash,
    // smart quotes, etc.) split across TCP chunk boundaries are never corrupted
    // into U+FFFD replacement characters. Only complete newline-terminated byte
    // slices are decoded to String — at that point the full character is present.
    //
    // Hard requirement 2: `[DONE]` is detected explicitly and breaks the loop
    // BEFORE `wire.parse_line` is called. Routing `[DONE]` through parse_line
    // would return `Ignore` and the loop would hang until a timeout.
    //
    // Hard requirement 5: `cached_tokens` is accumulated here and emitted in the
    // terminal `NormalizedEvent::Done` (Phase 5, Wave 49 — Decision 5).
    //
    // `tokio::select! { biased; ... }` checks cancellation before each chunk so
    // `byok_stop` / `byok_openai_stop` can abort mid-stream within one chunk's latency.
    let mut input_tokens: u32 = 0;
    let mut output_tokens: u32 = 0;
    let mut cached_tokens: u32 = 0; // Emitted in terminal Done.cached_tokens (Phase 5, W49).
    let mut byte_stream = response.bytes_stream();
    let mut line_buf: Vec<u8> = Vec::new();

    tokio::pin!(cancel_rx);

    'drain: loop {
        let chunk = tokio::select! {
            biased;
            _ = &mut cancel_rx => break 'drain,
            chunk = byte_stream.next() => chunk,
        };

        let bytes = match chunk {
            None => break 'drain,
            Some(Err(_)) => break 'drain,
            Some(Ok(b)) => b,
        };

        line_buf.extend_from_slice(&bytes);

        loop {
            let Some(pos) = line_buf.iter().position(|&b| b == b'\n') else {
                break;
            };
            // Strip a single trailing \r (CRLF line endings per SSE spec).
            let end = if pos > 0 && line_buf[pos - 1] == b'\r' { pos - 1 } else { pos };
            let line = String::from_utf8_lossy(&line_buf[..end]).into_owned();
            line_buf = line_buf[pos + 1..].to_vec();

            let Some(json) = line.strip_prefix("data: ") else {
                continue;
            };
            let json = json.trim();

            // Hard requirement 2: detect [DONE] before calling parse_line.
            if json == "[DONE]" {
                break 'drain;
            }

            match wire.parse_line(json) {
                ParseLine::Token(text) => {
                    // If the channel is closed (WebView navigated away), stop silently.
                    if on_event.send(NormalizedEvent::Token { text }).is_err() {
                        break 'drain;
                    }
                }
                ParseLine::UpdateInput(n) => input_tokens = n,
                ParseLine::UpdateOutput(n) => output_tokens = n,
                ParseLine::SetUsage { input, cached, output } => {
                    input_tokens = input;
                    cached_tokens = cached; // Hard requirement 5: accumulate
                    output_tokens = output;
                }
                // Hard requirement 3: StreamError ⇒ emit Error + break.
                ParseLine::StreamError => {
                    let _ = on_event.send(NormalizedEvent::Error {
                        message: wire.stream_error_msg().to_string(),
                    });
                    break 'drain;
                }
                ParseLine::Ignore => {}
            }
        }
    }

    // Hard requirement 3: terminal Done fires on EVERY exit path — cancel, read
    // error, [DONE] sentinel, stream error, or channel-closed (WebView gone).
    // Phase 5 (Wave 49): cached_tokens is now emitted in the terminal Done so the
    // TS layer can attribute cached reads at the cheaper cache-read rate.
    let _ = on_event.send(NormalizedEvent::Done {
        input_tokens,
        output_tokens,
        credits_cost: 0,
        cached_tokens,
    });

    remove_cancel(cancel, &stream_id);
    Ok(())
}

/// Remove a stream_id from the shared cancellation map on all exit paths of
/// `run_stream` to prevent the map growing unboundedly.
fn remove_cancel(cancel: &crate::byok::ByokCancel, stream_id: &str) {
    if let Ok(mut map) = cancel.0.lock() {
        map.remove(stream_id);
    }
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // Anthropic arm ───────────────────────────────────────────────────────────

    #[test]
    fn anthropic_content_block_delta_routes_to_token() {
        let json = r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}"#;
        let result = WireFormat::Anthropic.parse_line(json);
        assert!(
            matches!(result, ParseLine::Token(t) if t == "Hello"),
            "Anthropic content_block_delta must route to ParseLine::Token"
        );
    }

    #[test]
    fn anthropic_stream_error_routes_to_stream_error() {
        let json =
            r#"{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}"#;
        let result = WireFormat::Anthropic.parse_line(json);
        assert!(
            matches!(result, ParseLine::StreamError),
            "Anthropic error event must route to ParseLine::StreamError"
        );
    }

    #[test]
    fn anthropic_message_start_routes_to_update_input() {
        let json =
            r#"{"type":"message_start","message":{"usage":{"input_tokens":42}}}"#;
        let result = WireFormat::Anthropic.parse_line(json);
        assert!(
            matches!(result, ParseLine::UpdateInput(42)),
            "Anthropic message_start must route to ParseLine::UpdateInput(42)"
        );
    }

    #[test]
    fn anthropic_message_delta_routes_to_update_output() {
        let json = r#"{"type":"message_delta","usage":{"output_tokens":17}}"#;
        let result = WireFormat::Anthropic.parse_line(json);
        assert!(
            matches!(result, ParseLine::UpdateOutput(17)),
            "Anthropic message_delta must route to ParseLine::UpdateOutput(17)"
        );
    }

    #[test]
    fn anthropic_ping_routes_to_ignore() {
        let result = WireFormat::Anthropic.parse_line(r#"{"type":"ping"}"#);
        assert!(
            matches!(result, ParseLine::Ignore),
            "Anthropic ping must route to ParseLine::Ignore"
        );
    }

    // OpenAI arm ──────────────────────────────────────────────────────────────

    #[test]
    fn openai_content_chunk_routes_to_token() {
        let json = r#"{"id":"x","choices":[{"index":0,"delta":{"content":"World"},"finish_reason":null}],"usage":null}"#;
        let result = WireFormat::OpenAiCompatible.parse_line(json);
        assert!(
            matches!(result, ParseLine::Token(t) if t == "World"),
            "OpenAI content chunk must route to ParseLine::Token"
        );
    }

    #[test]
    fn openai_final_usage_chunk_routes_to_set_usage_with_cached_subtracted() {
        // prompt_tokens=1000, cached_tokens=800 → non-cached input=200, cached=800, output=50.
        // This asserts the same subtraction as the frozen byok_openai.rs test, but via
        // the engine's routing layer — verifying the SetUsage carries cached.
        let json = r#"{"choices":[],"usage":{"prompt_tokens":1000,"completion_tokens":50,"prompt_tokens_details":{"cached_tokens":800}}}"#;
        let result = WireFormat::OpenAiCompatible.parse_line(json);
        assert!(
            matches!(
                result,
                ParseLine::SetUsage { input: 200, cached: 800, output: 50 }
            ),
            "OpenAI usage chunk must route to SetUsage with cached subtracted from prompt"
        );
    }

    #[test]
    fn openai_role_only_opening_chunk_routes_to_ignore() {
        let json =
            r#"{"choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}"#;
        let result = WireFormat::OpenAiCompatible.parse_line(json);
        assert!(
            matches!(result, ParseLine::Ignore),
            "OpenAI role-only opening chunk must route to ParseLine::Ignore"
        );
    }

    #[test]
    fn openai_finish_reason_chunk_routes_to_ignore() {
        let json =
            r#"{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":null}"#;
        let result = WireFormat::OpenAiCompatible.parse_line(json);
        assert!(
            matches!(result, ParseLine::Ignore),
            "OpenAI finish_reason chunk must route to ParseLine::Ignore"
        );
    }

    // SSRF tripwire ───────────────────────────────────────────────────────────

    #[test]
    fn ssrf_scheme_extraction_rejects_non_http() {
        // Exercise the extracted url_scheme_allowed fn for various schemes.
        let cases = [
            ("file:///etc/passwd", false),
            ("data:text/html,hi", false),
            ("ftp://example.com", false),
            ("javascript:alert(1)", false),
            ("", false),
            ("http://api.openai.com/v1/chat/completions", true),
            ("https://api.anthropic.com/v1/messages", true),
            ("HTTPS://mixed.case.example.com", true),
        ];
        for (url, expect_ok) in cases {
            let is_ok = url_scheme_allowed(url);
            assert_eq!(
                is_ok,
                expect_ok,
                "URL {:?}: expected ok={} got ok={}",
                url,
                expect_ok,
                is_ok
            );
        }
    }
}
