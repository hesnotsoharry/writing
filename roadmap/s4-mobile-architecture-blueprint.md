# S4 mobile architecture blueprint

Status: decision for S4/S5 implementation

Research checked: 2026-08-06

Scope: mobile sync/crypto placement, code sharing, SQLite, and QR pairing

Evidence labels used below:

- **Verified** means a current upstream document, repository source, or the S0 result supports the claim.
- **Judgment** means an architecture recommendation or inference; its acceptance test is named where material.

## Decision

**Choose Option A: run the sync engine, WebSocket, key derivation, and frame encryption in the React Native (RN)/Hermes process.** Keep SQLite and the native binder there too. The editor WebView owns only the open scene's `Y.Doc` and editor UI.

```text
RN / Hermes (foreground app lifetime)
  expo-secure-store -> 256-bit master key
  react-native-quick-crypto -> global WebCrypto
  SyncEngine + RelayProvider -> global WebSocket -> relay
  expo-sqlite -> binder projection + encoded Yjs states
       |                                    ^
       +-- native binder UI                 |
       +-- open-scene bridge (base64 Yjs update batches) -- editor WebView
```

**Judgment:** this puts the app-wide service in the app-wide runtime. Binder browsing does not depend on an invisible editor, the WebView may unmount between scenes, and foreground sync continues on every native screen. App suspension remains explicitly out of scope per the approved [mobile design](../docs/superpowers/specs/2026-08-05-device-sync-mobile-design.md).

## Option A: evidence and real costs

### Crypto and transport

