# EAS / Expo (mobile iOS builds)

Verified 2026-08-22 while standing up the first TestFlight build. iOS builds run on
EAS cloud runners (no Mac locally); Android stays local Gradle. Non-interactive
credential setup is impossible via eas-cli — everything below exists so builds never
need interactive mode.

## Archive packing: EAS uploads the REPO ROOT, not mobile/

- eas-cli treats the repo as a monorepo and archives from `C:\Web App\writing`, even
  with `EAS_NO_VCS=1`. `mobile/.easignore` is NEVER read — only the repo-root
  `.easignore` counts, and when it exists it REPLACES `.gitignore` entirely, so it
  must re-list every exclude. The root `.easignore` exists and excludes
  `mobile/android/` (~8 GB of native intermediates) and `src-tauri/target/` (~8 GB);
  without it the tarball is >2 GB and upload fails ("Maximum allowed size is 2.0 GB").
- Debug what's packed with: `eas build:inspect -p ios -e production --stage archive
  --output <dir>` (no `--non-interactive` flag on this command; delete the dump after —
  it can be huge).
- Builds are launched with `EAS_NO_VCS=1` (see runbook below) so packing follows
  `.easignore` rather than git state.

## npm on the runner must match local npm

- `build.production.node` is pinned in `mobile/eas.json` (currently `24.13.0`) so the
  runner's npm matches the npm 11 that writes `mobile/package-lock.json`. Unpinned
  runners had npm 10, which hard-fails `npm ci` on locks npm 11 considers fine
  ("Missing: @floating-ui/dom from lock file" — an unlocked dep of the *optional*
  `@tiptap/extension-bubble-menu`). Keep the pin in step with the machine's node.

## iOS signing: local credentials, created via ASC API (no interactive eas-cli)

- `eas build --non-interactive` refuses to CREATE remote credentials ("Distribution
  Certificate is not validated for non-interactive builds") — even with ASC key env
  vars, on eas-cli 18 and 22. Instead we use `credentialsSource: "local"` +
  `mobile/credentials.json` (gitignored) pointing at `mobile/credentials/` (gitignored).
  Canonical copies + p12 password: `~/.appstoreconnect/writersnook/`.
- The dist cert and both App Store profiles were created directly via the App Store
  Connect API (team key `79UAUVWB52`, helper pattern in that folder's notes; JWT ES256).
  Profiles must be regenerated there whenever capabilities change (changing App ID
  capabilities invalidates them).
- **p12 must be exported with `openssl pkcs12 -export -legacy`.** OpenSSL 3's default
  AES/PBKDF2 encryption silently fails macOS keychain import on the runner
  ("Distribution certificate ... hasn't been imported successfully" in the
  Prepare credentials phase).
- Two targets need credentials: `WritersNook` (`app.writersnook`) and `ShareExtension`
  (`app.writersnook.share-extension`, declared under `extra.eas.build.experimental.ios.
  appExtensions` in app.json). Both share the App Group `group.app.writersnook`.
  App Groups can NOT be created/assigned via the ASC API — portal UI only
  (developer.apple.com → Identifiers; the identifier field auto-prefixes `group.`).

## Submits

- `submit.production.ios` in eas.json carries `ascAppId` 6804240408, team `W2M7ZT3V9K`,
  and the ASC API key path/id/issuer — so `--auto-submit` and `eas submit` are fully
  non-interactive. TestFlight internal testing needs no beta review; export compliance
  is pre-answered via `ITSAppUsesNonExemptEncryption: false` in app.json.

## Launch runbook (from mobile/)

```powershell
$env:EAS_NO_VCS = "1"
eas build --platform ios --profile production --auto-submit --non-interactive
```

Build logs when a phase fails: fetch `logFiles` via the Expo GraphQL API with the
`expo-session` header from `~/.expo/state.json` (the expo.dev URLs need browser auth);
each line is JSON with `phase`/`msg`/`err`.
