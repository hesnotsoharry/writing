#!/usr/bin/env bash
# publish-mac.sh — build a signed + notarized macOS release (Apple Silicon)
# and merge it into the release tag's latest.json so the in-app updater finds
# it. Run from the repo root on a Mac:  bash publish-mac.sh
#
# This is the macOS half of the two-publish updater contract documented at the
# top of publish.ps1. Windows publishes FIRST (publish.ps1 creates the GitHub
# release + the `windows-x86_64` platform key); this script publishes SECOND
# and UPSERTS the `darwin-aarch64` key into the SAME latest.json without ever
# clobbering the windows key.
#
# Prerequisites (one-time, on the Mac):
#   - Xcode Command Line Tools:  xcode-select --install
#   - Rust + the aarch64 target: rustup target add aarch64-apple-darwin
#   - GitHub CLI authenticated:  gh auth login
#   - jq OR node on PATH (jq: 'brew install jq'. node is already required for
#     the frontend build, so it is always present on release day; jq is the
#     preferred backend, node is the fallback used when jq is absent.)
#   - Apple Developer ID Application signing identity (in Keychain).
#   - An app-specific password for notarytool (Apple ID → app-specific
#     passwords) for the APPLE_ID account.
#   - The Tauri updater private key + its password (the SAME key pair
#     publish.ps1 uses on Windows) — Windows and Mac MUST share one updater
#     key pair so both platform signatures verify against the single pubkey in
#     tauri.conf.json.
#
# Secrets are read from the environment (export them before running):
#   APPLE_SIGNING_IDENTITY            — codesign identity, e.g.
#                                       "Developer ID Application: Cole Stacey (TEAMXXXX)"
#                                       (alternative: set bundle.macOS.signingIdentity
#                                       in tauri.conf.json — Phase 5)
#   APPLE_ID                          — Apple ID for notarytool
#   APPLE_PASSWORD                    — app-specific password for that Apple ID
#   APPLE_TEAM_ID                     — Developer Program team id
#   TAURI_SIGNING_PRIVATE_KEY         — the updater key (path OR contents)
#   TAURI_SIGNING_PRIVATE_KEY_PASSWORD— that key's password
#
# What it does:
#   1. Preflight-checks the toolchain + secrets, and verifies the version is
#      in sync across the four bump files (package.json, tauri.conf.json,
#      Cargo.toml, Cargo.lock).
#   2. Builds a signed + notarized bundle for aarch64-apple-darwin.
#      createUpdaterArtifacts:true emits the .app.tar.gz + .sig (updater
#      artifacts); the .dmg is the user-facing installer.
#   3. Locates THIS version's artifacts by name (no bare wildcards — same
#      stale-artifact defense as publish.ps1).
#   4. Downloads the tag's latest.json, asserts its `version` equals the
#      version being shipped, UPSERTS the `darwin-aarch64` key (signature +
#      url) preserving every other platform key, and re-uploads it alongside
#      the macOS bundle assets with `gh release upload --clobber`.
#   5. Uploads the DMG to Cloudflare R2 (downloads.writersnook.app) as a
#      stable `WritersNook.dmg` plus a versioned copy. Non-fatal on failure,
#      same posture as publish.ps1.
#
# TESTABILITY: the manifest merge logic is isolated in merge_manifest() and is
# reachable WITHOUT a Mac, a build, or any network via `--manifest-only`. See
# usage() below. This is what lets the merge contract be gated on Windows.

set -euo pipefail

# --- Config ---------------------------------------------------------------
REPO="hesnotsoharry/writing"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="aarch64-apple-darwin"
UPDATER_PLATFORM_KEY="darwin-aarch64"
R2_BUCKET="writersnook-downloads"
MARKETING_DIR="$PROJECT_ROOT/marketing"

# --- Arg state ------------------------------------------------------------
MANIFEST_ONLY=0
MANIFEST_FIXTURE=""
OVERRIDE_VERSION=""
OVERRIDE_SIG_FILE=""
OVERRIDE_URL=""