- **Verified:** at the current release (`react-native-quick-crypto` 1.1.6 when checked), its coverage table marks `subtle.deriveBits/HKDF`, raw `subtle.importKey` for both HKDF and AES-GCM, and AES-GCM `encrypt`/`decrypt` as implemented. Its Subtle docs show the same raw-HKDF/SHA-256/256-bit `deriveBits` sequence used by `src/sync/keys.ts`. [Coverage](https://github.com/margelo/react-native-quick-crypto/blob/main/docs/data/coverage.ts), [Subtle API](https://github.com/margelo/react-native-quick-crypto/blob/main/docs/content/docs/api/subtle.mdx), [npm release](https://www.npmjs.com/package/react-native-quick-crypto)
- **Verified:** version 1.x requires RN New Architecture and RN 0.75+; Expo setup needs its config plugin/prebuild and does not work in Expo Go. The locked dev-build workflow and current Expo/RN stack satisfy that constraint. Install the global polyfill in the entry point before importing sync code. [RNQC setup](https://margelo.github.io/react-native-quick-crypto/docs/introduction/complete-setup), [compatibility](https://margelo.github.io/react-native-quick-crypto/docs/introduction/releases)
- **Verified:** RN exposes the web-standard global `WebSocket`, so `src/sync/provider.ts` needs no transport fork. [React Native WebSocket](https://reactnative.dev/docs/global-WebSocket)
- **Judgment:** use the existing WebCrypto code unchanged first; pin the resolved crypto version in `mobile/package-lock.json`. Device tests must prove the exact calls on Android and iOS before accepting the integration.
- Store the master key with `expo-secure-store`, not SQLite or AsyncStorage. **Verified:** it uses Android Keystore-backed encrypted preferences and iOS Keychain. The key is tiny relative to its documented payload caveat. [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)

### Crypto fallback if runtime proof contradicts the docs

Do not build this speculatively. If an exact call fails on either device, add `src/sync/cryptoProvider.ts` and inject a provider into key derivation/frame sealing:

- HKDF-SHA256: `PRK = HMAC(salt, master)`; the required 32-byte output is the first expand block `HMAC(PRK, info || 0x01)`.
- AES-256-GCM: Quick Crypto's Node-style `createCipheriv`/`createDecipheriv`; preserve the v1 wire format by appending the 16-byte auth tag to ciphertext after the 12-byte IV, and splitting it before decrypt.
- Prove cross-provider compatibility with fixed master-key/info/IV/plaintext vectors plus desktop-encrypt/mobile-decrypt and the reverse. Never create a mobile-only wire format.

### Editor bridge

The current engine's `attachLiveDoc` takes an in-process `Y.Doc`; Hermes cannot hold the WebView's object. Add a mobile live-scene port, not a second engine:

- WebView -> RN: merge incremental local Yjs updates for the existing 500 ms persistence window, encode once as base64, and post `{v, type, sceneId, seq, update}`. RN merges/persists first, then emits the protocol `live` update. Flush and await an ACK before scene unmount.
- RN -> WebView: persist a remote update first, then post the same incremental update; the WebView applies it with `SYNC_ORIGIN` so it is not echoed. An epoch replacement sends `replace` and rehydrates from the stored full state.
- A ready handshake, monotonic per-scene sequence, ACK, timeout, and scene-id guard make navigation races observable. If the WebView is absent, SQLite remains canonical and the next mount hydrates from it.
- **Judgment:** one base64 message per debounced batch is a reasonable hop. Base64 adds about one third; typical incremental Yjs updates are small. The S0 50k-word full state was ~340 KB, so its ~453 KB base64 form is a one-time hydrate, not a per-keystroke payload. Add a 50k-word bridge soak because S0 tested WebView-local WebSocket traffic, not this bridge.

## Rejected Option B: engine inside the WebView

This is a genuine alternative, not a bad design in isolation:

- Benefits: current WebCrypto/WebSocket and sync code run unchanged; `attachLiveDoc` receives the real editor `Y.Doc`; live edits never cross RN; no native crypto module.
- Costs: every `DbClient` call becomes typed web->RN RPC with request ids, Promise tracking, error serialization, timeouts, cancellation, and ordering. Meta application is many SQL operations, so transaction boundaries need coarse RPC methods rather than naïve per-statement calls. Native binder reads the same DB through a separate path.
- The engine must live in an app-root WebView that stays mounted while binder screens cover it. Putting it only on the editor route stops sync when that route unmounts.
- **Verified (Android):** `WebView.onPause()` itself does not pause JavaScript, and the default renderer priority remains important regardless of visibility. This makes a mounted hidden WebView plausible on Android, not guaranteed across navigation/component behavior. [Android `onPause`](https://developer.android.com/reference/android/webkit/WebView#onPause()), [renderer priority](https://developer.android.com/reference/android/webkit/WebView#setRendererPriorityPolicy(int,boolean))
- **Verified (iOS):** RN WebView exposes `onContentProcessDidTerminate`; its docs state iOS may terminate the content process independently to reclaim memory. WebKit also throttles timers for inactive pages and may suspend iOS pages. [RN WebView lifecycle](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md#oncontentprocessdidterminate), [WebKit power behavior](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/)
- **Judgment:** no cited API promises uninterrupted execution for a hidden foreground `WKWebView`. Depending on it for binder-time sync adds a lifecycle oracle and recovery machinery solely to avoid the small editor bridge. That trade is wrong for a native-binder app.

## Repository and package layout

**Recommendation: `mobile/` is an independent Expo package with its own `package.json` and lockfile; do not add npm workspaces or move the portable source into a new shared package in S4.**

```text
writing/
  src/sync/                 # one source of truth: protocol, engine, crypto, meta
  src/db/dbClient.ts        # shared interface
  src/db/migrations*.ts     # shared canonical schema history
  mobile/
    package.json + package-lock.json
    metro.config.cjs + app.json + eas.json + tsconfig.json
    editor-web/             # WebView entry/build wrapper; imports existing editor/Yjs code
    src/                    # native shell, Expo adapters, screens, bridge
```

- `mobile/metro.config.cjs` extends `expo/metro-config`, adds the repository root to `watchFolders`, disables hierarchical lookup, and points `nodeModulesPaths` at `mobile/node_modules`. Declare the portable layer's runtime dependencies (`yjs`, `js-base64`) in mobile at the desktop-compatible versions. This prevents a local root install from hiding a clean-EAS dependency bug. **Verified:** Metro requires outside-root source to be visible through `watchFolders` and documents `nodeModulesPaths` for nonstandard dependency locations. [Metro configuration](https://metrobundler.dev/docs/configuration/)
- Add small `mobile/src/shared/` re-export files whose only job is to import the approved root modules. Do not import `engineDefaults.ts`, `keyStorage.ts`, `schema.ts`, or desktop SQLite classes from mobile.
- **Judgment:** workspaces would give Expo automatic Metro configuration, but would also combine install/lockfile topology and hoist native packages into the established desktop package. Expo itself notes monorepo complexity. Manual Metro configuration is lower-friction here and leaves Vite/Vitest/root scripts untouched. [Expo monorepos](https://docs.expo.dev/guides/monorepos/)
- EAS commands run from `mobile/`, but the build archive must include the repository source; inspect the first archive and fail if `src/sync`/`src/db` are absent. **Verified:** EAS monorepo builds require the whole monorepo and app-local EAS files. [EAS monorepos](https://docs.expo.dev/build-reference/build-with-monorepos/)
- One prerequisite portability cut is required: remove `defaultEngineOptions`/the singleton import from `src/sync/engine.ts`; construct/export the desktop singleton in `src/sync/desktopEngine.ts`. Mobile imports the dependency-injected class only. Desktop call sites switch imports; behavior does not change.

## SQLite decision

Use `expo-sqlite`; do not add WatermelonDB, OP-SQLite, or another ORM/native database layer. The first-party Expo API already supplies persistence, async calls, prepared bindings, migrations, and transactions; alternatives add a second schema/query model or native integration without an S4 bottleneck.

- `ExpoDbClient.select<T>` -> `getAllAsync`; `execute` -> `runAsync` and `{rowsAffected: result.changes}`. Narrow `unknown[]` to Expo bindable values and normalize booleans to `0/1`; reject unsupported values rather than coercing silently.
- Run the canonical full `src/db/migrations*.ts`, even though mobile exposes only the v1 subset. Empty unused tables cost little and avoid a divergent mobile migration history.
- Extract `ensureColumn` from Tauri-bearing `src/db/schema.ts` into portable `src/db/ensureColumn.ts`; update migration imports. Mobile must never bundle `@tauri-apps/plugin-sql` or `import.meta.env`.
- Open one database, enable `foreign_keys`, and use WAL on mobile. Desktop's `journal_mode=DELETE` is a workaround for tauri-plugin-sql's pooled read-after-write behavior, not a synced data-format requirement.
- Wrap all pending canonical migrations plus `user_version` stamps in `withExclusiveTransactionAsync`; call journal-mode PRAGMAs before it. **Verified:** ordinary `withTransactionAsync` can absorb concurrent outside queries, while the exclusive API scopes the transaction to its callback; Expo also recommends WAL. [Expo SQLite transactions and PRAGMAs](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- Acceptance: run the full migration suite through real `expo-sqlite` on both platforms, including fresh v0->latest, each historical `user_version`->latest, rollback on injected failure, `$1` and `?` binding, and immediate read-after-write.

## QR pairing

- Desktop: add `uqr` and render its generated SVG/matrix; do not hand-roll QR encoding/masking/error correction. **Verified:** `uqr` is ESM, TypeScript, zero-dependency, tree-shakeable, and renders SVG. [uqr](https://www.npmjs.com/package/uqr)
- Payload: `writersnook://pair?v=1&key=<43-char-base64url>&relay=<encoded-wss-url>`. Validate scheme/version/key canonicality/relay protocol and allowed host before storage. Never log the payload or scanner event.
- Mobile: use `expo-camera` `CameraView`, `barcodeScannerSettings={{barcodeTypes:["qr"]}}`, and `onBarcodeScanned`; unmount after the first accepted scan. **Verified:** barcode scanning is built into current `expo-camera`; `expo-barcode-scanner` was removed in SDK 52. [current camera API](https://docs.expo.dev/versions/latest/sdk/camera/), [SDK 52 removal](https://expo.dev/changelog/2024-11-12-sdk-52)
- Persist the key in SecureStore and `sync_role='joined'` in SQLite, then start the engine. On startup, an orphaned key without pairing metadata enters repair/reset UI rather than silently connecting (important because iOS Keychain may survive uninstall while SQLite does not).

## Concrete S4 build sequence

1. **Scaffold and portable boundary.** Add `mobile/{package.json,package-lock.json,app.json,eas.json,metro.config.cjs,tsconfig.json,index.ts}` and `mobile/src/{App.tsx,navigation/,shared/}`. Install Quick Crypto first in the entry point and assert the required globals. Add `src/sync/desktopEngine.ts`; make `src/sync/engine.ts` injection-only; update desktop singleton imports. Gates: desktop tests/typecheck/lint unchanged, Android dev build boots, clean EAS archive contains shared source.
2. **DbClient and migrations.** Add `src/db/ensureColumn.ts`; update `schema.ts`, `migrations.ts`, and `migrations2.ts` imports. Add `mobile/src/db/{expoDbClient.ts,database.ts}` and tests. Run canonical migrations inside an exclusive transaction. Gates: migration matrix above on Android, then iOS.
3. **Native binder browse.** Add `mobile/src/features/binder/{BinderScreen.tsx,binderQueries.ts}` and navigation routes. Query projects/folders/scenes directly through ExpoDbClient; render synced/local badge, title, synopsis, status, and word count read-only. No WebView or sync dependency. Gate: seeded DB browse and empty/error states.
4. **Pairing.** Desktop scope: `src/features/settings/SyncQr.tsx`, `Settings.sync.tsx`, root dependency/lock update. Mobile scope: `mobile/src/features/pairing/PairScreen.tsx`, `mobile/src/sync/mobileKeyStorage.ts`, camera/SecureStore config. Gate: scan desktop QR on physical Android, reject malformed payloads, relaunch and recover key without logs.
5. **Scene read plus sync-down.** Add `mobile/src/sync/{mobileEngine.ts,mobileLiveScenePort.ts}`, `mobile/src/db/syncStores/`, `mobile/src/db/mobileMetaApplyTarget.ts`, `mobile/editor-web/`, and `mobile/src/features/editor/SceneScreen.tsx`. Compose the root `SyncEngine` with Expo stores/provider/key access; remote meta writes SQLite and refreshes binder, remote scene updates persist then cross the bridge, and the WebView hydrates before editor mount in read-only S4 mode. Gate: fresh joined phone clones projects/binder/scene through the real relay, opens a 50k-word scene, receives a second desktop update while binder and editor are active, survives route changes, and converges after reconnect. S5 enables local editing on the already-proven bridge.

## Risks and mitigations

- **Quick Crypto doc/runtime mismatch:** exact protocol vectors on physical Android+iOS; activate the provider fallback only on observed failure.
- **Bridge loss/reorder during navigation:** DB-first application, scene id + sequence + ACK, flush-before-unmount, idempotent Yjs updates, full rehydrate on timeout/epoch replacement.
- **Dependency resolution differs locally/EAS:** mobile-only node_modules resolution, explicit shared deps, clean install, archive inspection, production bundle in CI.
- **Migration semantic differences:** exclusive transaction, parameter/read-after-write tests, full historical migration matrix; never fork schema SQL.
- **iOS leg still unproven:** complete S0 keyboard/large-scene checks plus crypto/bridge lifecycle on a physical iPhone before S4 acceptance.
- **App suspension/socket loss:** observe RN `AppState`, stop/restart the provider, rely on reconnect hello/state vectors; background sync remains a non-goal.
