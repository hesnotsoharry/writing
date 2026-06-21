---
id: 0011
title: Key storage — keyring crate v4, key stays in Rust
status: accepted
decided-in: wave-40
promoted-during: wave-40
date: 2026-06-13
durable: true
---

# Decision 0011: Key storage — keyring crate v4, key stays in Rust

**Context:** Where the BYOK Anthropic key persists, given the OS-keychain requirement.

**Pick:** `keyring = "4"` + `keyring-core = "1"` (Windows Credential Manager via auto-pulled `windows-native-keyring-store`), behind custom Tauri commands. Key is read only inside Rust at call time; JS gets a boolean (`byok_has_key`), never the secret. `use_native_store(false)` called once at startup.

**Rationale:** v4 is current (verified `cargo add` → v4.0.1); `tauri-plugin-keyring` (v0.1.0, JS-readable) is younger and its JS-side read API is unnecessary when Rust owns the call. Stronghold is the wrong tool (file vault, deprecated v3). v4 removed v3 feature flags; without `use_native_store` there is no active store (silent non-persistence footgun).

**Consequences:** A new Rust dependency surface; sync keyring calls must run under `spawn_blocking`. macOS Keychain comes free via the same path (future phase).

**Enforcement:** advisory-only; the "key visible in Credential Manager / never in localStorage|SQLite" acceptance criteria are the check.
