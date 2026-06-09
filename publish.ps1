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

$ErrorActionPreference = 'Stop'

# --- Config ---------------------------------------------------------------
$Repo        = 'hesnotsoharry/writing'
$KeyPath     = Join-Path $env:USERPROFILE '.tauri\writing.key'
$ProjectRoot = $PSScriptRoot

# --- Preflight ------------------------------------------------------------
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI ('gh') not found. Install it and run 'gh auth login' first."
}
if (-not (Test-Path $KeyPath)) {
    throw "Signing key not found at $KeyPath. Cannot sign an update without it."
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

Write-Host 'Building signed bundle (this takes a few minutes)...' -ForegroundColor Cyan
npm run tauri build
if ($LASTEXITCODE -ne 0) { throw 'tauri build failed.' }

# --- Locate artifacts -----------------------------------------------------
# NSIS is the updater artifact on Windows. The .sig sits next to the installer.
$nsisDir = Join-Path $ProjectRoot 'src-tauri\target\release\bundle\nsis'
$setup   = Get-ChildItem $nsisDir -Filter '*-setup.exe'     | Select-Object -First 1
$sigFile = Get-ChildItem $nsisDir -Filter '*-setup.exe.sig' | Select-Object -First 1
if (-not $setup)   { throw "No -setup.exe found in $nsisDir." }
if (-not $sigFile) { throw "No .sig found in $nsisDir — was the build signed? Check the key env vars." }

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

# Clear the signing secrets from the environment for this session.
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $null
$env:TAURI_SIGNING_PRIVATE_KEY = $null

Write-Host "Done. Installed apps will see $Version on their next update check." -ForegroundColor Green
