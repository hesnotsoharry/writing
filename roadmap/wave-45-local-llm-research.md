# W45 Research Extract: Local LLM Integration (Ollama + OpenAI-Compatible Endpoints)

## 1. Ollama Model-List API

**Endpoint:** `GET /api/tags`  
**Default Host:** `localhost:11434`  
**Source:** https://github.com/ollama/ollama/blob/main/docs/api.md

Response JSON structure:
```json
{
  "models": [
    {
      "name": "llama3.2:latest",
      "model": "llama3.2:latest",
      "modified_at": "2025-05-04T17:37:44.706015396-07:00",
      "size": 2019393189,
      "digest": "a80c4f...",
      "details": {
        "parent_model": "",
        "format": "gguf",
        "family": "llama",
        "families": ["llama"],
        "parameter_size": "3.2B",
        "quantization_level": "Q4_K_M"
      }
    }
  ]
}
```

**OpenAI-compatible endpoint:** `GET /v1/models` — also available. Returns same core model data with extended schema.

**CORS policy:** Controlled via `OLLAMA_ORIGINS` environment variable. By default, Ollama appends `http://localhost`, `127.0.0.1`, `0.0.0.0`, `app://`, `file://`, `tauri://`, `vscode-webview://`. Set `OLLAMA_ORIGINS="*"` to allow all origins, or comma-separated list for specific ports (as of 2026-Q2; restart Ollama after setting). Desktop shells (Rust) are not browser-subject to CORS, so this is primarily for JavaScript-from-browser callers.

## 2. OpenAI-Compatible API Response Shapes

**Source:** https://developers.openai.com/api/reference/resources/models/methods/list (official OpenAI API Reference)

### `GET /v1/models` Response
```json
{
  "object": "list",
  "data": [
    {
      "id": "model-name",
      "object": "model",
      "created": 1686935002,
      "owned_by": "organization-owner"
    }
  ]
}
```

**Key fields:** `data[]` array; each model has `id` (string), `object` ("model"), `created` (Unix timestamp, integer), `owned_by` (string).

### `POST /v1/chat/completions` Streaming Response
**Source:** https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create

Server-sent events (SSE), one JSON object per line:
```json
{"id":"chatcmpl-123","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"logprobs":null,"finish_reason":null}]}

{"id":"chatcmpl-123","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]}
```

**Key fields per chunk:**
- `choices[].delta.content` — text fragment (string, may be empty)
- `choices[].delta.role` — "assistant" (first chunk only, optional in later chunks)
- `choices[].finish_reason` — `"stop"` | `"length"` | `"tool_calls"` | null (null = more chunks coming)
- `usage` — object with `prompt_tokens`, `completion_tokens`, `total_tokens` (present only on final chunk if `stream_options: {"include_usage": true}`)

Sentinel for stream end: `finish_reason: "stop"` (no explicit `[DONE]` marker in the JSON; stream closes after that event).

## 3. Rust HTTP Client — Loopback Detection + TLS Policy

**Source:** 
- Loopback: https://doc.rust-lang.org/std/net/enum.IpAddr.html (std library)
- reqwest TLS: https://github.com/seanmonstar/reqwest (official repo)

### Loopback Detection
**Method:** `std::net::IpAddr::is_loopback()` returns `bool`.
```rust
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

let ipv4_loopback = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));
assert!(ipv4_loopback.is_loopback());  // true

let ipv6_loopback = IpAddr::V6(Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 1));
assert!(ipv6_loopback.is_loopback());  // true
```
Recognizes all `127.0.0.0/8` (IPv4) and `::1` (IPv6).

### TLS Default Behavior
- **HTTPS is enabled by default** in reqwest; uses system trust roots automatically.
- **No special certificate handling required for remote HTTPS** — certificates are validated against the OS CA store.
- **For loopback plaintext HTTP:** reqwest allows `http://localhost:*` without modification; TLS is not enforced. No configuration needed.

To enforce HTTPS + cert validation → remote and reject self-signed (without custom CA):
```rust
use reqwest::Client;

let client = Client::builder()
    .build()?;
    // Default behavior: HTTPS enforced via system CAs, HTTP allowed for loopback via scheme inspection
```

**Gotcha:** `danger_accept_invalid_certs()` exists but should NEVER be used in production. Proper pattern: loopback → allow plaintext http, remote → require https + cert validation (no workarounds).

## 4. URL Validation in Rust

**Source:** https://context7.com/servo/rust-url/llms.txt (Servo rust-url crate, WHATWG-standard)

**Parse and extract components:**
```rust
use url::{Url, ParseError};

let url = Url::parse("http://localhost:11434/api/tags")?;

url.scheme()           // "http"
url.host_str()         // Some("localhost")
url.host()             // Some(Host::Domain("localhost"))
url.port()             // Some(11434)
url.path()             // "/api/tags"
url.query()            // None
```

**Error handling for malformed URLs:**
```rust
let result = Url::parse("not a url");
// Returns Err(ParseError::RelativeUrlWithoutBase)

let result = Url::parse("http://[:::1]");
// Returns Err(ParseError::InvalidIpv6Address)
```

**Loopback classification (combine with std::net):**
```rust
use std::net::IpAddr;
use url::Url;

let url = Url::parse("http://localhost:11434/api/tags")?;
let host_str = url.host_str().ok_or("no host")?;
let ip: IpAddr = host_str.parse()
    .or_else(|_| {
        // If not an IP, check if it's "localhost" / "127.0.0.1"
        if host_str == "localhost" { Ok(IpAddr::from([127, 0, 0, 1])) }
        else { Err("not loopback") }
    })?;
assert!(ip.is_loopback());
```

## 5. Tauri 2 — Outbound HTTP from Rust Commands

**Source:** https://v2.tauri.app/plugin/http-client (official Tauri v2 docs)

**No special allowlist or capability restrictions** on the Rust side. Tauri 2 bundles the HTTP plugin; Rust commands can make arbitrary outbound HTTP via reqwest directly:

```rust
use tauri_plugin_http::reqwest;

#[tauri::command]
async fn fetch_models(endpoint: String) -> Result<String, String> {
    let response = reqwest::get(&endpoint)
        .await
        .map_err(|e| e.to_string())?;
    response.text().await.map_err(|e| e.to_string())
}
```

**Plugin initialization (in `main.rs`):**
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .invoke_handler(tauri::generate_handler![fetch_models])
    .build(tauri::generate_context!())
    .run(|_, _| {})
```

**TLS behavior:** reqwest's defaults apply (HTTPS validated by default, HTTP allowed). No Tauri-specific TLS configuration needed unless adding custom CAs (use `Certificate::from_pem()` on the `Client` builder as shown in #3).

**Gotcha:** The HTTP plugin re-exports reqwest; use `tauri_plugin_http::reqwest::*` for client builders. CSP / allowlist concerns are renderer-side (JavaScript); Rust commands have no network boundaries.

---

**Date tag:** Research as of 2026-06-14 (Ollama, Tauri 2.x, OpenAI API, reqwest current versions).
