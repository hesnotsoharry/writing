# publish.ps1 — build a signed release and publish it to GitHub so the in-app
# updater can find it. Run from the repo root: .\publish.ps1
#
# Prerequisites (one-time):
#   - GitHub CLI installed and authenticated:  gh auth login
#   - Your updater private key at the path below (NEVER commit it).
#   - The version in src-tauri/tauri.conf.json already bumped above the
#     currently-shipped version (the updater only triggers on a HIGHER version).
#
# What it does:
#   1. Reads the version from src-tauri/tauri.conf.json.
#   2. Builds a signed bundle (createUpdaterArtifacts produces the .sig file).
#   3. Generates latest.json (the file the in-app updater polls).
#   4. Creates a GitHub release tagged v<version> and uploads the installer
#      + latest.json as release assets.
#
# --- Multi-platform updater manifest contract ----------------------------
# There is ONE latest.json per release tag, written by two publishes in order:
#
#   1. WINDOWS (this script) publishes FIRST. `gh release create` makes the
#      GitHub release for the tag and uploads a latest.json whose `platforms`
#      holds ONLY the `windows-x86_64` key. The tag-exists guard below (the
#      `gh release view $Tag` check that throws when the release already
#      exists) makes a same-tag Windows re-publish FAIL FAST — so this script
#      never has to merge into an existing manifest; any such merge would be
#      unreachable dead code.
#
#   2. MACOS (publish-mac.sh, run separately on a Mac) publishes SECOND. It
#      downloads the tag's latest.json, leaves the `windows-x86_64` key
#      untouched, and UPSERTS the `darwin-aarch64` key (signature + url).
#      Before writing, it guards that the downloaded manifest's `version`
#      equals the version being shipped — so a platform key is never pointed
#      at a mismatched version (which would loop a Mac client onto an old
#      build) — then re-uploads the merged file with `gh release upload
#      --clobber`.
#
# Mid-window behavior: in the gap between the Windows publish and the macOS
# publish, a Mac client polling latest.json finds no `darwin-aarch64` key. The
# Tauri updater (tauri-plugin-updater 2.x) treats a missing platform key for
# the current target as an update-check ERROR (TargetsNotFound), NOT a silent
# "no update". This is transient and self-heals the instant publish-mac.sh
# uploads the merged manifest. On the VERY FIRST Mac release there are no Mac
# clients yet, so the window is invisible; for subsequent releases keep the two
# publishes close together to minimize it.

$ErrorActionPreference = 'Stop'

# --- Config ---------------------------------------------------------------
$Repo        = 'hesnotsoharry/writing'
$KeyPath     = Join-Path $env:USERPROFILE '.tauri\writing.key'
$ProjectRoot = $PSScriptRoot

# Azure Artifact Signing (Authenticode — signs the app exe + NSIS installer so
# SmartScreen shows a real publisher instead of "unknown"). Independent of the
# Tauri updater signature above; both run during the same build.
# Mechanism: signtool + Microsoft's Artifact Signing dlib plugin. The account /
# profile / endpoint live in metadata.json; auth comes from the AZURE_* env
# vars (writersnook-signer app registration, signer role on the account).
$SignDlib     = Join-Path $env:USERPROFILE '.artifact-signing\client\bin\x64\Azure.CodeSigning.Dlib.dll'
$SignMetadata = Join-Path $env:USERPROFILE '.artifact-signing\metadata.json'

# --- Preflight ------------------------------------------------------------
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI ('gh') not found. Install it and run 'gh auth login' first."
}
if (-not (Test-Path $KeyPath)) {
    throw "Signing key not found at $KeyPath. Cannot sign an update without it."
}
if (-not (Test-Path $SignDlib)) {
    throw "Artifact Signing dlib not found at $SignDlib — re-download the Microsoft.Trusted.Signing.Client NuGet package."
}
if (-not (Test-Path $SignMetadata)) {
    throw "Signing metadata not found at $SignMetadata (endpoint + account + profile JSON)."
}
$SignTool = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe' -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
if (-not $SignTool) {
    throw 'signtool.exe not found under Windows Kits — install a Windows 10/11 SDK (ships with VS Build Tools).'
}
# The dlib authenticates via an Entra app registration with the
# "Artifact Signing Certificate Profile Signer" role, read from these env vars.
foreach ($v in 'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET') {
    if (-not (Get-Item "env:$v" -ErrorAction SilentlyContinue)) {
        throw "Missing $v. Set the three AZURE_* env vars for the signing app registration first."
    }
}

