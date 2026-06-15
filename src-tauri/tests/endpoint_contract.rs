use writing_lib::local_endpoint::{
    classify_endpoint, parse_ollama_tags, parse_openai_models, EndpointError, EndpointKind,
};

// ============================================================================
// classify_endpoint — security guardrail for endpoint URLs
// ============================================================================

#[test]
fn test_classify_endpoint_loopback_http_localhost() {
    assert_eq!(
        classify_endpoint("http://localhost:11434"),
        Ok(EndpointKind::Loopback)
    );
}

#[test]
fn test_classify_endpoint_loopback_http_127_0_0_1() {
    assert_eq!(
        classify_endpoint("http://127.0.0.1:11434"),
        Ok(EndpointKind::Loopback)
    );
}

#[test]
fn test_classify_endpoint_loopback_http_127_entire_block() {
    // Entire 127.0.0.0/8 is loopback
    assert_eq!(
        classify_endpoint("http://127.5.9.1"),
        Ok(EndpointKind::Loopback)
    );
}

#[test]
fn test_classify_endpoint_loopback_ipv6() {
    assert_eq!(
        classify_endpoint("http://[::1]:8080"),
        Ok(EndpointKind::Loopback)
    );
}

#[test]
fn test_classify_endpoint_loopback_https() {
    // https on loopback is permitted and still classifies as Loopback
    assert_eq!(
        classify_endpoint("https://localhost:11434"),
        Ok(EndpointKind::Loopback)
    );
}

#[test]
fn test_classify_endpoint_remote_https_domain() {
    assert_eq!(
        classify_endpoint("https://example.com"),
        Ok(EndpointKind::Remote)
    );
}

#[test]
fn test_classify_endpoint_remote_https_lan_ip() {
    // LAN IP (192.168.x.x) is NOT loopback; requires https
    assert_eq!(
        classify_endpoint("https://192.168.1.5:8080"),
        Ok(EndpointKind::Remote)
    );
}

#[test]
fn test_classify_endpoint_error_http_remote_domain() {
    // http plaintext to non-loopback domain is forbidden
    assert_eq!(
        classify_endpoint("http://example.com"),
        Err(EndpointError::HttpsRequiredForRemote)
    );
}

#[test]
fn test_classify_endpoint_error_http_remote_lan_ip() {
    // http plaintext to LAN IP is forbidden
    assert_eq!(
        classify_endpoint("http://192.168.1.5:8080"),
        Err(EndpointError::HttpsRequiredForRemote)
    );
}

#[test]
fn test_classify_endpoint_error_unsupported_scheme() {
    assert_eq!(
        classify_endpoint("ftp://localhost"),
        Err(EndpointError::UnsupportedScheme)
    );
}

#[test]
fn test_classify_endpoint_error_malformed_not_a_url() {
    assert_eq!(
        classify_endpoint("not a url"),
        Err(EndpointError::Malformed)
    );
}

#[test]
fn test_classify_endpoint_error_malformed_empty_string() {
    assert_eq!(
        classify_endpoint(""),
        Err(EndpointError::Malformed)
    );
}

// ============================================================================
// parse_ollama_tags — extract model names from Ollama GET /api/tags
// ============================================================================

#[test]
fn test_parse_ollama_tags_happy_path() {
    let body = r#"{"models":[{"name":"llama3.2:latest","model":"llama3.2:latest","size":42},{"name":"mistral:7b"}]}"#;
    assert_eq!(
        parse_ollama_tags(body),
        Ok(vec!["llama3.2:latest".to_string(), "mistral:7b".to_string()])
    );
}

#[test]
fn test_parse_ollama_tags_empty_models() {
    let body = r#"{"models":[]}"#;
    assert_eq!(parse_ollama_tags(body), Ok(vec![]));
}

#[test]
fn test_parse_ollama_tags_malformed_json() {
    let body = "<html>nope";
    let result = parse_ollama_tags(body);
    assert!(result.is_err());
}

// ============================================================================
// parse_openai_models — extract model IDs from OpenAI-compatible GET /v1/models
// ============================================================================

#[test]
fn test_parse_openai_models_happy_path() {
    let body = r#"{"object":"list","data":[{"id":"gpt-4","object":"model"},{"id":"llama3"}]}"#;
    assert_eq!(
        parse_openai_models(body),
        Ok(vec!["gpt-4".to_string(), "llama3".to_string()])
    );
}

#[test]
fn test_parse_openai_models_empty_data() {
    let body = r#"{"data":[]}"#;
    assert_eq!(parse_openai_models(body), Ok(vec![]));
}

#[test]
fn test_parse_openai_models_malformed_json() {
    let body = "<html>nope";
    let result = parse_openai_models(body);
    assert!(result.is_err());
}
