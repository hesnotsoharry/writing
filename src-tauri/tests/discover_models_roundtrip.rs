//! Integration tests for `discover_models` — round-trip smoke against a stub HTTP server.
//! Covers the full probe chain (Ollama → OpenAI fallback) and base-URL normalization.
//! Uses `wiremock` which binds to 127.0.0.1 (loopback), so classify_endpoint passes cleanly.

use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};
use writing_lib::local_endpoint::discover_models;

/// Ollama /api/tags probe succeeds → model list returned.
#[tokio::test]
async fn ollama_probe_returns_model_list() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/tags"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_string(r#"{"models":[{"name":"llama3"}]}"#),
        )
        .mount(&server)
        .await;

    let result = discover_models(server.uri(), None).await;
    assert_eq!(result, Ok(vec!["llama3".to_string()]));
}

/// /api/tags returns 404 → falls back to /v1/models and returns that list.
#[tokio::test]
async fn openai_fallback_when_ollama_returns_404() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/tags"))
        .respond_with(ResponseTemplate::new(404))
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/v1/models"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_string(r#"{"data":[{"id":"gpt-x"}]}"#),
        )
        .mount(&server)
        .await;

    let result = discover_models(server.uri(), None).await;
    assert_eq!(result, Ok(vec!["gpt-x".to_string()]));
}

/// Regression for fix #2: a /v1-suffixed base URL (LM Studio style) must be
/// normalized to origin-only before probing, so /api/tags is hit at the root
/// rather than /v1/api/tags.
#[tokio::test]
async fn v1_suffixed_base_url_is_normalized() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/tags"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_string(r#"{"models":[{"name":"mistral"}]}"#),
        )
        .mount(&server)
        .await;

    let v1_url = format!("{}/v1", server.uri());
    let result = discover_models(v1_url, None).await;
    assert_eq!(result, Ok(vec!["mistral".to_string()]));
}

/// Unreachable host returns an Err containing "reach".
/// Port 1 on loopback is virtually never open; connection refused is immediate.
#[tokio::test]
async fn unreachable_host_returns_err_containing_reach() {
    let result = discover_models("http://127.0.0.1:1".to_string(), None).await;
    assert!(result.is_err());
    let msg = result.unwrap_err();
    assert!(
        msg.to_lowercase().contains("reach"),
        "expected 'reach' in error message, got: {msg}"
    );
}