usage() {
    cat <<'EOF'
Usage: publish-mac.sh [options]

  (default)           Full macOS release pipeline (run on a Mac):
                      preflight -> build -> discover -> manifest upsert -> R2.

  --manifest-only F   TEST MODE (no build, no network, no gh). Read the LOCAL
                      fixture manifest at path F, run the version guard +
                      darwin-aarch64 upsert, print the merged JSON to stdout,
                      and exit 0. Exits NON-ZERO if the fixture's .version
                      mismatches the publish version. Lets the merge logic be
                      gated on Windows/Git Bash with no Mac required.

  --version V         Override the publish version. Otherwise the version is
                      read and verified equal across package.json,
                      tauri.conf.json, Cargo.toml, and Cargo.lock.

  --sig-file PATH     (manifest-only) Read the darwin signature from this file
                      instead of a test sentinel.

  --url URL           (manifest-only) Override the darwin asset download URL.

  -h, --help          Show this help.
EOF
}

# --- Helpers --------------------------------------------------------------

require_cmd() {
    local c="$1"
    if ! command -v "$c" >/dev/null 2>&1; then
        echo "ERROR: required command '$c' not found on PATH." >&2
        exit 1
    fi
}

require_env() {
    local v
    for v in "$@"; do
        # ${!v:-} is indirect expansion; `:-` keeps set -u happy when unset.
        if [ -z "${!v:-}" ]; then
            echo "ERROR: required env var $v is not set." >&2
            exit 1
        fi
    done
}

# JSON backend: prefer jq (the natural fit; documented as a Mac prereq), fall
# back to node — node is ALWAYS present on both platforms because the frontend
# build (`npm run tauri`) needs it, so the manifest merge + the --manifest-only
# gate run wherever jq happens to be absent (e.g. a bare Git Bash on Windows).
JSON_BACKEND=""
init_json_backend() {
    if command -v jq >/dev/null 2>&1; then
        JSON_BACKEND="jq"
    elif command -v node >/dev/null 2>&1; then
        JSON_BACKEND="node"
    else
        echo "ERROR: need jq OR node for manifest merging; neither found on PATH." >&2
        echo "       macOS: 'brew install jq'. Windows: install jq, or run where node is present." >&2
        exit 1
    fi
}

# Read a top-level string field from a JSON FILE. Prints the value (no newline).
json_get() {  # <file> <key>
    local file="$1" key="$2"
    if [ "$JSON_BACKEND" = "jq" ]; then
        jq -r --arg k "$key" '.[$k]' "$file"
    else
        FILE="$file" KEY="$key" node -e '
            const fs = require("fs");
            const o = JSON.parse(fs.readFileSync(process.env.FILE, "utf8"));
            process.stdout.write(String(o[process.env.KEY] ?? ""));
        '
    fi
}

# Read the top-level .version from a JSON string on stdin. Prints the value.
json_version_of() {
    if [ "$JSON_BACKEND" = "jq" ]; then
        jq -r '.version'
    else
        node -e '
            let s = "";
            process.stdin.on("data", d => (s += d)).on("end", () => {
                const o = JSON.parse(s);
                process.stdout.write(String(o.version ?? ""));
            });
        '
    fi
}

# Upsert platforms[$key] = { signature, url } into the JSON string on stdin;
# preserve every other key. Prints merged JSON to stdout. Values are passed via
# env (not argv) so signatures/urls containing shell-special chars are safe.
json_upsert_platform() {  # <key> <signature> <url>
    local key="$1" signature="$2" url="$3"
    if [ "$JSON_BACKEND" = "jq" ]; then
        jq --arg key "$key" --arg sig "$signature" --arg url "$url" \
            '.platforms[$key] = { signature: $sig, url: $url }'
    else
        KEY="$key" SIG="$signature" URL="$url" node -e '
            let s = "";
            process.stdin.on("data", d => (s += d)).on("end", () => {
                const o = JSON.parse(s);
                o.platforms = o.platforms || {};
                o.platforms[process.env.KEY] = { signature: process.env.SIG, url: process.env.URL };
                process.stdout.write(JSON.stringify(o, null, 2));
            });
        '
    fi
}

