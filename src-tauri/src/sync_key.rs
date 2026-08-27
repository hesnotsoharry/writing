//! Sync master-key storage in the OS keychain.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use keyring_core::Entry;

const SERVICE: &str = "com.coles.writing";
const USER: &str = "sync-master-key";
const MASTER_KEY_BYTES: usize = 32;
const INVALID_KEY_ERROR: &str = "Sync master key must be valid base64 encoding exactly 32 bytes";

fn validate_master_key(key_base64: &str) -> Result<(), String> {
    let decoded = STANDARD
        .decode(key_base64)
        .map_err(|_| INVALID_KEY_ERROR.to_string())?;
    if decoded.len() != MASTER_KEY_BYTES {
        return Err(INVALID_KEY_ERROR.to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn sync_set_master_key(key_base64: String) -> Result<(), String> {
    validate_master_key(&key_base64)?;
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let entry = Entry::new(SERVICE, USER)
            .map_err(|_| "Sync keychain entry creation failed".to_string())?;
        entry
            .set_password(&key_base64)
            .map_err(|_| "Failed to store sync master key".to_string())
    })
    .await
    .map_err(|_| "Sync keychain task failed".to_string())?
}

#[tauri::command]
pub async fn sync_get_master_key() -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(|| -> Result<Option<String>, String> {
        let entry = Entry::new(SERVICE, USER)
            .map_err(|_| "Sync keychain entry creation failed".to_string())?;
        match entry.get_password() {
            Ok(key) => Ok(Some(key)),
            // Only a genuine NoEntry means "never paired". Any other failure
            // (locked keychain, backend timeout) must surface as an error: a
            // None here reads as unpaired, the UI offers pairing, and a newly
            // generated key silently overwrites the fleet's master key.
            Err(keyring_core::Error::NoEntry) => Ok(None),
            Err(_) => Err("Sync keychain read failed".to_string()),
        }
    })
    .await
    .map_err(|_| "Sync keychain task failed".to_string())?
}

#[tauri::command]
pub async fn sync_has_master_key() -> Result<bool, String> {
    Ok(sync_get_master_key().await?.is_some())
}

#[tauri::command]
pub async fn sync_clear_master_key() -> Result<(), String> {
    tokio::task::spawn_blocking(|| -> Result<(), String> {
        let entry = Entry::new(SERVICE, USER)
            .map_err(|_| "Sync keychain entry creation failed".to_string())?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
            Err(_) => Err("Failed to clear sync master key".to_string()),
        }
    })
    .await
    .map_err(|_| "Sync keychain task failed".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_base64_encoding_exactly_32_bytes() {
        let key = STANDARD.encode([7_u8; MASTER_KEY_BYTES]);
        assert_eq!(validate_master_key(&key), Ok(()));
    }

    #[test]
    fn rejects_invalid_base64() {
        assert_eq!(
            validate_master_key("not base64!"),
            Err(INVALID_KEY_ERROR.to_string())
        );
    }

    #[test]
    fn rejects_decoded_keys_that_are_not_32_bytes() {
        let short = STANDARD.encode([7_u8; MASTER_KEY_BYTES - 1]);
        let long = STANDARD.encode([7_u8; MASTER_KEY_BYTES + 1]);
        assert_eq!(
            validate_master_key(&short),
            Err(INVALID_KEY_ERROR.to_string())
        );
        assert_eq!(
            validate_master_key(&long),
            Err(INVALID_KEY_ERROR.to_string())
        );
    }
}
