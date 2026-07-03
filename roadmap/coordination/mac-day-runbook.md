# Mac-Day Runbook — First macOS Release (Apple Silicon)

> Status: **execution runbook for the one Mac day** (Wave 55, P5). Audience: an AI agent + Cole
> running it together on a single Mac. Everything Windows-side is already done (P1–P4): platform
> detection, native traffic lights, the manifest-merge contract, and `publish-mac.sh`. This doc is
> the hour-by-hour script for the day that cannot be done from Windows.
>
> Companion artifacts: [`publish-mac.sh`](../../publish-mac.sh) (the script this runbook drives),
> [`src-tauri/tauri.macos.conf.json`](../../src-tauri/tauri.macos.conf.json) (the auto-merged macOS
> window overlay), and the multi-platform manifest contract documented in the header of
> [`publish.ps1`](../../publish.ps1). Source research: `research/2026-07-02-macos-port-{audit,requirements}.md`.

## 0. Why this day exists

Wave 55 did every macOS-port item that does NOT require a physical Mac. What remains is pure
execution: install the toolchain, provision an Apple signing identity + notarization credentials,
build + sign + notarize an `.app`/`.dmg` for `aarch64-apple-darwin`, merge it into the release's
`latest.json`, and smoke-test on real macOS. All changes from P1–P4 are inert on Windows; this is
the first time anything actually builds for macOS.

---

## 1. Prerequisites / toolchain (≈30 min)

Run these once on the Mac. They are the non-secret foundations `publish-mac.sh` preflight-checks.

```bash
# Xcode Command Line Tools — required for the Rust→native toolchain + notarytool/xcrun.
xcode-select --install
# Verify install:
xcode-select -p && xcrun --version

# Rust + the Apple-Silicon target.
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add aarch64-apple-darwin
# Verify the target is installed (publish-mac.sh checks this exact string):
rustup target list --installed | grep '^aarch64-apple-darwin$'

# GitHub CLI — publish-mac.sh uses `gh release download/upload`. Authenticate non-interactively
# or via the browser flow.
gh auth login
gh auth status   # verify

# jq — PREFERRED JSON backend for the manifest merge. OPTIONAL: node (already required for the
# frontend build) is the automatic fallback, so `brew install jq` is a nicety, not a gate.
brew install jq    # skip if you don't have Homebrew handy; node will cover it
```

Node is already required for `npm run tauri` and is therefore always present; `jq` only makes the
manifest merge slightly more idiomatic. `publish-mac.sh` auto-detects which is on PATH.

---

## 2. Signing setup (Apple Developer — one-time, ≈45 min the first time)

This is the only part that genuinely requires the human-only Apple portal. Everything else is
scripted. You need a paid Apple Developer Program membership ($99/yr).

### 2a. "Developer ID Application" certificate (codesign)

This is the cert that lets a distributed `.app` run outside the App Store without Gatekeeper
blocking it. **Do not confuse with "Mac App Distribution" / "Development" / "Apple Distribution" —
you specifically need "Developer ID Application".**

1. **Generate a CSR** in Keychain Access:
   `Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority…`
   Use your Apple ID email, save the request **to disk** (a `.certSigningRequest` file).
