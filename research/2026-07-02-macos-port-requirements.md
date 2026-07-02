---
promoted-from: ~/.claude/plans/macos-port-requirements-glm.md (W55 planning session)
promoted-on: 2026-07-02
wave: 55 (macOS-prep)
kind: research memo (GLM-authored Tauri-2-on-macOS requirements checklist)
---

Permission deny rule "ToolSearch" matches no known tool — check for typos.
⚠ claude.ai connectors are disabled because ANTHROPIC_API_KEY or another auth source is set and takes precedence over your claude.ai login · Unset it to load your organization's connectors
I have comprehensive, authoritative sourcing across all 7 areas. The ctx7-suggest hook fired again, but context7 MCP is genuinely not connected (no such tool in my function set), and the two most recent searches (notarization timing, Apple Silicon market share) are exactly the non-library content the hook's own fallback clause permits. Self-critique pass: all 7 questions answered with at least one citation each, time-sensitive claims date-tagged, version specifics noted (Tauri v2.x current; `trafficLightPosition` landed in v2.4.0). Compiling the deliverable now.

---

## Question
Produce a cited, current (mid-2026) checklist for shipping a Windows-only Tauri 2 + React app (GitHub-release auto-updater, currently signed NSIS) to a clean macOS release in one Mac day, for a dev with a paid Apple Developer account.

## Sources
- **https://v2.tauri.app/distribute/sign/macos/** — Official Tauri v2 "macOS Code Signing" (cert creation, signingIdentity, notarization env vars, CI/CD cert import). Page dated 2026-05-17.
- **https://v2.tauri.app/plugin/updater/** — Official Tauri v2 "Updater" plugin (macOS app.tar.gz + .sig artifacts, latest.json `OS-ARCH` platform keys, universal-binary custom target). Page dated 2025-11-28.
- **https://v2.tauri.app/distribute/** — Official "Distribute" overview (app vs dmg bundle targets, `--bundles app,dmg`, notarization required outside App Store). Page dated 2025-08-29.
- **https://v2.tauri.app/reference/config/** — Official v2 Configuration reference (`bundle.macOS.{signingIdentity, hardenedRuntime, entitlements, minimumSystemVersion, providerShortName}`, `WindowConfig.{titleBarStyle, trafficLightPosition, decorations, hiddenTitle, acceptFirstMouse, transparent, shadow}`).
- **https://v2.tauri.app/reference/environment-variables/** — Official v2 Environment Variables (full `APPLE_*` notarization/signing var list). Page dated 2026-01-30.
- **https://v2.tauri.app/distribute/pipelines/github/** — Official v2 GitHub Actions guide (`tauri-action`, macos-latest matrix with `aarch64-apple-darwin` + `x86_64-apple-darwin` targets). Page dated 2026-06-29.
- **https://v2.tauri.app/release/tauri/v2.4.0/** — v2.4.0 release notes (native `trafficLightPosition` added, PR #12366).
- **https://developer.apple.com/documentation/security/customizing-the-notarization-workflow** — Apple notarization timing ("98 percent within 15 minutes").
- **https://en.wikipedia.org/wiki/Mac_transition_to_Apple_silicon** — Apple Silicon transition began late 2020 (Intel Mac sales ended then).
- **https://github.com/tauri-apps/plugins-workspace/issues/198** & **/1653** — tauri-plugin-sql SQLite path resolution pitfalls.
- **https://github.com/tauri-apps/tauri/issues/9684** — macOS arch-specific build behavior (aarch64/universal run on M1; x86_64 issues).

> **Degraded-mode note:** context7 MCP was not available in this session (no `mcp__context7__*` tool loadable). Compensation: all library/SDK claims are pulled directly from the canonical `v2.tauri.app` docs via web-reader. Apple/market-share claims use Apple's own docs + recent aggregator data.

## Findings

