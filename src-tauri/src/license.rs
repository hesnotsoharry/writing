/// Lemon Squeezy license activation — Rust-side HTTP call so the key never
/// touches the webview and CORS is sidestepped entirely (Decision D2).
///
/// `activate_license` is a Tauri command: it POSTs to the LS activate endpoint,
/// parses whatever HTTP response comes back (success OR business-error), and
/// returns Ok(LicenseActivation) for any parseable response.  Transport
/// failures (DNS, offline, timeout) become Err(String) — the frontend maps
/// these to the "network" error kind (Decision D3).

// ─── Product identity constant ─────────────────────────────────────────────

/// Lemon Squeezy numeric variant IDs for the WritersNook one-time app purchase.
/// 1773908 = live store; 1748920 = test-mode store.
/// Any activated key whose `meta.variant_id` is not in this array is from a
/// different store or a different product and must be rejected.
const WRITERSNOOK_APP_VARIANT_IDS: [u64; 2] = [1773908, 1748920];

// ─── LS response shapes ────────────────────────────────────────────────────

/// Internal: LS instance object inside a successful activate response.
#[derive(serde::Deserialize)]
struct LsInstance {
    id: String,
}

/// Internal: LS license_key sub-object carrying usage counters and status.
#[derive(serde::Deserialize)]
struct LsLicenseKey {
    activation_limit: Option<u32>,
    activation_usage: Option<u32>,
    status: Option<String>,
}

/// Internal: metadata block present on activated responses — carries store_id,
/// product_id, and variant_id that identify which product was activated.
/// store_id and product_id are deserialized for completeness; validation today
/// gates only on variant_id (the only numeric ID available in this codebase).
#[derive(serde::Deserialize)]
#[allow(dead_code)]
struct LsMeta {
    store_id: Option<u64>,
    product_id: Option<u64>,
    variant_id: Option<u64>,
}

/// Internal: top-level LS activate response (success and error shapes share
/// the same wrapper — `activated` is the discriminant).
#[derive(serde::Deserialize)]
struct LsResponse {
    activated: bool,
    error: Option<String>,
    instance: Option<LsInstance>,
    license_key: Option<LsLicenseKey>,
    meta: Option<LsMeta>,
}

// ─── Public output type ────────────────────────────────────────────────────

/// Serialized to the frontend in camelCase.  Present for every parseable HTTP
/// response — the frontend inspects `activated` + `httpStatus` to classify.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseActivation {
    pub activated: bool,
    pub error: Option<String>,
    pub http_status: u16,
    pub instance_id: Option<String>,
    pub activation_limit: Option<u32>,
    pub activation_usage: Option<u32>,
    pub license_status: Option<String>,
}

// ─── Pure parse function (unit-tested) ────────────────────────────────────

/// Map a raw LS response body + HTTP status to `LicenseActivation`.
/// Returns `Err` only when the body is not valid JSON — never panics.
///
/// Product-identity guard: when LS reports `activated: true`, the response
/// `meta.variant_id` must be in `WRITERSNOOK_APP_VARIANT_IDS`.  Fail-closed:
/// if `meta` or `variant_id` is absent the product cannot be confirmed, so
/// activation is rejected rather than silently accepted.
pub fn parse_activate_response(body: &str, http_status: u16) -> Result<LicenseActivation, String> {
    let ls: LsResponse = serde_json::from_str(body)
        .map_err(|e| format!("malformed response from license server: {e}"))?;

    if ls.activated {
        let variant_ok = ls
            .meta
            .as_ref()
            .and_then(|m| m.variant_id)
            .map(|vid| WRITERSNOOK_APP_VARIANT_IDS.contains(&vid))
            .unwrap_or(false);
        if !variant_ok {
            return Ok(LicenseActivation {
                activated: false,
                error: Some("This license key is not for WritersNook.".to_string()),
                http_status,
                instance_id: None,
                activation_limit: None,
                activation_usage: None,
                license_status: None,
            });
        }
    }

    Ok(LicenseActivation {
        activated: ls.activated,
        error: ls.error,
        http_status,
        instance_id: ls.instance.map(|i| i.id),
        activation_limit: ls.license_key.as_ref().and_then(|lk| lk.activation_limit),
        activation_usage: ls.license_key.as_ref().and_then(|lk| lk.activation_usage),
        license_status: ls.license_key.and_then(|lk| lk.status),
    })
}

// ─── Instance name helper ──────────────────────────────────────────────────

/// Returns the machine hostname used as the LS `instance_name` field.
/// COMPUTERNAME is always set on Windows; HOSTNAME is the POSIX fallback.
fn get_instance_name() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "WritersNook device".to_string())
}

// ─── Tauri command ─────────────────────────────────────────────────────────

/// POST to the LS activate endpoint and return a parsed `LicenseActivation`.
///
/// Returns `Ok` for any HTTP response that parses as valid LS JSON (including
/// 400 / 404 business errors — the frontend classifies them).
/// Returns `Err(String)` only for transport failures (DNS, offline, timeout).
#[tauri::command]
pub async fn activate_license(license_key: String) -> Result<LicenseActivation, String> {
    let instance_name = get_instance_name();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("failed to build HTTP client: {e}"))?;

    let response = client
        .post("https://api.lemonsqueezy.com/v1/licenses/activate")
        .header("Accept", "application/json")
        .form(&[
            ("license_key", license_key.as_str()),
            ("instance_name", instance_name.as_str()),
        ])
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "License server request timed out. Check your internet connection.".to_string()
            } else {
                format!(
                    "Could not reach the license server. Check your internet connection. ({})",
                    e
                )
            }
        })?;

    let http_status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|e| format!("failed to read license server response: {e}"))?;

    parse_activate_response(&body, http_status)
}