2. **Upload the CSR** at
   [developer.apple.com → Certificates, Identifiers & Profiles → Certificates → +](https://developer.apple.com/account/resources/certificates/add).
   Choose **Developer ID Application** as the type. Upload the CSR. Download the resulting `.cer`.
3. **Install the cert** by double-clicking the `.cer` — it lands in the **login** keychain. Verify
   its full CN; you'll need it verbatim in §3:
   ```bash
   security find-identity -v -p codesigning | grep "Developer ID Application"
   # → "Developer ID Application: Cole Stacey (TEAMXXXX)"   ← copy this whole string
   ```

### 2b. App-specific password (for notarytool)

Notarization uses `xcrun notarytool submit` which authenticates with an **app-specific password**,
not your Apple ID password. Create one at
[appleid.apple.com → Sign-In & Security → App-Specific Passwords](https://appleid.apple.com).
Label it e.g. "notarytool-writersnook". Copy the generated password — it's shown once.

### 2c. Team ID

Find the **Team ID** (a 10-character alphanumeric) on the
[Membership page](https://developer.apple.com/account#MembershipDetailsCard). It's also the
`(TEAMXXXX)` suffix on the cert CN from 2a — use whichever you can see.

> **Why no provisioning profile?** Developer ID distribution (outside the App Store) does not use
> provisioning profiles — only the cert. Profiles are an App Store path. Don't go looking for one.

---

## 3. Environment block (export before `bash publish-mac.sh`)

`publish-mac.sh` preflight-requires all six of these (see its `require_env` call). Export them in
the shell you'll run the build from. None are written to disk by the script; the operator owns them.

```bash
# codesign identity — the EXACT CN from §2a, including "Developer ID Application:" and "(TEAMID)".
export APPLE_SIGNING_IDENTITY="Developer ID Application: Cole Stacey (TEAMXXXX)"

# notarytool credentials — APPLE_ID is the Apple ID of the Developer Program account.
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"   # the app-specific password from §2b (NOT your Apple ID pw)
export APPLE_TEAM_ID="TEAMXXXX"               # from §2c

# The Tauri UPDATER key pair — the SAME one publish.ps1 uses on Windows. Both platforms MUST share
# one key pair so both the .exe.sig and the .app.tar.gz.sig verify against the single `pubkey`
# embedded in src-tauri/tauri.conf.json (plugins.updater.pubkey). Get the private key file from the
# Windows machine (it lives at %USERPROFILE%\.tauri\writing.key) — copy it onto the Mac securely.
export TAURI_SIGNING_PRIVATE_KEY="/Users/cole/.tauri/writing.key"

# Updater-key password — set it via silent read, NOT an inline export. If the password contains
# a double quote (or a paste smart-quotes the string), an inline export leaves zsh hanging at a
# `dquote>` continuation prompt. `read -rs` takes the password literally (no quoting hazards) and
# keeps it out of shell history. Ctrl+C escapes a stuck dquote> prompt.
read -rs TAURI_SIGNING_PRIVATE_KEY_PASSWORD   # type/paste the key password, press Enter (no echo)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

### Two config facts that explain why `tauri.conf.json` looks minimal here

- **`signingIdentity` is deliberately unset in `tauri.conf.json`.** When `bundle.macOS.signingIdentity`
  is omitted, Tauri 2 reads it from the `APPLE_SIGNING_IDENTITY` environment variable at build time
  (this is exactly how `publish-mac.sh` passes it in). Setting it explicitly in the config would
  hard-code a CN that includes a Team ID and would break for any other signer; reading from env is
  the correct, flexible default. Don't add it.
- **`hardenedRuntime` defaults to `true` in Tauri 2.** A hardened runtime is *required* for
  notarization, so the default is already correct. There is nothing to set; do not add a
  `hardenedRuntime` key. (The minimal `bundle.macOS` block in `tauri.conf.json` is just
  `"minimumSystemVersion": "11.0"`.)

---

## 4. Release sequence (the actual publish — ≈20–40 min, mostly notarization wait)

The two publishes are **ordered**. Windows creates the GitHub release; Mac merges into it.

### Step 1 — Windows publishes FIRST (on the Windows machine)

Cole runs `.\publish.ps1` on Windows for version `X.Y.Z`. This:
- creates the GitHub release tagged `vX.Y.Z`,
- uploads the NSIS installer + a `latest.json` whose `platforms` contains **only** `windows-x86_64`,
- uploads the installer to R2.

Confirm the release exists before continuing:
```bash
gh release view vX.Y.Z --repo hesnotsoharry/writing
```

### Step 2 — On the Mac, run the build

```bash
cd /path/to/writing      # the repo root (where publish-mac.sh lives)
bash publish-mac.sh
```

What this does (you do NOT run these manually — `publish-mac.sh` orchestrates them):
1. Preflight: toolchain + all six env vars present + version agrees across `package.json`,
   `tauri.conf.json`, `Cargo.toml`, `Cargo.lock`.
2. `npm run tauri -- build --target aarch64-apple-darwin` — Tauri codesigns (`APPLE_SIGNING_IDENTITY`)
   and notarizes (`notarytool`) the bundle in one step. `createUpdaterArtifacts:true` emits the
   `.app.tar.gz` + `.sig` updater artifacts alongside the `.dmg`.
3. Version-anchored artifact discovery + a build-sentinel freshness guard (no bare wildcards —
   same stale-artifact defense as `publish.ps1`).
4. Downloads the tag's `latest.json`, **guards its `.version` equals the version being shipped**
   (so a platform key can never point at a mismatched build), upserts ONLY the `darwin-aarch64`
   key, and re-uploads with `gh release upload --clobber`.
5. Uploads the `.dmg` to R2 (non-fatal if it fails).

### Notarization wait

Expect **5–15 minutes** of notarization wait, during which `notarytool` has submitted the `.app` to
Apple and is polling for the verdict. Tauri **blocks** on this — the build command does not return
until notarization succeeds (or fails). If it fails, `publish-mac.sh` exits non-zero and prints the
`xcrun notarytool log` command you need (see §7).

### ⚠️ Mid-window sequencing (matters from the SECOND Mac release onward)

> From the P4 adversarial review (filed as a Wave 55 follow-up candidate).

Between Step 1 (Windows publishes) and Step 2 completing (Mac manifest uploaded), a Mac client that
polls `latest.json` for updates finds **no `darwin-aarch64` key**. The Tauri updater
(`tauri-plugin-updater` 2.x) treats a missing platform key for the current target as an update-check
**ERROR** (`TargetsNotFound`) — **not** a silent "no update". This is transient and self-heals the
instant `publish-mac.sh` uploads the merged manifest.

- **First Mac release:** there are no Mac clients yet (the first `.dmg` doesn't exist until this
  day finishes), so the window is invisible. Non-issue today.
- **Every subsequent release:** keep Step 1 and Step 2 close together (minutes, not hours) to
  minimize the window. If it ever becomes user-visible, the fix is in the app's updater
  error-handling UX (a `src/` change, out of scope for this wave) or Mac-first/atomic sequencing.

---

## 5. Title-bar tuning (first launch — ≈10 min)

The macOS window uses **native traffic lights** (the red/yellow/green buttons). This is applied by
`src-tauri/tauri.macos.conf.json`, which Tauri 2 auto-discovers and deep-merges over the base
config — it sets `decorations: true`, `titleBarStyle: "Overlay"`, and `hiddenTitle: true` for the
window. (The base `tauri.conf.json` keeps `decorations: false`, so Windows is byte-identical.) On
first launch of the signed `.app`, verify and tune:

1. **Traffic lights rendered top-left and the merge took effect.** Drag the window by the bar; the
   lights should be real native controls, not the JSX window-controls block (which is hidden on
   macOS via the `.titlebar--mac` class). If you see the JSX controls instead, the config merge
   didn't happen — confirm `tauri.macos.conf.json` is next to `tauri.conf.json`.
2. **`trafficLightPosition`** (optional, in `tauri.macos.conf.json`): if the lights' vertical offset
   looks off relative to the brand mark, add an explicit `trafficLightPosition: { x, y }` to the
   window object. Tune by eye; default position is usually fine.
3. **`.titlebar--mac .tb-left { padding-left: 78px }`** in `src/styles/app.css` (≈line 49): this
   reserves space so the brand logos clear the lights. If they overlap or the gap looks too wide,
   adjust this single value — don't fork the JSX layout.
4. **`.tb-divider`** (the thin `1px × 22px` rule at `src/styles/app.css:51`): it sits in the bar's
   right section, immediately before the window-controls block that macOS hides. On macOS it can
   read as an orphaned line at the bar's right edge. If it does, **hide it with a `.titlebar--mac`
   CSS rule** (e.g. `.titlebar--mac .tb-divider { display: none }`) rather than widening the JSX
   fork — the renderer already branches on platform; keep the visual fix in CSS where it belongs.

---

## 6. Smoke checklist (manual — the agent CDP-9222 harness does NOT exist on macOS)

> ⚠️ The agent-driven smoke harness used on Windows (WebView2 CDP debug port 9222 +
> `tauri-devtools` MCP attach) **does not exist on macOS**. WKWebView does not expose a CDP port the
> same way. So smoke on Mac is **manual/human** — Cole drives the app, the agent reads screenshots
> Cole pastes. Budget for this.

Tick each one on the signed + notarized build (not a `taauri dev` build — a real installed `.app`):

- [ ] **Title bar + window drag** — `data-tauri-drag-region` works: grab the bar (not on a button)
      and move the window. Traffic lights minimize/maximize/close correctly.
- [ ] **Editor renders + types** — open a scene; ProseMirror renders in WKWebView, text input works,
      formatting (bold/italic/headings) applies. (ProseMirror owns its content DOM; verify it does
      not lose focus or revert input — the Wave 28 lesson.)
- [ ] **DB present + read/write** — the SQLite database lives at
      `~/Library/Application Support/com.coles.writing/writing.db` (the macOS equivalent of Windows'
      `%APPDATA%\com.coles.writing\writing.db`). Create a manuscript, a chapter, type some text,
      quit, reopen — the content persists.
- [ ] **BYOK key persists across restart** — drop an OpenAI/Anthropic key into Settings, quit the
      app, reopen, confirm the key is still there. (Keychain persistence was audited as safe in
      Wave 55 P4 — `keyring` maps to macOS Keychain unconditionally. This verifies it for real.)
- [ ] **License activation flow** — run through a license activate/restore against the licensing
      backend; confirm it succeeds and the app unlocks.
- [ ] **Updater end-to-end** — the real proof. Seed an OLDER installed build (e.g. build `X.Y.Z-1`
      and install it), then publish `X.Y.Z`. Open the older build, trigger the update check, and
      confirm it downloads the macOS bundle from `latest.json`'s `darwin-aarch64` key and applies
      it. (This is the only test that exercises notarization + stapling + the updater signature
      chain on Mac end-to-end.)

---

## 7. Troubleshooting

| Symptom | Command / fix |
|---|---|
| **Gatekeeper rejects the app** ("damaged" / "unidentified developer") | `spctl --assess --type execute -vv /path/to/WritersNook.app` — should print `accepted`. If not, the app isn't properly signed+notarized+stapled. |
| **Notarization failed** | Fetch the submission log: `xcrun notarytool log <submission-id> --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_PASSWORD"`. `<submission-id>` is printed by Tauri's notarization step on failure. The log names the exact failing rule (often a hardened-runtime entitlement or an embedded library that wasn't signed). |
| **Verify the codesign chain** | `codesign -dvvv /path/to/WritersNook.app` — confirm `Authority=Developer ID Certification Authority` and `TeamIdentifier=…`. `codesign --verify --deep --strict --verbose=2 /path/to/WritersNook.app` should exit 0. |
| **"DMG not found" from `publish-mac.sh`** | The script prints the contents of `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/` and a hint. If Tauri's DMG naming changed at this version (it embeds the version + arch), adjust the `dmg=…` glob in `publish-mac.sh` and rebuild — do NOT loosen it to a bare `*.dmg`. |
| **`gh release download latest.json` fails** | Windows (`publish.ps1`) hasn't published this tag yet. Publish Windows first (§4 Step 1), then re-run. The error message in `publish-mac.sh` calls this out explicitly. |
| **Manifest version guard fails** | `publish-mac.sh` refuses to upsert `darwin-aarch64` if the downloaded `latest.json`'s `.version` ≠ the version you're shipping. Re-run after Windows publishes the SAME version. |
| **Updater key rejected** | The `TAURI_SIGNING_PRIVATE_KEY` must be the SAME pair `publish.ps1` uses on Windows (one shared pair, one embedded pubkey in `tauri.conf.json`). If the Mac build's `.sig` doesn't validate against the pubkey, you've used a different key — copy the Windows key over and rebuild. |

---

## Appendix — what this day does NOT cover

- **Universal binary / Intel (`x86_64-apple-darwin`).** Out of scope (Wave 55 Decision 1: ship
  aarch64-only). If Intel support ever matters, it's one `--target` + one more manifest key away.
- **App Store distribution.** This runbook is Developer ID distribution (direct download from
  writersnook.app). App Store would need a different cert, provisioning profiles, and sandbox
  entitlements — a separate effort.
- **Automated Mac smoke.** WKWebView has no CDP port; agent-driven smoke stays manual until a Mac
  automation harness (e.g. AppleScript-driven UI, or a future Tauri devtools extension for macOS)
  is wired up. File as a follow-up if Mac smoke becomes a recurring cost.
