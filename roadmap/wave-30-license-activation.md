---
status: PLANNED
created: 2026-06-09
---

# Wave 30: license-activation

## Plan

### Status

PLANNED · target v0.3.0 · drafted 2026-06-09 · blocks public launch (app is currently fully-unlocked freeware)

### Goal

The app gates first use behind a one-time Lemon Squeezy license activation: on launch with no local
activation record, a full-screen "Enter your license key" gate renders instead of the writing UI;
pasting a valid key calls LS `activate` (Rust-side HTTP), the result persists to SQLite, and the app
unlocks forever — no network call ever again (offline brand promise). Settings ▸ About shows the
activation status. The licensing model is LOCKED by `roadmap/launch-infra-checklist.md` § Licensing &
activation architecture — honor it, don't re-decide it.

### Scope

**In scope:**

- `src-tauri/Cargo.toml` + `src-tauri/src/lib.rs` (+ new `src-tauri/src/license.rs`): `reqwest` dep; `activate_license(license_key) -> Result<LicenseActivation, String>` Tauri command — POST `https://api.lemonsqueezy.com/v1/licenses/activate`, form-encoded `license_key` + `instance_name` (machine hostname, fallback `"WritersNook device"`), `Accept: application/json`; parse success/error JSON (shapes in Locked decisions D3)
- `src/db/migrations2.ts`: migration v14 — `app_meta (key TEXT PRIMARY KEY, value TEXT)` key-value table
- New `src/features/license/` — `license.store.ts` (read/write activation record `{licenseKey, instanceId, activatedAt}` to `app_meta`), `ActivationGate.tsx` (full-screen gate UI), seam tests in `src/test/`
- `src/App.tsx`: boot-path wiring — after DB init, read activation record; no record → render gate instead of main UI; gate success → proceed
- `src/features/settings/Settings.sections.tsx` AboutSection: license status row ("Activated · key ending …XXXX")
- `src-tauri/capabilities/*.json` only if a plugin route requires it (reqwest from Rust needs no capability entry)

**Out of scope:**