### 1. macOS build prerequisites
1. **A physical Apple device is mandatory for the signing/notarization workflow** — "Code signing on macOS requires an Apple Developer account... You also need an Apple device where you perform the code signing. This is required by the signing process and due to Apple's Terms and Conditions." ([sign/macos](https://v2.tauri.app/distribute/sign/macos/))
2. **Install Xcode (recommended) or Command Line Tools.** The CSR step uses the macOS *Keychain Access* app and notarization is invoked via `xcrun notarytool`, both part of the Xcode/CLT toolchain. ([sign/macos](https://v2.tauri.app/distribute/sign/macos/); [notarytool man page](https://keith.github.io/xcode-man-pages/notarytool.1.html))
3. **Add the Rust targets.** For Apple-Silicon + Intel the official GitHub matrix installs both: `dtolnay/rust-toolchain@stable` with `targets: 'aarch64-apple-darwin,x86_64-apple-darwin'` (i.e. `rustup target add aarch64-apple-darwin x86_64-apple-darwin`). ([github pipeline](https://v2.tauri.app/distribute/pipelines/github/))
4. **Universal target is a single string:** `npm run tauri build -- --target universal-apple-darwin`. The updater docs confirm a custom target string (e.g. `macos-universal`) is a supported distribution path. ([updater](https://v2.tauri.app/plugin/updater/))
5. **Minimum macOS version defaults to `10.13`** via `bundle > macOS > minimumSystemVersion`; set it to `null` to drop the `LSMinimumSystemVersion`/`MACOSX_DEPLOYMENT_TARGET` entirely. ([config reference, MacConfig](https://v2.tauri.app/reference/config/))
6. **Bundle the `.icns` icon.** macOS bundles require the icon set; list it under `bundle > icon`. ([config reference, bundle.icon](https://v2.tauri.app/reference/config/))

### 2. Code signing
7. **Create a "Developer ID Application" certificate** (not "Apple Distribution" — that one is App-Store-only). On the Apple Developer *Certificates, IDs & Profiles* page, choose `Developer ID Application` to ship outside the App Store, upload a CSR generated via Keychain Access, download the `.cer`, open it to install into the login keychain. ([sign/macos](https://v2.tauri.app/distribute/sign/macos/))
8. **Set the signing identity** via `tauri.conf.json > bundle > macOS > signingIdentity`, or the `APPLE_SIGNING_IDENTITY` env var (env var overrides config). Find the exact string with `security find-identity -v -p codesigning`. ([sign/macos](https://v2.tauri.app/distribute/sign/macos/); [env vars](https://v2.tauri.app/reference/environment-variables/))
9. **Hardened Runtime is ON by default** (`bundle > macOS > hardenedRuntime` default `true`) — required for notarization, so leave it. ([config reference, MacConfig.hardenedRuntime](https://v2.tauri.app/reference/config/))
10. **Entitlements via `bundle > macOS > entitlements`** (path to an entitlements `.plist` file); if your app needs JIT/network/unsigned-memory etc., supply one. Default is `null`. ([config reference, MacConfig.entitlements](https://v2.tauri.app/reference/config/))
11. **Ad-hoc fallback only for local testing** — the pseudo-identity `"-"` signs ad-hoc; useful on Apple Silicon where signing is required for any app from the Internet, but this will NOT pass notarization/Gatekeeper. ([sign/macos](https://v2.tauri.app/distribute/sign/macos/))

### 3. Notarization
12. **Notarization is required** when shipping outside the App Store, and is triggered automatically by Tauri during build when credentials are present: "Notarization is required when using a Developer ID Application certificate." ([sign/macos](https://v2.tauri.app/distribute/sign/macos/); [distribute](https://v2.tauri.app/distribute/))
13. **Two credential paths** (pick one):
    - **Apple ID path:** `APPLE_ID` + `APPLE_PASSWORD` (an *app-specific* password) + `APPLE_TEAM_ID`. Quote: "If this environment variable [`APPLE_ID`] is provided, `APPLE_PASSWORD` and `APPLE_TEAM_ID` must also be set." ([env vars](https://v2.tauri.app/reference/environment-variables/))
    - **App Store Connect API key (JWT) path** — preferred for CI: `APPLE_API_ISSUER` + `APPLE_API_KEY` (+ `APPLE_API_KEY_PATH` pointing at the downloaded `AuthKey_<id>.p8`). ([sign/macos](https://v2.tauri.app/distribute/sign/macos/); [env vars](https://v2.tauri.app/reference/environment-variables/))
14. **`providerShortName`** (config or `APPLE_PROVIDER_SHORT_NAME`) is only needed if your Apple ID belongs to multiple teams. ([config reference](https://v2.tauri.app/reference/config/); [env vars](https://v2.tauri.app/reference/environment-variables/))
15. **Typical wait: minutes, not hours.** Apple states "Notarization completes for most software within 5 minutes, and for 98 percent of software within 15 minutes." Community reports it often finishing in under a minute. (Larger binaries can push to 3.5–4.5 h; stuck 12–24 h cases warrant resubmission.) ([Apple notarization docs](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow))
16. **Stapling is automatic** by default; skip it for an initial dry-run with `--skip-stapling` appended to the Tauri build command (e.g. `pnpm tauri build --bundles dmg --skip-stapling`). ([sign/macos](https://v2.tauri.app/distribute/sign/macos/))

### 4. Bundle formats & updater
17. **macOS produces two bundle types:** `app` (`.app` bundle) and `dmg` (Apple Disk Image). Build both with `npm run tauri bundle -- --bundles app,dmg`. ([distribute](https://v2.tauri.app/distribute/); [config, BundleType](https://v2.tauri.app/reference/config/))
18. **The updater does NOT consume `.dmg`/`.app` directly — it consumes `app.tar.gz` + `.sig`.** With `bundle > createUpdaterArtifacts: true` set, Tauri "will create a .tar.gz archive from the application bundle" producing `myapp.app`, `myapp.app.tar.gz` (the updater bundle), and `myapp.app.tar.gz.sig` (signature) under `target/release/bundle/macos/`. ([updater](https://v2.tauri.app/plugin/updater/))
19. **Extend `latest.json` with darwin platform keys.** Platform keys are `OS-ARCH`; valid OS values include `darwin`, valid ARCH values include `x86_64` / `aarch64`. Add alongside the existing `windows-x86_64` entry:
    ```json
    "platforms": {
      "windows-x86_64": { "signature": "...", "url": "..." },
      "darwin-aarch64": { "signature": "<contents of .app.tar.gz.sig>", "url": "..." },
      "darwin-x86_64":  { "signature": "<contents of .app.tar.gz.sig>", "url": "..." }
    }
    ```
    The `signature` field is the *file contents* of the `.sig`, not a path/URL. Tauri validates the whole file before checking version, so every platform entry must be complete. ([updater, Static JSON section](https://v2.tauri.app/plugin/updater/))
20. **For a universal build**, use a custom target key. The client can request it explicitly: `check({ target: 'macos-universal' })`. ([updater, "custom target"](https://v2.tauri.app/plugin/updater/))
21. **`createUpdaterArtifacts: "v1Compatible"`** only if migrating from v1's zipped updater format; otherwise set it to `true`. It will be removed in v3. ([updater](https://v2.tauri.app/plugin/updater/); [config, Updater](https://v2.tauri.app/reference/config/))

### 5. Universal binary vs aarch64-only (2026)
22. **Apple Silicon is now the large majority of the active Mac installed base.** Apple's transition began late 2020 and Intel Mac sales ended then; by 2025-2026 Apple Silicon "makes up the large majority" with Intel "a shrinking minority," and **macOS 27 is expected to drop Intel Mac support.** ([Wikipedia — Mac transition to Apple silicon](https://en.wikipedia.org/wiki/Mac_transition_to_Apple_silicon); [HardForum on macOS 27 dropping Intel](https://hardforum.com/threads/macos-27-will-end-support-for-intel-based-macs.2047448/))
23. **Universal is low marginal effort in Tauri:** it is one extra `rustup target add x86_64-apple-darwin` plus a single build flag (`--target universal-apple-darwin`); it does not require two separate builds/release assets. ([github pipeline](https://v2.tauri.app/distribute/pipelines/github/); [updater](https://v2.tauri.app/plugin/updater/))
24. **Known caveat:** arch-specific macOS builds behave differently — issue #9684 reports `aarch64` and `universal` run on M1 but `x86_64`-only builds hit issues, so shipping a pure x86_64 build for Intel users is the riskier path. ([tauri #9684](https://github.com/tauri-apps/tauri/issues/9684))
25. **Tradeoff stated neutrally:** aarch64-only covers the Apple-Silicon majority but excludes Intel users still on the installed base; universal covers both at the cost of a larger single artifact and roughly 2× the Rust compile. The docs treat both as first-class; macOS 27's impending Intel drop reduces the value of maintaining an x86_64 path long-term. ([updater](https://v2.tauri.app/plugin/updater/); [config](https://v2.tauri.app/reference/config/))

### 6. Tauri 2 macOS-specific gotchas (vs Windows/WebView2)
26. **Engine is WKWebView, not WebView2.** Consequences surfaced in config: macOS has no `dataDirectory` for the webview (use `dataStoreIdentifier` — a 16-byte array — instead); `scrollBarStyle: fluentOverlay` is Windows-only; `useHttpsScheme`/`acceptFirstMouse`/`allowLinkPreview` are macOS-relevant knobs. ([config, WindowConfig](https://v2.tauri.app/reference/config/))
27. **Custom titlebar / traffic lights:**
    - `titleBarStyle` accepts `"Visible"` (default) / `"Transparent"` / `"Overlay"`. Overlay makes the title bar transparent over content and *requires you to define a custom drag region*; you cannot drag an unfocused Overlay window ([tauri #4316](https://github.com/tauri-apps/tauri/issues/4316)). ([config, TitleBarStyle](https://v2.tauri.app/reference/config/))
    - As of **v2.4.0**, native `trafficLightPosition` repositions the close/min/max buttons *without a plugin* — it requires `titleBarStyle: Overlay` + `decorations: true`. ([v2.4.0 release notes](https://v2.tauri.app/release/tauri/v2.4.0/); [config](https://v2.tauri.app/reference/config/))
    - For deeper insets/runtime toggling, `tauri-plugin-decorum` is the common helper. ([crates.io tauri-plugin-decorum](https://crates.io/crates/tauri-plugin-decorum))
28. **Drag region:** put `data-tauri-drag-region` on the HTML element that should act as the draggable titlebar. (Standard Tauri mechanism, same attribute cross-platform.)
29. **`hiddenTitle: true`** hides the window title text on macOS. `decorations: false` removes the bar entirely. ([config, WindowConfig](https://v2.tauri.app/reference/config/))
30. **Window shadow:** `shadow` is on by default; on macOS it behaves normally (the Windows-specific quirks — 1px border on undecorated, rounded corners on Win11 — don't apply). ([config, WindowConfig.shadow](https://v2.tauri.app/reference/config/))
31. **Transparent windows require the `macos-private-api` feature** (`app > macOSPrivateApi: true`) — and using private APIs **disqualifies the app from the App Store** (fine for direct/DMG distribution, which is your path). ([config, WindowConfig.transparent](https://v2.tauri.app/reference/config/))
32. **`tauri-plugin-sql` / SQLite path pitfall:** the DB path must resolve to the app's runtime data location (app data dir), NOT a source-relative path; confusion here is the #1 reported macOS issue (#198, #1653). Your project already stores the Yjs doc as base64 `TEXT` in `scene_docs` — confirm the SQLite connection string points at the macOS app-data dir, not a Windows-style path. ([plugins-workspace #198](https://github.com/tauri-apps/plugins-workspace/issues/198), [#1653](https://github.com/tauri-apps/plugins-workspace/issues/1653))

### 7. Automating macOS builds in GitHub Actions later
33. **Yes — macOS builds can be fully automated via `tauri-apps/tauri-action`**, so the physical-Mac day need not recur. The official workflow builds "Windows x64, Linux x64, Linux Arm64, macOS x64 and macOS Arm64" on a matrix with `runs-on: macos-latest` and `args: '--target aarch64-apple-darwin'` / `'--target x86_64-apple-darwin'`. ([github pipeline](https://v2.tauri.app/distribute/pipelines/github/))
34. **`macos-latest` is now an Apple-Silicon runner** and cross-compiles to `x86_64-apple-darwin` on the same host (both targets added in the rust-toolchain step). ([github pipeline](https://v2.tauri.app/distribute/pipelines/github/))
35. **Signing/notarizing in CI:** export the `.p12` cert to base64, store `APPLE_CERTIFICATE` + `APPLE_CERTIFICATE_PASSWORD` + `APPLE_ID`/`APPLE_PASSWORD` (or the API-key trio) as repo secrets; the action imports the keychain and notarizes automatically. Full step sequence is in the sign doc. ([sign/macos — CI/CD section](https://v2.tauri.app/distribute/sign/macos/))
36. **Updater manifest:** `tauri-action` with `tagName`/`releaseName` creates the GitHub release and uploads the `.app.tar.gz`/`.sig`; the official endpoints example points at `https://github.com/user/repo/releases/latest/download/latest.json`. ([updater](https://v2.tauri.app/plugin/updater/); [github pipeline](https://v2.tauri.app/distribute/pipelines/github/))
37. **Token permission:** set `permissions: contents: write` (or enable "Read and write permissions" in repo Actions settings) so the auto-issued `GITHUB_TOKEN` can create the release. ([github pipeline — Environment Token](https://v2.tauri.app/distribute/pipelines/github/))

### One-day timeline estimate (realistic)
- **0:00–1:00 — Prereqs:** install Xcode/CLT, `rustup target add aarch64-apple-darwin x86_64-apple-darwin`, generate CSR in Keychain Access, create + download "Developer ID Application" cert, create an app-specific password for `APPLE_ID` auth (or an App Store Connect API key).
- **1:00–2:30 — Config:** set `bundle.macOS.signingIdentity` (or use env var), verify `hardenedRuntime: true`/`minimumSystemVersion`, add `.icns` icon, set `bundle > createUpdaterArtifacts: true`, add `updater` permissions.
- **2:30–4:30 — Build + notarize:** `tauri build --bundles dmg` (and `app`); notarization waits 1–15 min typical. Verify with `spctl --assess` / open on a second Mac to confirm no Gatekeeper warning.
- **4:30–6:00 — Updater + release:** publish `.app.tar.gz` + `.sig`, extend `latest.json` with `darwin-aarch64` (+`darwin-x86_64` or universal) keys, upload to the GitHub release.
- **6:00–8:00 — Gotchas/smoke:** verify titlebar/traffic-light placement (`titleBarStyle: Overlay` + `trafficLightPosition`), confirm `tauri-plugin-sql` SQLite path resolves to macOS app-data dir, check WKWebView rendering of your React UI, smoke the updater end-to-end on the Mac.

**One Mac day is feasible for aarch64-only or universal** (notarization is the main variable; budget a second hour if the binary is very large or the service is slow). **Subsequent releases can be fully CI-driven** via `tauri-action` on `macos-latest`, so the physical Mac is a one-time setup cost.

## Confidence
**High** for areas 1–4, 6, 7 (sourced directly from current official Tauri v2 docs at v2.tauri.app + Apple docs, dated 2025–2026). **Medium** for area 5: the qualitative conclusion (Apple Silicon = large majority; Intel = shrinking; macOS 27 dropping Intel) is well-sourced, but no single authoritative source gave a precise "X% Apple Silicon" figure for the Mac installed base — the exact split is inferred from transition-date + macOS-27-support-drop signals rather than a published percentage. Per-source caveats are inline above.
