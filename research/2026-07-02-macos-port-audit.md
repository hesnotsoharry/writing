---
promoted-from: ~/.claude/plans/macos-port-audit-glm.md (W55 planning session)
promoted-on: 2026-07-02
wave: 55 (macOS-prep)
kind: research memo (GLM-authored portability audit)
---

Permission deny rule "ToolSearch" matches no known tool — check for typos.
⚠ claude.ai connectors are disabled because ANTHROPIC_API_KEY or another auth source is set and takes precedence over your claude.ai login · Unset it to load your organization's connectors
I have full coverage now. All `windows` crate usage in Rust is `#[cfg(windows)]`-gated (compiles clean on mac), keybindings use the cross-platform `metaKey || ctrlKey` idiom, and no npm script is powershell-bound. The remaining concerns cluster in the custom title bar, the publish pipeline, the updater manifest, the keyring init, and the WebView2-specific dev smoke harness. Writing the audit report.

---

# WritersNook — macOS portability audit (read-only)

**Surface area declared:** Read `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` (grep only), `src-tauri/src/{lib,main,byok}.rs` in full; grepped (not full-read) `byok_engine.rs`, `byok_openai.rs`, `byok_local.rs`, `license.rs`, `grammar.rs`, `local_endpoint.rs` for OS/path/env patterns; read `src-tauri/capabilities/{default,desktop}.json`; read `publish.ps1`; read `src/shell/{WindowControls,TitleBar}.tsx`, `src/App.keybindings.ts`, `src/storybible/fullEntry/portraitService.ts`; grepped `src/` for ctrlKey/metaKey/platform/backslash/APPDATA/process.env; read `.claude/vendor-gotchas/tauri.md`. **Did NOT read:** the marketing/ tree (out of scope — separate deployment), individual roadmap/wave files, the full `byok_*`/`license`/`local_endpoint` bodies beyond OS-pattern grep.

**Verdict on the 8 areas:** (1) updater manifest BLOCKER; (2) Rust is clean (OK); (3) custom title bar is mac-UX-wrong (ADAPT); (4) shortcuts already portable (OK); (5) paths portable (OK); (6) publish.ps1 fully Windows-bound (BLOCKER for the release pipeline, not the build); (7) dev smoke harness is WebView2-only (ADAPT); (8) deps are mac-compilable with one keyring verify item.

