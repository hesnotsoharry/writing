---
vendor: "keyring (Rust crate)"
sdkVersion: "4.0.1"
firstWritten: 2026-06-14
lastVerified: 2026-06-14
relatedPaths:
  - src-tauri/src/byok.rs
  - src-tauri/Cargo.toml
notes: "OS keychain storage on Windows (Credential Manager) and macOS (Keychain). v4.0.1 split API + removed feature flags."
---

# keyring gotchas

## 2026-06-14 — v4.0.1: `use_native_store(false)` must be called once at startup or keys don't persist
Source: wave-40, commit e946df6
**Gotcha:** Keyring v4 requires an explicit `keyring::use_native_store(false)` call exactly once during app initialization or there is no active store. Without it, `Entry::set_password()` appears to work (no error) but the key is not persisted to OS keychain — subsequent restarts lose the secret. The silent non-persistence is the footgun.
**Workaround:** Call `keyring::use_native_store(false)` once in app startup (e.g., `src-tauri/src/lib.rs` in the build or setup phase), before any command invokes keyring. The `false` parameter selects the native store (Windows Credential Manager on Windows; Keychain on macOS); calling it with `true` (in-memory store) is only for testing.
**Why:** Keyring v4 changed the initialization model from v3's lazy static. The store selection is now explicit and must happen before any Entry operations. The crate provides no default, so omitting the call leaves the store uninitialized.

## 2026-06-14 — v4.0.1: v3 feature flags (`windows-native`, etc.) removed; backends auto-select per target
Source: wave-40, commit e946df6
**Gotcha:** Keyring v3 used feature flags (`--features windows-native`, `--features macos-native`) to select platform backends. v4.0.1 removed all feature flags. Running `cargo add keyring --features windows-native` on v4 fails with "no features available." Platform selection is now automatic via Cargo's target triple.
**Workaround:** Use `keyring = "4"` with NO features specified in `Cargo.toml`. The crate auto-includes `windows-native-keyring-store` on Windows targets and `keyring-core` (the Entry API). No explicit feature selection needed.
**Why:** Keyring v4 simplifies the API surface and reduces compile-time decision points. The platform backend is determined by `cfg(target_os)` at compile time.

## 2026-06-14 — Keyring API: `Entry::new(service, user)`, `set_password`, `get_password`, `delete_credential`
Source: wave-40, commit e946df6
**Gotcha:** Keyring v4's Entry API is sync, not async. Calling these from async Tauri commands without blocking them will deadlock the runtime or panic. Additionally, all Entry calls return `Result<_, keyring_core::Error>`, and the `NoEntry` variant is the happy path for "key not set" (not an error condition in the user-facing sense, but an Err in Rust).
**Workaround:** Wrap all Entry calls (set, get, delete) in `tokio::task::spawn_blocking()` when called from async Tauri commands. Handle the NoEntry error explicitly: `Entry::get_password().map_err(|e| match e { keyring_core::Error::NoEntry => None, _ => Some(e) })` or similar.
**Why:** Keyring uses blocking syscalls (Windows DPAPI, Keychain APIs) that cannot be async. Tauri commands are async by default; blocking without `spawn_blocking` causes runtime issues.

## 2026-06-14 — Windows Credential Manager target-name format and 20-credential app limit
Source: wave-40, commit e946df6
**Gotcha:** On Windows, credentials stored via keyring are visible in Control Panel → Credential Manager → Windows Credentials with a target-name in the format `{user}.{service}`. For a `Entry::new("com.coles.writing", "byok-anthropic")`, the target name appears as `byok-anthropic.com.coles.writing`. The OS imposes a limit of ~20 stored credentials per app and ~32KB per credential value. Hitting the limit silently fails (`set_password()` returns an error).
**Workaround:** Verify stored keys via `cmdkey /list | grep <pattern>` in PowerShell (the secret value is not displayed, by design — only the target-name is shown). Monitor the credential count and delete old/test credentials manually or via `Entry::delete_credential()` if approaching the limit. For large secrets (>32KB), the architecture needs rethinking (e.g., a small token in keychain + larger secret elsewhere).
**Why:** Windows Credential Manager is a generic credential store shared across all apps on the user's account. Limits exist to prevent per-app exhaustion.

## 2026-06-14 — Secret-leak discipline: error messages must never return raw keyring errors to JavaScript
Source: wave-40, commit e946df6
**Gotcha:** Keyring's `Error` type contains diagnostic context. If a Rust command returns `Err(keyring_core::Error)` directly to JavaScript (via `tauri::ipc::invoke`), the error's `Display` impl may leak platform-specific details or, in some cases, fragments of the secret if the underlying OS call logged it. JavaScript error handlers that assume the message is safe for user display become a leak vector.
**Workaround:** In every keyring command, catch `keyring_core::Error` and map it to a fixed, application-level error string before returning: `Entry::get_password().map_err(|_| "Failed to retrieve key from keychain — restart the app and try again")`. Never serialize the raw keyring error. For API-key-specific errors (Anthropic 401/429), map those in the same command and return a fixed-string like "Invalid API key — check Settings" (never include the key, its length, or partial content).
**Why:** Keyring wraps OS-level credential APIs, which may log or return diagnostic text. The app's responsibility is to provide zero-secret error surfaces.
