# Releasing & updates

This app ships as a Windows installer and updates itself via Tauri's updater
plugin. Users install once; every release after that arrives automatically.

## What the user needs to install

Nothing but the app. Rust/MSVC/Visual Studio Build Tools are **build-time only**
(your machine). The only runtime dependency is **WebView2**, which is preinstalled
on Windows 11 and auto-installed by the installer on older Windows if missing.

## First install (manual, one time per machine)

1. `npm run tauri build`
2. Send the user `src-tauri/target/release/bundle/nsis/writing_<version>_x64-setup.exe`.
3. They double-click it. On first run Windows SmartScreen may warn (the app isn't
   code-signed with a paid certificate) — *More info → Run anyway*.

After this, they never need a file from you again — updates are automatic.

## Shipping an update

1. **Bump the version** in `src-tauri/tauri.conf.json` (and keep `package.json` /
   `src-tauri/Cargo.toml` in step). The updater only triggers when the published
   version is **higher** than the installed one.
2. Commit the bump.
3. Run `.\publish.ps1` from the repo root. It builds a signed bundle, generates
   `latest.json`, and creates a GitHub release tagged `v<version>` with the
   installer + manifest attached.

That's it. Installed apps check `releases/latest/download/latest.json` on startup
(and via Settings → "Check for updates"), and prompt to install when a newer
version is available.

## How signing works (two separate things — don't confuse them)

- **Updater signing** (set up, mandatory): proves an update genuinely came from
  you so the app won't install a tampered bundle. Keys live at
  `~/.tauri/writing.key` (private — **never commit, never lose**) and
  `writing.key.pub` (public — already in `tauri.conf.json` as `pubkey`).
  `publish.ps1` uses the private key + its password to sign each build.
- **Windows code signing** (not set up): a paid (~$200–400/yr) certificate that
  removes the SmartScreen warning. Optional; skip until it's worth it.

## Prerequisites for `publish.ps1`

- GitHub CLI authenticated: `gh auth login` (one time).
- The private key present at `~/.tauri/writing.key`.
- **Back up the private key + its password** (password manager). Lose them and you
  can never ship an update to already-installed apps again.

## Future upgrade

When Phase 2 adds more platforms, move publishing to the `tauri-apps/tauri-action`
GitHub Action (builds + signs + generates `latest.json` on tag push). The manual
`publish.ps1` is the right tool while this is Windows-only.