| # | File:line | Finding | Class | Fix sketch |
|---|---|---|---|---|
| 1 | `publish.ps1:125-134` | `latest.json` manifest emits **only** `windows-x86_64`. Mac clients polling the updater find no platform key → auto-update silently no-ops. | **BLOCKER** | Add `darwin-aarch64` + `darwin-x86_64` entries (mac artifact = signed `.app.tar.gz` + `.sig`, not NSIS). |
| 2 | `publish.ps1:46-50` | `signtool.exe` resolved from `C:\Program Files (x86)\Windows Kits\...` — Authenticode is Windows-only. | **BLOCKER** (pipeline) | Mac signing is a separate path: `codesign --deep --options runtime` + `xcrun notarytool submit` + `stapler`. Needs a parallel sh/script, not a branch in this file. |
| 3 | `publish.ps1:30-31,94-98` | Azure Code Signing `dlib` + Authenticode `signCommand` overlay — entire Authenticode chain is Windows-bound. | **BLOCKER** (pipeline) | Mac uses an Apple Developer ID certificate + notarization; the `bundle.macOS.signingIdentity` config + a notarytool post-step. Not reusable cross-OS. |
| 4 | `publish.ps1:112-116` | Artifact discovery globs `*_<ver>_*-setup.exe` / `.exe.sig` (NSIS). Mac produces `.dmg` and `.app.tar.gz`. | **BLOCKER** (pipeline) | Branch on OS: mac path looks for `*.app.tar.gz` + `.sig` for the updater, plus `.dmg` for direct download. |
| 5 | `publish.ps1:160-163` | R2 stable-name upload hardcodes `WritersNook-Setup.exe`. Mac download artifact is `WritersNook.dmg` (or `.app.tar.gz`). | ADAPT | Per-OS stable name; keep the versioned archive name as-is. |
| 6 | `publish.ps1` (whole) | PowerShell end-to-end; no mac build host can run it. | ADAPT | Stand up a mac-native pipeline (e.g. `publish.sh` or CI matrix). Out-of-scope for this audit per the brief — flagged for the design worker. |
| 7 | `src-tauri/tauri.conf.json:43-48` | `bundle.windows.nsis` only; **no `bundle.macOS` block** (no `signingIdentity`, no `hardenedRuntime`, no `entitlements`). | ADAPT | Add `bundle.macOS` for distribution signing. Build itself succeeds without it (unsigned `.app` runs locally). |
| 8 | `src-tauri/tauri.conf.json:36-42` | Icon set **already includes `icon.icns`**. | OK | No change. |
| 9 | `src-tauri/tauri.conf.json:19,34` | `bundle.targets: "all"` + `createUpdaterArtifacts: true`. | OK | Builds mac targets and updater artifacts natively. |
| 10 | `src-tauri/tauri.conf.json:19` + `src/shell/WindowControls.tsx:16-38` + `src/shell/TitleBar.tsx:270` | `decorations: false` removes **OS traffic lights on mac**; app renders its own min/max/close cluster in the **top-right**. Mac convention is top-left traffic lights (close/minimize/zoom). Functional but mac-UX-wrong, and mac zoom (green button) has different fullscreen/tile semantics than `toggleMaximize`. | ADAPT | Gate `decorations` + `WindowControls` render on platform: on mac set `decorations: true` (keep native lights) and/or move controls left; rewire "maximize" to mac zoom behavior. |
| 11 | `src-tauri/src/lib.rs:55-122` | All DWM/HWND/border-color code is `#[cfg(windows)]`-gated; `set_border_color` has an explicit `#[cfg(not(windows))]` no-op arm; invoked unconditionally from the frontend theme hook but safely no-ops on mac. | OK | Already portable — the cleanest part of the codebase. |
| 12 | `src-tauri/src/lib.rs:156` | `keyring::use_native_store(false)` called once at startup. **keyring v4 changed store-init semantics** — verify the mac Keychain backend actually engages with this call; if v4 falls back to an in-memory/mock store on mac, **BYOK + license keys won't persist across restarts** (silent). | ADAPT (verify) | Confirm against keyring v4 docs/CHANGELOG that `use_native_store(false)` selects the real macOS Security-framework backend; the argument name vs. intent is ambiguous in-code. Cannot assert behavior without checking. |
| 13 | `src-tauri/Cargo.toml:41-48` | `tauri-plugin-updater` gated `cfg(not(any(target_os="android","ios")))` → **compiles on mac**. `windows` + `raw-window-handle` gated `cfg(windows)` → excluded from mac build. | OK | Dep graph is mac-clean. |
| 14 | `src-tauri/src/lib.rs:34` | `backup_database` resolves source via `app_config_dir().join("writing.db")` — Tauri path API → `~/Library/Application Support/com.coles.writing/writing.db` on mac. | OK | Portable. |
| 15 | `src-tauri/src/lib.rs:130-134` | Debug-only `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`. WebView2 is Windows-only; on mac WKWebView has **no CDP**, so the `tauri-devtools` MCP agent-driven smoke harness can't attach. | ADAPT (dev tooling) | Harmless at runtime (env var ignored on mac), but the smoke harness needs a mac-equivalent debug attach (Safari WKWebView remote inspector or a different mechanism) — flagged in the existing follow-up `roadmap/follow-ups/2026-06-15-agent-driven-ui-smoke-harness.md`. |
| 16 | `src/App.keybindings.ts:66`, `src/features/inbox/Inbox.tsx:55`, `src/features/ai/AssistantPanel.parts.tsx:294` | Every mod-key check uses `e.metaKey || e.ctrlKey` — the correct cross-platform idiom (Cmd on mac, Ctrl on Win/Linux). Tooltip hints in `TitleBar.tsx` use ⌘ symbols. | OK | Already portable. |
| 17 | `src/storybible/fullEntry/portraitService.ts:33-35,64-73` | `normalizeAssetDir` (backslash→forward) is a no-op on mac; `BaseDirectory.AppData` resolves to `~/Library/Application Support/...` on mac. | OK | Portable. |
| 18 | `src-tauri/tauri.conf.json:28` | `assetProtocol.scope: ["$APPDATA/portraits/**"]` — `$APPDATA` is a Tauri path var, resolves cross-platform. | OK | Portable. |
| 19 | `src/features/export/exportCollect.ts:9` | `ILLEGAL_CHARS = /[\\/:*?"<>|]/g` for filename sanitization — these are **Windows**-illegal chars; on mac `\`, `<`, `>`, `|`, `:`, `?` are legal. Over-restrictive but non-breaking (just disallows chars mac would permit). | OK | No functional issue; optionally relax on mac if users report it. |
| 20 | `package.json:6-17` | All npm scripts (`dev`/`build`/`test`/`lint`/`eval`) are cross-platform (vite/tsc/vitest/eslint/tsx). **No `.ps1`/`.bat`/`.cmd` wired into npm scripts** — `publish.ps1` is invoked directly, not via npm. | OK | Dev loop runs on mac unchanged. |
| 21 | `package.json` deps + `Cargo.toml` deps | No native node-gyp modules in production deps (`sql.js` is WASM, dev-only). Rust deps (`harper-core`, `reqwest`, `tokio`, `keyring`, `tauri-plugin-*`) all have mac targets. | OK | Should `cargo build` + `npm install` clean on mac. |

### Summary (verdict + 3 biggest items)

**Overall:** The **app itself is largely mac-portable** — Rust platform code is cleanly `cfg`-gated, paths use Tauri abstractions, shortcuts already use the `metaKey||ctrlKey` idiom, and icons/bundle targets are mac-ready. The **release/update pipeline and the chrome UX are the real deltas.** Three biggest:

1. **`publish.ps1` is entirely Windows-bound** (rows 1–6): latest.json emits only `windows-x86_64`, signing is Authenticode/signtool, artifacts are NSIS `.exe`. Mac auto-update + signed distribution need a parallel mac-native pipeline (codesign + notarytool + `.app.tar.gz`/`.dmg` + `darwin-*` manifest keys). This is the largest work item and is explicitly out-of-scope for this audit (the design worker owns it) — but it's the gating blocker for shipping mac updates.
2. **Custom title bar + `decorations: false` is mac-UX-wrong** (row 10): removes native traffic lights and renders Windows-style controls top-right; mac users expect top-left lights and different zoom semantics. Needs a platform conditional (`decorations: true` on mac, or repositioned controls + native zoom).
3. **`keyring::use_native_store(false)` semantics on mac Keychain need verification** (row 12): if keyring v4 doesn't engage the macOS Security-framework backend under this call, BYOK + license keys silently fail to persist across restarts. Cannot assert from code alone — verify against keyring v4 docs before trusting.

### Open questions (couldn't determine from read alone)
- **keyring v4 `use_native_store(false)` mac behavior** (row 12) — needs CHANGELOG/docs check; flagged as ADAPT-verify, not asserted.
- **Native macOS menu bar**: `lib.rs` has no `.menu()` call; Tauri 2 builds a default native menu on mac. Whether the app needs a custom menu (and whether the existing ⌘-shortcuts collide with default menu items like `Cmd+,`→Preferences) is only visible at mac runtime — not a code blocker, but a UX item to confirm on first mac build.
- **`bundle.macOS` distribution config** (row 7): whether an Apple Developer ID + notarization credential path already exists outside this repo (Cole may have one) — not answerable from the repo.
- **Dev smoke on mac** (row 15): the CDP/9222 harness is WebView2-only; the mac-equivalent WKWebView debug path (Safari inspector / `inspect`) is an open tooling question tracked by the cited follow-up, not resolved here.