# --- Read version ---------------------------------------------------------
$conf    = Get-Content (Join-Path $ProjectRoot 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json
$Version = $conf.version
$Tag     = "v$Version"
Write-Host "Publishing version $Version (tag $Tag)" -ForegroundColor Cyan

# Guard: refuse to re-publish an existing tag (would confuse the updater).
$existing = gh release view $Tag --repo $Repo 2>$null
if ($LASTEXITCODE -eq 0) {
    throw "Release $Tag already exists. Bump 'version' in tauri.conf.json before publishing."
}

# --- Sign + build ---------------------------------------------------------
# The private key path + password are passed to the build via env vars; Tauri
# signs the installer and writes a matching .sig file next to it.
$pw = Read-Host -AsSecureString 'Enter your updater key password'
# TAURI_SIGNING_PRIVATE_KEY accepts a path OR the key contents; the bundler does
# not read the *_PATH variant, so we point this var at the key file directly.
$env:TAURI_SIGNING_PRIVATE_KEY = $KeyPath
# Convert the SecureString via an unmanaged BSTR, then zero+free that BSTR
# immediately so the plaintext password does not linger in process memory for
# the whole build. (The managed env-var copy is required by `tauri build`.)
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw)
try {
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD =
        [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
} finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

# Authenticode wiring: hand Tauri a custom sign command via a config overlay
# (kept out of tauri.conf.json so plain `tauri build` runs don't require Azure
# credentials). Tauri replaces %1 with each binary it produces — app exe first,
# then the NSIS installer — so both come out Authenticode-signed. Object form
# (cmd/args) is required because signtool's path contains spaces.
$signCommand = [ordered]@{
    cmd  = $SignTool.FullName
    args = @('sign', '/fd', 'SHA256', '/tr', 'http://timestamp.acs.microsoft.com', '/td', 'SHA256',
             '/dlib', $SignDlib, '/dmdf', $SignMetadata, '%1')
}
$overlay = @{ bundle = @{ windows = @{ signCommand = $signCommand } } } | ConvertTo-Json -Depth 6
$overlayPath = Join-Path $env:TEMP 'wn-sign-overlay.json'
Set-Content $overlayPath $overlay -Encoding utf8

Write-Host 'Building signed bundle (this takes a few minutes)...' -ForegroundColor Cyan
npm run tauri -- build --config $overlayPath
if ($LASTEXITCODE -ne 0) { throw 'tauri build failed.' }

# --- Locate artifacts -----------------------------------------------------
# NSIS is the updater artifact on Windows. The .sig sits next to the installer.
# Match THIS version's artifacts explicitly — the bundle dir accumulates older
# builds, and a bare '*-setup.exe | First 1' once shipped a stale installer
# under a new tag (v0.2.3 released the 0.2.2 exe).
$nsisDir = Join-Path $ProjectRoot 'src-tauri\target\release\bundle\nsis'
$setup   = Get-ChildItem $nsisDir -Filter "*_$($Version)_*-setup.exe"     | Select-Object -First 1
$sigFile = Get-ChildItem $nsisDir -Filter "*_$($Version)_*-setup.exe.sig" | Select-Object -First 1
if (-not $setup)   { throw "No $Version -setup.exe found in $nsisDir — did the build produce artifacts for this version?" }
if (-not $sigFile) { throw "No $Version .sig found in $nsisDir — was the build signed? Check the key env vars." }

$signature = (Get-Content $sigFile.FullName -Raw).Trim()
$assetUrl  = "https://github.com/$Repo/releases/download/$Tag/$($setup.Name)"
$pubDate   = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')

# --- Generate latest.json -------------------------------------------------
# This is the manifest the in-app updater polls. Platform key 'windows-x86_64'
# is what Tauri's updater looks up on a 64-bit Windows build.
$manifest = [ordered]@{
    version   = $Version
    notes     = "Update to $Version"
    pub_date  = $pubDate
    platforms = [ordered]@{
        'windows-x86_64' = [ordered]@{
            signature = $signature
            url       = $assetUrl
        }
    }
}
$latestPath = Join-Path $nsisDir 'latest.json'
$manifest | ConvertTo-Json -Depth 5 | Set-Content $latestPath -Encoding utf8
Write-Host "Wrote $latestPath" -ForegroundColor Green

# --- Publish to GitHub ----------------------------------------------------
Write-Host "Creating GitHub release $Tag..." -ForegroundColor Cyan
gh release create $Tag $setup.FullName $latestPath `
    --repo $Repo `
    --title $Tag `
    --notes "Release $Version"
if ($LASTEXITCODE -ne 0) { throw 'gh release create failed.' }

# --- Upload to R2 (downloads.writersnook.app) ---------------------------------
# Uploads the signed installer to Cloudflare R2 under two keys:
#   - Stable   → WritersNook-Setup.exe   (what downloads-config.js points at)
#   - Versioned → e.g. WritersNook_0_2_6_x64-setup.exe  (archive copy)
# Wrangler is a devDep in marketing/ so we run it from there.
# Non-fatal: if wrangler isn't authed or fails, print the manual command and continue.
Write-Host 'Uploading installer to R2 (downloads.writersnook.app)...' -ForegroundColor Cyan
$marketingDir = Join-Path $ProjectRoot 'marketing'
$r2Bucket = 'writersnook-downloads'
try {
    Push-Location $marketingDir
    # Stable name — this is the URL in downloads-config.js
    npx wrangler r2 object put "$r2Bucket/WritersNook-Setup.exe" --file $setup.FullName
    if ($LASTEXITCODE -ne 0) { throw 'wrangler stable-name upload failed' }
    # Versioned archive copy (original filename, e.g. WritersNook_0_2_6_x64-setup.exe)
    npx wrangler r2 object put "$r2Bucket/$($setup.Name)" --file $setup.FullName
    if ($LASTEXITCODE -ne 0) { throw 'wrangler versioned-name upload failed' }
    Write-Host "R2 upload complete — stable + $($setup.Name)" -ForegroundColor Green
} catch {
    Write-Warning "R2 upload failed: $_"
    Write-Warning "Manual upload commands (run from marketing/ after 'npx wrangler login'):"
    Write-Warning "  npx wrangler r2 object put $r2Bucket/WritersNook-Setup.exe --file `"$($setup.FullName)`""
    Write-Warning "  npx wrangler r2 object put `"$r2Bucket/$($setup.Name)`" --file `"$($setup.FullName)`""
} finally {
    Pop-Location
}

# Clear the signing secrets from the environment for this session.
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $null
$env:TAURI_SIGNING_PRIVATE_KEY = $null

Write-Host "Done. Installed apps will see $Version on their next update check." -ForegroundColor Green