// ─── Unit tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::parse_activate_response;

    #[test]
    fn parse_success_returns_activated_true_with_instance_and_usage() {
        // meta.variant_id must be in WRITERSNOOK_APP_VARIANT_IDS (test-mode 1748920)
        // for activated=true to pass the product-identity guard.
        let body = r#"{
            "activated": true,
            "error": null,
            "instance": {"id": "47596ad9-a811-4ebf-ac8a-03fc7b6d2a17"},
            "license_key": {
                "activation_limit": 3,
                "activation_usage": 1,
                "status": "active"
            },
            "meta": {
                "store_id": 12345,
                "product_id": 67890,
                "variant_id": 1748920
            }
        }"#;
        let result = parse_activate_response(body, 200).expect("should parse success body");
        assert!(result.activated, "activated should be true for a success response");
        assert_eq!(
            result.instance_id,
            Some("47596ad9-a811-4ebf-ac8a-03fc7b6d2a17".to_string()),
            "instance_id should be lifted from instance.id"
        );
        assert_eq!(result.activation_limit, Some(3));
        assert_eq!(result.activation_usage, Some(1));
        assert_eq!(result.license_status, Some("active".to_string()));
        assert_eq!(result.http_status, 200);
        assert!(result.error.is_none(), "error should be None on success");
    }

    #[test]
    fn parse_success_with_live_variant_id_1773908_also_activates() {
        // meta.variant_id 1773908 (live store) must also be accepted.
        let body = r#"{
            "activated": true,
            "error": null,
            "instance": {"id": "b1234567-89ab-cdef-0123-456789abcdef"},
            "license_key": {
                "activation_limit": 5,
                "activation_usage": 2,
                "status": "active"
            },
            "meta": {
                "store_id": 12345,
                "product_id": 67890,
                "variant_id": 1773908
            }
        }"#;
        let result = parse_activate_response(body, 200).expect("should parse success body");
        assert!(result.activated, "activated should be true for live-store variant");
        assert_eq!(
            result.instance_id,
            Some("b1234567-89ab-cdef-0123-456789abcdef".to_string())
        );
        assert_eq!(result.activation_limit, Some(5));
        assert_eq!(result.activation_usage, Some(2));
        assert_eq!(result.http_status, 200);
    }

    #[test]
    fn parse_limit_reached_returns_activated_false_with_verbatim_error() {
        let body = r#"{
            "activated": false,
            "error": "This license key has reached the activation limit.",
            "license_key": {
                "activation_limit": 3,
                "activation_usage": 3,
                "status": "active"
            }
        }"#;
        let result = parse_activate_response(body, 400).expect("should parse limit-reached body");
        assert!(!result.activated, "activated should be false for limit-reached");
        assert_eq!(
            result.error,
            Some("This license key has reached the activation limit.".to_string()),
            "error message should be preserved verbatim"
        );
        assert_eq!(result.http_status, 400);
        assert_eq!(result.activation_limit, Some(3));
        assert_eq!(result.activation_usage, Some(3));
        assert!(result.instance_id.is_none(), "no instance on limit-reached");
    }

    #[test]
    fn parse_not_found_returns_activated_false_404() {
        let body = r#"{
            "activated": false,
            "error": "license_key not found"
        }"#;
        let result = parse_activate_response(body, 404).expect("should parse not-found body");
        assert!(!result.activated, "activated should be false for not-found");
        assert_eq!(
            result.error,
            Some("license_key not found".to_string()),
            "error message should be preserved verbatim"
        );
        assert_eq!(result.http_status, 404);
        assert!(result.instance_id.is_none(), "no instance_id on 404");
        assert!(result.activation_limit.is_none(), "no activation_limit on 404");
    }

    #[test]
    fn parse_malformed_json_returns_err_not_panic() {
        let result = parse_activate_response("not valid json {{{", 200);
        assert!(result.is_err(), "malformed JSON must return Err, not panic");
        let msg = result.unwrap_err();
        assert!(
            msg.contains("malformed"),
            "error message should mention 'malformed', got: {msg}"
        );
    }

    #[test]
    fn wrong_variant_id_on_activated_true_is_rejected_with_wrong_product_message() {
        // A key from a different LS store or a different product activates
        // successfully against LS but returns a different variant_id.  The
        // product-identity guard must flip activated to false and return the
        // user-facing wrong-product message.
        let body = r#"{
            "activated": true,
            "error": null,
            "instance": {"id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"},
            "license_key": {
                "activation_limit": 5,
                "activation_usage": 1,
                "status": "active"
            },
            "meta": {
                "store_id": 99999,
                "product_id": 99998,
                "variant_id": 9999999
            }
        }"#;
        let result = parse_activate_response(body, 200).expect("should parse without JSON error");
        assert!(!result.activated, "wrong-variant key must not activate");
        assert_eq!(
            result.error,
            Some("This license key is not for WritersNook.".to_string()),
            "error message must identify the product mismatch"
        );
        assert!(result.instance_id.is_none(), "no instance_id on rejected response");
    }

    #[test]
    fn missing_meta_on_activated_true_is_rejected_fail_closed() {
        // If LS returns activated=true but omits the meta block, we cannot
        // confirm the variant; fail-closed means we reject the activation.
        let body = r#"{
            "activated": true,
            "error": null,
            "instance": {"id": "47596ad9-a811-4ebf-ac8a-03fc7b6d2a17"},
            "license_key": {
                "activation_limit": 3,
                "activation_usage": 1,
                "status": "active"
            }
        }"#;
        let result = parse_activate_response(body, 200).expect("should parse without JSON error");
        assert!(!result.activated, "absent meta must not activate (fail-closed)");
        assert_eq!(
            result.error,
            Some("This license key is not for WritersNook.".to_string()),
        );
    }
}