# Version readers for the four bump files.
version_from_package_json() { json_get "$PROJECT_ROOT/package.json" version; }
version_from_tauri_conf()   { json_get "$PROJECT_ROOT/src-tauri/tauri.conf.json" version; }

# Cargo.toml: the [package] version is the only top-level line starting with
# `version` (dependency versions live inside inline tables, e.g.
# `tauri = { version = "2" }`, and never begin a line).
version_from_cargo_toml() {
    grep -m1 '^version' "$PROJECT_ROOT/src-tauri/Cargo.toml" \
        | sed -E 's/.*"([^"]+)".*/\1/'
}

# Cargo.lock: find the app crate's package block, read the `version =` line
# that immediately follows its `name =` line. crate name passed via -v to keep
# the awk program a clean single-quoted string.
version_from_cargo_lock() {
    awk -v crate="$APP_CRATE_NAME" '
        $0 == "name = \"" crate "\"" { found = 1; next }
        found && /^version = / {
            sub(/^version = "/, "")
            sub(/".*$/, "")
            print
            exit
        }
    ' "$PROJECT_ROOT/src-tauri/Cargo.lock"
}

# The app crate name = [package].name in Cargo.toml (e.g. "writing"). Distinct
# from tauri.conf.json mainBinaryName ("writersnook").
read_app_crate_name() {
    awk '
        /^\[package\]/ { f = 1; next }
        f && /^name[[:space:]]*=/ {
            sub(/^name[[:space:]]*=[[:space:]]*"/, "")
            sub(/".*$/, "")
            print
            exit
        }
    ' "$PROJECT_ROOT/src-tauri/Cargo.toml"
}

# Resolve the version to publish. Honors --version; otherwise reads all four
# bump files and asserts they agree. Prints the version on stdout, returns
# non-zero (with a diagnostic) on disagreement.
resolve_publish_version() {
    if [ -n "$OVERRIDE_VERSION" ]; then
        printf '%s' "$OVERRIDE_VERSION"
        return 0
    fi
    local v_pkg v_tauri v_toml v_lock
    v_pkg=$(version_from_package_json)
    v_tauri=$(version_from_tauri_conf)
    v_toml=$(version_from_cargo_toml)
    v_lock=$(version_from_cargo_lock)
    if [ "$v_pkg" != "$v_tauri" ] || [ "$v_pkg" != "$v_toml" ] || [ "$v_pkg" != "$v_lock" ]; then
        echo "ERROR: version mismatch across the four bump files —" >&2
        echo "  package.json:                     $v_pkg" >&2
        echo "  src-tauri/tauri.conf.json:        $v_tauri" >&2
        echo "  src-tauri/Cargo.toml:             $v_toml" >&2
        echo "  src-tauri/Cargo.lock ($APP_CRATE_NAME): $v_lock" >&2
        echo "  Bump all four to the same version before publishing." >&2
        return 1
    fi
    printf '%s' "$v_pkg"
}

# THE merge function — isolated so --manifest-only can exercise it with no
# build and no network.
#
#   merge_manifest <manifest_json> <publish_version> <signature> <url>
#
# Prints the merged manifest JSON to stdout on success. Returns non-zero
# (version guard) if the manifest's .version != publish_version — never point
# a platform key at a mismatched version; a Mac client would loop onto an old
# build.
merge_manifest() {
    local manifest_json="$1"
    local publish_version="$2"
    local signature="$3"
    local url="$4"
    local manifest_version
    manifest_version=$(printf '%s' "$manifest_json" | json_version_of)
    if [ "$manifest_version" != "$publish_version" ]; then
        echo "ERROR: manifest version guard failed." >&2
        echo "  manifest .version:  $manifest_version" >&2
        echo "  publishing version: $publish_version" >&2
        echo "  Refusing to upsert the $UPDATER_PLATFORM_KEY key — a mismatched" >&2
        echo "  platform entry would point Mac clients at the wrong build and" >&2
        echo "  loop the updater. Re-run after Windows publishes this version." >&2
        return 1
    fi
    # Upsert ONLY this platform key; every other key's position is preserved.
    printf '%s' "$manifest_json" \
        | json_upsert_platform "$UPDATER_PLATFORM_KEY" "$signature" "$url"
}

# --- Arg parsing ----------------------------------------------------------
while [ $# -gt 0 ]; do
    case "$1" in
        --manifest-only)
            MANIFEST_ONLY=1
            shift
            if [ $# -eq 0 ]; then
                echo "ERROR: --manifest-only requires a fixture path argument." >&2
                exit 2
            fi
            MANIFEST_FIXTURE="$1"
            shift
            ;;
        --version)
            shift
            if [ $# -eq 0 ]; then
                echo "ERROR: --version requires a value." >&2
                exit 2
            fi
            OVERRIDE_VERSION="$1"
            shift
            ;;
        --sig-file)
            shift
            if [ $# -eq 0 ]; then
                echo "ERROR: --sig-file requires a path." >&2
                exit 2
            fi
            OVERRIDE_SIG_FILE="$1"
            shift
            ;;
        --url)
            shift
            if [ $# -eq 0 ]; then
                echo "ERROR: --url requires a value." >&2
                exit 2
            fi
            OVERRIDE_URL="$1"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "ERROR: unknown argument: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

# --- Shared config reads (need JSON backend) ------------------------------
init_json_backend
PRODUCT_NAME="$(json_get "$PROJECT_ROOT/src-tauri/tauri.conf.json" productName)"
APP_CRATE_NAME="$(read_app_crate_name)"

# =========================================================================
# --manifest-only: run the version guard + darwin upsert against a LOCAL
# fixture, print merged JSON, exit. No build, no network, no gh.
# =========================================================================
if [ "$MANIFEST_ONLY" -eq 1 ]; then
    if [ ! -f "$MANIFEST_FIXTURE" ]; then
        echo "ERROR: manifest fixture not found at: $MANIFEST_FIXTURE" >&2
        exit 1
    fi
    publish_version="$(resolve_publish_version)" || exit 1

    if [ -n "$OVERRIDE_SIG_FILE" ]; then
        if [ ! -f "$OVERRIDE_SIG_FILE" ]; then
            echo "ERROR: --sig-file not found: $OVERRIDE_SIG_FILE" >&2
            exit 1
        fi
        signature="$(tr -d '\r\n' < "$OVERRIDE_SIG_FILE")"
    else
        signature="__MANIFEST_ONLY_TEST_SIGNATURE__"
    fi

    if [ -n "$OVERRIDE_URL" ]; then
        asset_url="$OVERRIDE_URL"
    else
        asset_url="https://github.com/${REPO}/releases/download/v${publish_version}/${PRODUCT_NAME}.app.tar.gz"
    fi

    manifest_json="$(cat "$MANIFEST_FIXTURE")"
    merge_manifest "$manifest_json" "$publish_version" "$signature" "$asset_url"
    exit 0
fi

# =========================================================================
# REAL PATH — everything below here runs on a Mac on release day.
# =========================================================================

echo "Publishing macOS ${PRODUCT_NAME} for ${TARGET}"

# --- Preflight ------------------------------------------------------------
require_cmd gh
require_cmd rustup
require_cmd npx
require_cmd npm

if ! xcode-select -p >/dev/null 2>&1; then
    echo "ERROR: Xcode Command Line Tools not installed. Run: xcode-select --install" >&2
    exit 1
fi
if ! rustup target list --installed | grep -q "^${TARGET}\$"; then
    echo "ERROR: Rust target ${TARGET} is not installed." >&2
    echo "       Run: rustup target add ${TARGET}" >&2
    exit 1
fi
# APPLE_SIGNING_IDENTITY drives codesign (maps to bundle.macOS.signingIdentity).
# APPLE_ID/APPLE_PASSWORD/APPLE_TEAM_ID drive notarytool. The TAURI_SIGNING_*
# pair is the shared updater key (same one publish.ps1 uses on Windows).
require_env APPLE_SIGNING_IDENTITY APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID \
            TAURI_SIGNING_PRIVATE_KEY TAURI_SIGNING_PRIVATE_KEY_PASSWORD

publish_version="$(resolve_publish_version)" || exit 1
tag="v${publish_version}"
echo "Publishing version ${publish_version} (tag ${tag})"

cd "$PROJECT_ROOT"

# --- Build ----------------------------------------------------------------
# Tauri auto-signs (codesign) + notarizes (notarytool) when the APPLE_* env
# vars + APPLE_SIGNING_IDENTITY are present. createUpdaterArtifacts:true
# emits the .app.tar.gz + .sig updater artifacts next to the .dmg.
echo "Building signed + notarized bundle for ${TARGET} (this takes several minutes)..."
# Freshness sentinel: created just before the build so the post-build guard can
# prove every artifact was produced by THIS run (mtime newer than the sentinel).
build_sentinel="$(mktemp)"
npm run tauri -- build --target "$TARGET" || {
    echo "ERROR: tauri build failed." >&2
    exit 1
}

# --- Locate artifacts (version-anchored, no bare wildcards) ---------------
# Same stale-artifact defense as publish.ps1: resolve expected names from the
# current version + productName, never `*.tar.gz | head -1`.
#   - DMG carries the version in its name → strongest freshness anchor.
#   - The updater tarball + .sig use a stable canonical name Tauri regenerates
#     each build; Tauri does NOT put the version in the tarball name, so a
#     version-anchored name alone cannot prove freshness. Freshness is enforced
#     instead by the build sentinel (every artifact's mtime must be newer than
#     the sentinel created just before the build), which catches a stale
#     unversioned tarball left over from a prior build in a dirty target/ dir.
macos_bundle_dir="$PROJECT_ROOT/src-tauri/target/${TARGET}/release/bundle/macos"
dmg_dir="$PROJECT_ROOT/src-tauri/target/${TARGET}/release/bundle/dmg"
app_tarball="${macos_bundle_dir}/${PRODUCT_NAME}.app.tar.gz"
app_sig="${macos_bundle_dir}/${PRODUCT_NAME}.app.tar.gz.sig"
dmg="${dmg_dir}/${PRODUCT_NAME}_${publish_version}_aarch64.dmg"

if [ ! -f "$app_tarball" ]; then
    echo "ERROR: updater tarball not found at: $app_tarball" >&2
    echo "       Contents of ${macos_bundle_dir}:" >&2
    ls -la "$macos_bundle_dir" >&2 2>/dev/null || true
    exit 1
fi
if [ ! -f "$app_sig" ]; then
    echo "ERROR: updater signature not found at: $app_sig" >&2
    echo "       Was the build signed? Check the TAURI_SIGNING_PRIVATE_KEY env vars." >&2
    exit 1
fi
if [ ! -f "$dmg" ]; then
    echo "ERROR: DMG not found at: $dmg" >&2
    echo "       Contents of ${dmg_dir}:" >&2
    ls -la "$dmg_dir" >&2 2>/dev/null || true
    echo "       (If Tauri's DMG naming differs at this version, adjust the glob above.)" >&2
    exit 1
fi

# --- Freshness guard (build sentinel) -------------------------------------
# The updater tarball + .sig use unversioned stable names that Tauri overwrites
# each build, so a stale file from a prior build in a dirty target/ dir could
# pass the existence + version-anchored DMG checks above. The sentinel created
# before the build proves every artifact was produced by THIS run: each must be
# NEWER (by mtime) than the sentinel. A stale left-over file fails here.
for artifact in "$app_tarball" "$app_sig" "$dmg"; do
    if ! [ "$artifact" -nt "$build_sentinel" ]; then
        echo "ERROR: artifact is STALE (not newer than the build sentinel): $artifact" >&2
        echo "       It was left over from a prior build in a dirty target/ dir." >&2
        echo "       Rebuild clean (e.g. rm -rf src-tauri/target) and re-run." >&2
        exit 1
    fi
done
rm -f "$build_sentinel"

# --- Manifest upsert (the real cross-platform merge) ----------------------
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

# Download the manifest Windows already wrote for this tag.
echo "Downloading existing latest.json for ${tag}..."
if ! gh release download "$tag" --repo "$REPO" --pattern latest.json --dir "$workdir"; then
    echo "ERROR: could not download latest.json for tag ${tag}." >&2
    echo "       Windows (publish.ps1) must publish FIRST to create the release" >&2
    echo "       and write the windows-x86_64 key. Publish Windows, then re-run this." >&2
    exit 1
fi

signature="$(tr -d '\r\n' < "$app_sig")"
asset_url="https://github.com/${REPO}/releases/download/${tag}/$(basename "$app_tarball")"

# Version guard + darwin-aarch64 upsert (same function --manifest-only tests).
existing_manifest="$(cat "$workdir/latest.json")"
merged="$(merge_manifest "$existing_manifest" "$publish_version" "$signature" "$asset_url")" || exit 1
printf '%s\n' "$merged" > "$workdir/latest.json"

echo "Uploading merged latest.json + macOS artifacts to release ${tag}..."
gh release upload "$tag" \
    "$app_tarball" "$app_sig" "$dmg" "$workdir/latest.json" \
    --repo "$REPO" --clobber || {
    echo "ERROR: gh release upload failed." >&2
    exit 1
}

# --- R2 upload (non-fatal) ------------------------------------------------
# Stable key is what marketing points at; versioned key is the archive copy.
# Same posture as publish.ps1: warn + print the manual command, do NOT exit
# non-zero. The GitHub release + in-app updater are already published.
echo "Uploading DMG to R2 (downloads.writersnook.app)..."
# wrangler@4 is PINNED and --remote is EXPLICIT, both load-bearing: wrangler 4 defaults
# `r2 object put` to a LOCAL simulated bucket and reports "Upload complete" with no auth at all
# (observed first Mac day, 2026-07-03: both puts "succeeded" into .wrangler/state on the build
# Mac while the real bucket 404'd). A bare `npx wrangler` resolves to whatever happens to be
# installed, so the version — and with it the local/remote default — would be nondeterministic.
# --remote requires Cloudflare auth on THIS machine (CLOUDFLARE_API_TOKEN with R2 write, or a
# prior `wrangler login`); without it the put now fails LOUDLY into the non-fatal warn path
# below. Fallback: upload from the authed Windows machine (mac-day-runbook §7).
if (
    cd "$MARKETING_DIR" \
        && npx --yes wrangler@4 r2 object put "${R2_BUCKET}/WritersNook.dmg" --file "$dmg" --remote \
        && npx --yes wrangler@4 r2 object put "${R2_BUCKET}/$(basename "$dmg")" --file "$dmg" --remote
); then
    echo "R2 upload complete — stable + $(basename "$dmg")"
else
    echo "WARN: R2 upload failed (non-fatal). The GitHub release + updater are unaffected." >&2
    echo "      Manual upload (from marketing/, with CLOUDFLARE_API_TOKEN set or after 'npx wrangler login';" >&2
    echo "      can also be run from the Windows machine after 'gh release download ${tag} --pattern \"*.dmg\"'):" >&2
    echo "        npx --yes wrangler@4 r2 object put ${R2_BUCKET}/WritersNook.dmg --file \"$dmg\" --remote" >&2
    echo "        npx --yes wrangler@4 r2 object put \"${R2_BUCKET}/$(basename "$dmg")\" --file \"$dmg\" --remote" >&2
fi

# NOTE: secrets were exported by the operator, not created here, so they are
# intentionally NOT unset (unlike publish.ps1, which prompts + clears them).
echo "Done. Mac apps will see ${publish_version} on their next update check."