- In-app deactivation → website account page handles it (shipped, wave m4)
- Trial mode, validate-on-every-launch, ANY phone-home after activation → permanently out per locked model (refund abuse accepted; don't-over-invest-in-DRM is a locked decision)
- License-key entry styling beyond existing tokens/sheet language → defer polish to a UI-polish wave
- Auto-detecting the key from the purchase email / deep links → Phase 2+ candidate, not filed (no present harm)

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Walking skeleton: Rust `activate_license` end-to-end | sonnet-implementer | honeycomb · **cross-boundary (external API)** · reviewTier **panel** · Add reqwest; implement command + JSON parse (pure fn, unit-tested against fixture success/limit-reached/404 bodies); register in invoke_handler; TEMP dev-only invoke path for smoke. Orchestrator authors failing acceptance test first (contract: command name, arg shape, success/error return shape). | In the dev app (CDP 9222), `invoke("activate_license", {licenseKey: "junk"})` from the console returns LS's real error (e.g. "license key not found") — proof the full Rust→LS→parse→frontend path is live. |
| 2 | Persistence: migration v14 + license store | sonnet-implementer | pyramid · cross-boundary (persistent storage) · reviewTier **single** · `app_meta` KV migration + `license.store.ts` read/write/parse with seam tests (mock tauri-plugin-sql per existing db test patterns). **GOTCHA (project memory): appending a migration breaks prior migration tests (hardcoded LATEST + partial seed fixtures) — run the FULL vitest suite in this phase, not touched-only.** Orchestrator authors acceptance test for the record round-trip contract. | Internal — no observation point (exercised by Phase 3's gate). |
| 3 | ActivationGate UI + boot-path wiring | sonnet-implementer | trophy · internal-only (consumes P1+P2) · reviewTier **single** · smoke: true · Full-screen gate in App.tsx boot path (after DB init, before main UI): states idle / activating / error / success; LS limit-reached error verbatim, friendly invalid-key message, DISTINCT offline/network-failure message; "Buy WritersNook" link → https://writersnook.app/pricing + "your key is in your purchase email" note; styled via tokens.css + .sheet/.btn primitives (mimic UpdateModal). On activate success: write record via license store, THEN unlock; if the local write fails after LS success, surface a retry — do NOT discard the activation (LS already counted it). DEV bypass per D4. | Launching the dev app with no activation record (clear `app_meta`) shows the gate instead of the binder; entering a junk key shows the friendly invalid-key error; CDP screenshot of both states. |
| 4 | Settings ▸ About license row + wrap gates | sonnet-implementer | trophy · internal-only · reviewTier **single** · smoke: true · About section row: "License — Activated · key ending …XXXX" (masked, last 4 only) reading from license store; remove Phase 1's TEMP dev invoke path; full suite + lint + tsc + cargo check. | Settings ▸ About in the dev app shows the masked license row after activation (CDP screenshot). |

Walking-skeleton rule honored: this wave's new surface is the app's FIRST outbound HTTP call from
Rust — Phase 1 is the thinnest full-stack slice (command → LS → parsed result → frontend), proven
against the real LS API before any UI or persistence is layered on.

### Acceptance criteria

- [ ] Fresh profile (no `app_meta` activation row): app shows the activation gate, NOT the writing UI; manuscripts/DB are untouched (gate blocks UI only, never data)
- [ ] `activate_license` returns parsed success `{instanceId, activationLimit, activationUsage}` on a valid test-mode key, and LS's error string on invalid/limit-reached/disabled keys (vitest seam + Rust unit tests on fixture JSON)
- [ ] Network failure (offline) shows a distinct "couldn't reach the license server" message — NOT "invalid key"
- [ ] After successful activation: record persisted in `app_meta`; relaunch goes straight to the writing UI with ZERO network calls (verify: no LS request in CDP network log on second launch)
- [ ] Settings ▸ About shows "Activated · key ending …XXXX" (last 4 chars only)
- [ ] Migration v14 applied cleanly on an existing v13 database (partner-upgrade path) AND on a fresh install; FULL vitest suite green (migration-test gotcha)
- [ ] `npm run test` + `tsc` + `npm run lint` + `cargo check` all green; no TEMP/dev invoke path remains in shipped code
- [ ] DEV bypass (D4) is compile-time dead in production builds

### Files the next agent should read first

1. `roadmap/launch-infra-checklist.md` — § Licensing & activation architecture: the LOCKED model this wave implements
2. `src-tauri/src/lib.rs` — existing command + registration + `Result<T, String>` error pattern (lines 6–72)
3. `src/db/migrations2.ts` — append-only migration registry, latest v13; mind the LATEST constant
4. `src/App.tsx` lines ~107–136 + ~311–344 — boot/DB-init flow where the gate mounts
5. `src/features/updater/UpdateModal.tsx` + `src/styles/tokens.css` — the visual language to mimic (.scrim/.sheet/.btn)
6. `src/features/settings/Settings.sections.tsx` — AboutSection (~line 290) for the license row
7. `src/test/SettingsReveal.test.tsx` — the invoke-mock test pattern (vi.hoisted + vi.mock of @tauri-apps/api/core)

### Note to the implementer

This wave sells trust: activate once, then the app is offline forever. The temptation to resist is
adding "just one" startup validation call or expiry re-check — that is FORBIDDEN by the locked model;
startup is a local SQLite read only. Refunded keys keeping local access is accepted on purpose.
Second temptation: building DRM hardening (obfuscation, flag encryption) — don't; the 3-activation
limit + one-time check is the decided friction level. First step: verify the ## Locked decisions
section has decisions filled in.

Before declaring a phase complete, restate the observation point from the Phases table Observation
column in your own words and describe what you actually observed there. If you could not observe it
directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not
substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but
not sufficient.

**Rollout precondition (NOT a code task):** Cole + writing partner run installed builds today. Before
this wave ships in a release, Cole generates manual license keys in the LS dashboard for both
existing users — otherwise the update gates them out of their own manuscripts' UI until a key
arrives. The gate must never touch or migrate-away local data; it only withholds the UI.

**Known gap:** LS test-mode keys are required for live-fire verification of the success path (Phase 1
observation uses an invalid key on purpose — error-path proof). Cole holds the test store; a
test-mode key should be in hand by Phase 3 smoke. If unavailable, the success path ships verified by
seam tests + fixture JSON only — say so in the phase report.

## Locked decisions

> Before any decision is written here it must pass the decision-review cell
> (`~/.claude/rules/best-practice-spectrum.md`, M-42 P2): `sonnet-architect` produces it, a
> `sonnet-adversarial-reviewer` with `Posture: attack-decision` clears it, the orchestrator
> adjudicates — THEN it is appended. Trivial decisions skip via the review-tier sidecar.

## Decision D1: Licensing model (inherited — pre-locked)

**Context:** How activation works, end to end. **Pick:** the model in `roadmap/launch-infra-checklist.md` § Licensing & activation architecture — one-time LS activate, local flag, never phone home, 3 activations/key, no expiry, no heavy DRM. **Rationale:** decided pre-wave by Cole + launch research; the brand promise (offline, no account) depends on it. **Consequences:** refund abuse accepted; no kill switch. **Enforcement:** advisory-only (plan + adversarial review checks divergence). `durable: candidate`

## Decision D2: HTTP from Rust via reqwest, not webview fetch

**Context:** LS License API CORS behavior for `tauri://localhost` origins is undocumented. **Pick:** `reqwest` (default TLS) called inside the Tauri command; no tauri-plugin-http, no webview fetch. **Rationale:** sidesteps CORS entirely; keeps the key off the wire from the webview; matches existing Rust-command patterns (`Result<T, String>`). **Consequences:** first HTTP dep in the Rust crate (compile-time cost ~moderate); capabilities files untouched. **Enforcement:** Phase-1 acceptance test (command contract) + adversarial review.

## Decision D3: API contract (researched 2026-06-09, official LS docs via ctx7)

**Context:** Exact LS surface. **Pick:** POST `https://api.lemonsqueezy.com/v1/licenses/activate`, `application/x-www-form-urlencoded` body `license_key` + `instance_name`, `Accept: application/json`, NO auth header. Success: `{activated: true, instance: {id}, license_key: {activation_limit, activation_usage, status}}`. Errors 400/404/422: `{activated: false, error: "<message>"}`. Statuses active/inactive/expired/disabled; 60 req/min/IP. **Rationale:** verified against current official docs, not training data. **Consequences:** parse layer asserts these shapes; fixture JSON mirrors them. **Enforcement:** Rust unit tests on fixture bodies.

## Decision D4: Activation record in SQLite `app_meta`, not localStorage; DEV-only gate bypass

**Context:** Where the local flag lives, and how dev/smoke workflows survive the gate. **Pick:** new migration v14 `app_meta` KV table; record `{licenseKey, instanceId, activatedAt}` as JSON value under key `license`. Gate bypass ONLY when `import.meta.env.DEV` is true AND `localStorage["writing.devLicenseBypass"] === "1"` — compile-time dead in production bundles. **Rationale:** SQLite is the owned, backed-up store (localStorage/WebView2 profile data can be wiped independently of the user's documents); DEV bypass keeps `tauri dev` + CDP smoke of unrelated features working while letting gate smoke clear the flag. **Consequences:** backup-restore carries activation to a new machine (accepted — same don't-over-invest posture); migration gotcha fires (full-suite rule in Phase 2). **Enforcement:** acceptance criteria items 6 + 8; production-bundle check in Phase 4 gates.

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|

## Follow-up candidates

<!-- DEFAULT: empty. Tier-3 triple gate (VALUE present-harm + STRUCTURAL + CLEARABILITY) required. -->

## Result

<!-- filled at ship by wrap team -->
