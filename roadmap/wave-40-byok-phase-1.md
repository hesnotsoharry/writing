---
status: PLANNED
created: 2026-06-13
---

# Wave 40 — BYOK (bring-your-own-key) Phase 1

## Plan

### Status

DRAFT · target v0.9.0 · drafted 2026-06-13.

### Goal

After this wave, a user can paste their own Anthropic API key into Settings → AI and have every AI assist (brainstorm, critique, proofread, beta-read) route **directly** to `api.anthropic.com` from the Rust backend — their key and their prose never transit the writersnook.app proxy. The key is held in the OS keychain (Windows Credential Manager), never in WebView localStorage or SQLite, and never re-enters the WebView JavaScript after the initial paste. When BYOK is active the managed credit meter is hidden and untouched; when no BYOK key is set the existing managed-subscription path is unchanged. A "Custom endpoint" option appears as a greyed "Coming soon" stub. The codebase gains a new Rust module (`src-tauri/src/byok.rs`) exposing five Tauri commands and a `keyring`/`reqwest`-streaming BYOK pipeline, plus a JS client (`src/features/ai/byok.client.ts`) that bridges them via a Tauri `Channel`.

### Scope

**In scope:**

- New Rust module `src-tauri/src/byok.rs` with five commands: `byok_set_key`, `byok_has_key`, `byok_clear_key`, `byok_chat` (streaming via `Channel<NormalizedEvent>`), `byok_stop` (cancellation). Registered in `src-tauri/src/lib.rs` `invoke_handler`; cancellation map registered via `.manage()`.
- OS keychain storage via `keyring = "4"` + `keyring-core = "1"`, with `use_native_store(false)` called once at app startup in `lib.rs`. Service/user target `com.coles.writing` / `byok-anthropic`.
- Direct Anthropic streaming from Rust: `reqwest` gains the `stream` feature; `futures` added for `StreamExt`. Raw Anthropic SSE parser in Rust → `NormalizedEvent` enum (serde `tag="type"`, camelCase) matching the existing TS union.
- Rust-side verb→model policy: all verbs pinned to `claude-haiku-4-5-20251001` for Phase 1 (temperature/max_tokens per verb).
- New JS client `src/features/ai/byok.client.ts`: `byokSetKey` / `byokHasKey` / `byokClearKey` / `byokStop` + `streamByokChat` (uses `Channel` from `@tauri-apps/api/core`).
- `useByokMode()` hook in `AssistantPanel.tsx` `AiSlot` (reads `byokHasKey` on mount, listens for the `byok:key-changed` CustomEvent); `byokMode` threaded through panel props.
- `execSend` (`AssistantPanel.hooks.ts`) forks on `byokMode` to `streamByokResponse`, reproducing all managed-path bookkeeping (optimistic user+AI messages, `setStreamingId`, `abortRef` arm for unmount cleanup, `finally`-clear).
- Meter isolation: `useAiBalance` no-ops in `byokMode` (`plan="active"`, `usedPct=0`); `AiMeter` explicitly hidden via a `byokMode` conditional.
- `Settings.ai.tsx`: BYOK key-entry row (paste → `byokSetKey` → dispatch `byok:key-changed`) with a masked field; "Remove key" when a key is set; "Custom endpoint" greyed "Coming soon" stub.
- Hardening: error-message sanitization (no key substring ever returned to JS; Anthropic 401 → "Invalid API key — check Settings", 429 → "Rate limited by Anthropic — wait a moment"); `byok_stop` on component unmount; suppress the "monthly allowance" cost-cue copy in `byokMode`; a BYOK mode badge in the panel header.

**Out of scope:**

- **Model picker (Sonnet/Opus selection).** Phase 1 is Haiku-only; the toggle is a later wave (W44). Deferral path: separate wave.
- **"Custom endpoint" / non-Anthropic providers (Ollama, OpenAI, etc.).** Selector option ships greyed "Coming soon"; no wiring. Deferral path: BYOK Phase 2.
- **macOS Keychain wiring/testing.** `use_native_store()` auto-selects Keychain on macOS, but Phase 1 is verified on Windows only. Deferral path: the Phase-2 mobile/mac spike.
- **Managed-subscription `aiLicenseKey` entry UI.** Confirmed this session: there is NO UI anywhere to set `aiLicenseKey` (the AI-subscription proof) to a non-empty value — `ActivationGate` handles only the separate Lemon Squeezy product license (`app_meta.license`). This is a real pre-existing gap but is **independent of BYOK** (a BYOK user never needs a managed key). Flagged to Cole separately; deferral path: its own fix/wave.
- **Server-side proxy changes.** BYOK bypasses the proxy entirely; `marketing/functions/api/ai/*` is untouched.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Walking skeleton: keychain + Rust streaming + Channel, end-to-end | sonnet-implementer | honeycomb · **cross-boundary (new IPC + external API + OS keychain)** · Thinnest end-to-end slice touching all three new surfaces. Add `keyring`/`keyring-core`/`futures` deps + `reqwest` `stream` feature; `use_native_store(false)` at startup. `byok.rs`: 5 commands incl. `byok_chat` (reqwest stream → raw Anthropic SSE parser → `Channel<NormalizedEvent>`) + `byok_stop`. `byok.client.ts` with `streamByokChat` + a temporary dev console.log harness. **Acceptance test (orchestrator-authored, Rust):** `cargo test` asserts `NormalizedEvent::Token{text:"hi"}` serializes to exactly `{"type":"token","text":"hi"}` and the SSE parser extracts `text` from a sample `content_block_delta` line. Verify NormalizedEvent serde shape via the cargo test BEFORE wiring to real UI. | Cole opens Windows Credential Manager (Control Panel → Credential Manager → Windows Credentials) and sees a `com.coles.writing/byok-anthropic` entry appear after a test key is set and disappear after clear; the full token round-trip is confirmed at the end-of-wave CDP smoke (Cole's live key). |
| 2 | Settings UI: BYOK key-entry row + mode hook | sonnet-implementer | trophy · internal-only wiring to a UI surface · `Settings.ai.tsx` new "Your API key" row: masked paste field → `byokSetKey` → dispatch `byok:key-changed`; "Remove key" shown when a key is set; "Custom endpoint" greyed "Coming soon" stub. Add `useByokMode()` to `AiSlot` and thread a `byokMode` prop down. | In the running app, Settings → AI panel renders a "Your API key" row with a paste field; after the user pastes a key and clicks save, the row shows "Remove key", and the "Custom endpoint" row shows a greyed "Coming soon" label. |
| 3 | Meter isolation + execSend BYOK fork | sonnet-implementer | honeycomb · cross-boundary (forks the shared send/stream path) · `useAiBalance` no-ops in `byokMode` (`plan="active"`, `usedPct=0`); `AiMeter` hidden via explicit `byokMode` conditional (usedPct=0 does NOT hide it). `execSend` forks to `streamByokResponse` reproducing ALL bookkeeping; remove the Phase-1 dev console.log harness. `canCompose` unchanged. | In the running app, the AI assistant panel — with a BYOK key set — shows no managed credit meter, and sending a prompt streams the assistant's reply token-by-token into the panel (confirmed at CDP smoke with Cole's live key). |
| 4 | Hardening: errors, unmount cleanup, cost-cue copy, mode badge | sonnet-implementer | trophy · internal-only + user-facing copy · Error sanitization contract (no key substring to JS; 401/429 fixed messages); `byok_stop` called on panel unmount (`useEffect` teardown, mirrors `abortRef.abort()`); suppress "monthly allowance" cost-cue (`AssistantPanel.parts.tsx`) in `byokMode`; BYOK mode badge in panel header; BYOK network errors surface in conversation text (NOT the managed offline banner — documented in Locked decisions). | In the running app with BYOK active, an invalid key produces "Invalid API key — check Settings" in the panel (never the raw key), the Stop button halts a stream mid-flight, and no "monthly allowance" text appears anywhere in BYOK mode. |

### Acceptance criteria

- [ ] `src-tauri/src/byok.rs` exists exporting `byok_set_key`, `byok_has_key`, `byok_clear_key`, `byok_chat`, `byok_stop`; all five are registered in `src-tauri/src/lib.rs` `invoke_handler`, and the cancellation state is registered via `.manage()`.
- [ ] `src-tauri/Cargo.toml` declares `keyring = "4"`, `keyring-core = "1"`, `futures = "0.3"`, and `reqwest` with the `stream` feature; `use_native_store(false)` is called once during app setup in `lib.rs`.
- [ ] A Rust unit test (`cargo test` in `src-tauri/`) asserts `NormalizedEvent::Token { text }` serializes to `{"type":"token","text":...}` (and `Done`/`Error` to their `done`/`error` tags), and that the SSE parser extracts the delta text from a sample `content_block_delta` data line.
- [ ] After `byok_set_key("sk-ant-test")`, a `com.coles.writing` / `byok-anthropic` entry is visible in Windows Credential Manager; after `byok_clear_key`, it is gone; `byok_has_key` returns `true` then `false` across those.
- [ ] `src/features/ai/byok.client.ts` exists exporting `byokSetKey`/`byokHasKey`/`byokClearKey`/`byokStop`/`streamByokChat`, with `Channel` imported from `@tauri-apps/api/core`.
- [ ] `Settings.ai.tsx` renders a "Your API key" row (masked paste field + save) that, on save, calls `byokSetKey` and dispatches a `byok:key-changed` CustomEvent, shows "Remove key" when a key is present, and renders a greyed "Coming soon" "Custom endpoint" row.
- [ ] With a BYOK key set, `AiMeter` does not render in the assistant panel, and `useAiBalance` performs no network fetch to `/api/ai/balance` (no managed-meter call fires).
- [ ] With a BYOK key set, `execSend` routes through `streamByokResponse` (not `acquireTokenCached`/`streamChat`); with no BYOK key set, the managed path is byte-for-byte unchanged.
- [ ] No Rust error string returned to JS contains any substring of the API key; an Anthropic 401 surfaces as "Invalid API key — check Settings" and a 429 as "Rate limited by Anthropic — wait a moment".
- [ ] The panel's unmount `useEffect` calls `byok_stop` for any in-flight BYOK stream; the "monthly allowance" cost-cue copy does not appear in `byokMode`.
- [ ] `npm run lint`, `tsc`, and `npm run test` are green; `cargo build` (or `cargo check`) succeeds in `src-tauri/` (or, if the local toolchain cannot link a full Tauri build, `cargo check`/`cargo test` on the `byok` module is green and the link step is flagged for Cole's build).

### Files the next agent should read first

1. `roadmap/wave-40-DRAFT-research.md` (renamed to `wave-40-byok-phase-1-research.md` on pass) — current keyring v4 / Anthropic-SSE / Channel / NormalizedEvent specs the phase briefs are grounded in. **Read first.**
2. This wave file's `## Locked decisions` section — the design contract and the four review-flag resolutions.
3. `src/features/ai/AssistantPanel.hooks.ts` — `execSend` (the fork point, ~line 230), `streamAiResponse`, `acquireTokenCached`; the managed path the BYOK branch must mirror without breaking.
4. `src/features/ai/AssistantPanel.tsx` — `AiSlot`, `useAiBalance`, `canCompose` (~line 147), `AiMeter` render site, the unmount-cleanup `useEffect`.
5. `src/features/ai/ai.client.ts` — `streamChat` and the `NormalizedEvent` TS union the Rust enum must match exactly; the normalized-SSE design (Decision 4).
6. `src/features/settings/Settings.ai.tsx` + `settings.store.ts` — the AI settings section the BYOK row joins; note `aiLicenseKey` is the managed (localStorage) key — BYOK does NOT reuse it.
7. `src-tauri/src/lib.rs` — the `invoke_handler` + `.manage()` + setup where new commands, state, and `use_native_store` register.
8. `src-tauri/Cargo.toml` — current deps (`reqwest = { version = "0.12", features = ["json"] }` present; `stream`/`keyring`/`futures` to add).
9. `src/features/ai/AssistantPanel.parts.tsx` — `PanelFooter` cost-cue copy (~lines 206–210) to suppress in `byokMode`.

### Note to the implementer

This wave bolts a second, parallel AI pipeline (BYOK → direct Anthropic) alongside the existing managed-proxy pipeline — it does not replace it. The spirit is **isolation**: when no BYOK key is set, the managed path must behave exactly as before; when a BYOK key is set, nothing touches the managed meter or proxy. The privacy guarantee is load-bearing — the user's key lives only in Rust (keychain → Rust memory → outbound header) and must NEVER re-enter the WebView or appear in any error string or log. First step: verify the `## Locked decisions` section is filled, then read the research sidecar — keyring v4's `use_native_store` footgun and the `NormalizedEvent` serde shape are the two things most likely to silently waste a day. Resist the temptation to "improve" the managed `execSend`/`useAiBalance` while forking them, to add a model picker (that's W44), or to wire the "Custom endpoint" stub. The Channel serde contract is the highest-risk seam — pin it with the cargo test before wiring to UI.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

> These passed the decision-review cell this session: `sonnet-architect` produced the design, `sonnet-adversarial-reviewer` (Posture: attack-decision) returned FLAG (not BLOCK), the orchestrator adjudicated FLAG-with-all-flags-folded-into-the-plan.

## Decision 1: BYOK routing — direct to Anthropic from Rust

**Context:** Where a BYOK user's request goes — direct to `api.anthropic.com` vs through the existing writersnook proxy. Touches the privacy narrative.
**Pick:** Direct to `api.anthropic.com` from the **Rust backend** (reqwest streaming → Tauri `Channel<NormalizedEvent>` → JS). Key + prose never touch writersnook servers; key never enters the WebView after paste.
**Rationale:** Cole's explicit decision — the strongest privacy claim and the whole point of BYOK. Rust-owns-the-call also wins on streaming (reqwest has first-class streaming; `tauri-plugin-http` does not) and CORS (none at the Rust layer). The cost — client-side raw Anthropic SSE parsing + a Rust-side verb→model policy — is accepted.
**Consequences:** Client now owns Anthropic wire-format parsing (breaks the managed path's "Decision 4" normalized-SSE separation, in the BYOK branch only); no server-side rate/abuse buffer for BYOK (the user's own quota governs).
**Enforcement:** advisory-only (architecture); the meter-isolation acceptance criteria + the per-phase adversarial reviewer guard the privacy/isolation invariant.
`durable: candidate`

## Decision 2: Key storage — `keyring` crate v4, key stays in Rust

**Context:** Where the BYOK Anthropic key persists, given the OS-keychain requirement.
**Pick:** `keyring = "4"` + `keyring-core = "1"` (Windows Credential Manager via auto-pulled `windows-native-keyring-store`), behind custom Tauri commands. Key is read only inside Rust at call time; JS gets a boolean (`byok_has_key`), never the secret. `use_native_store(false)` called once at startup.
**Rationale:** v4 is current (verified `cargo add` → v4.0.1); `tauri-plugin-keyring` (v0.1.0, JS-readable) is younger and its JS-side read API is unnecessary when Rust owns the call. Stronghold is the wrong tool (file vault, deprecated v3). v4 removed v3 feature flags; without `use_native_store` there is no active store (silent non-persistence footgun).
**Consequences:** A new Rust dependency surface; sync keyring calls must run under `spawn_blocking`. macOS Keychain comes free via the same path (future phase).
**Enforcement:** advisory-only; the "key visible in Credential Manager / never in localStorage|SQLite" acceptance criteria are the check.
`durable: candidate`

## Decision 3: NormalizedEvent IPC contract pinned by a Rust serde test

**Context:** The Rust→JS streaming contract must match the existing TS `NormalizedEvent` union exactly, or events silently match no branch.
**Pick:** Rust enum `#[serde(tag="type", rename_all="camelCase")]` → `Token{text}` / `Done{input_tokens,output_tokens,credits_cost}` / `Error{message}`, pinned by a `cargo test` asserting the exact JSON (`{"type":"token","text":...}` etc.). `credits_cost` is always 0 for BYOK.
**Rationale:** The adversarial review named this the highest-risk seam (silent failure: tokens arrive, no branch matches, nothing renders, nothing throws). A serde-shape unit test pins it without needing a live Anthropic call — it doubles as the walking-skeleton acceptance test.
**Consequences:** The TS union shape becomes a contract the Rust test guards; changing one side requires updating the test.
**Enforcement:** `src-tauri/` `cargo test` (the serde-shape assertion) — Phase-1 acceptance gate.

## Decision 4: BYOK network errors surface in conversation text, not the managed offline banner

**Context:** Review flag — a BYOK network failure could drive the managed offline banner (via `setOffline`) or just surface as a conversation-thread error message. The managed `useAiBalance` is no-op'd in BYOK mode, so `setOffline` is a stub there.
**Pick:** BYOK errors surface in the conversation thread (the existing `{type:"error"}` → error-message-in-panel path), NOT the managed offline banner. Anthropic 401 → "Invalid API key — check Settings"; 429 → "Rate limited by Anthropic — wait a moment" (NOT `credits-exhausted`, which is proxy-only).
**Rationale:** The offline banner is coupled to the managed-meter/balance lifecycle which BYOK deliberately bypasses; reusing it would re-introduce managed-path coupling. A per-message error is the clearer signal for "your key/your call failed" and keeps the BYOK branch decoupled. Error strings are fixed constants — no key substring ever reaches JS (the security contract).
**Consequences:** BYOK has no global "you're offline" affordance; each failed send shows its own error. Acceptable for Phase 1.
**Enforcement:** the error-sanitization acceptance criterion + Phase-4 adversarial reviewer (single tier — security-relevant copy, not skip).

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 — walking skeleton | yes (sonnet-implementer + 3-seat panel + correctness patch) | yes | e946df6 | Deferred to CDP smoke (keychain entry + token stream need Cole's live key); cargo 11/11 incl. frozen serde contract + new correctness tests; panel 0-BLOCK/2-FLAG/1-PASS, all FLAGs fixed |
| 2 — Settings UI + useByokMode + meter hide | yes (sonnet-implementer + single adversarial seat + flag-fix) | yes | 4b02cd6 | Deferred to CDP smoke (Settings row render + paste→Remove flip); tsc 0, lint 0, 26 tests incl. AiMeter-hide + ByokKeyRow render; review FLAG (prop required + tests) addressed |
| 3 — execSend BYOK fork + meter no-op + harness removal | yes (sonnet-implementer + single adversarial seat + orchestrator self-fix) | yes | b0b7383 | Deferred to CDP smoke (live token stream); tsc 0, lint 0, 17 tests incl. anti-tautological fork test; review FLAG abortRef-clobber race fixed (identity-guard in finally); partial-persist-on-stop accepted-as-intentional (kept for writing UX) |
| 4 — hardening: BYOK badge + cost-cue suppression | yes (sonnet-implementer; per-phase review folded into wave-end attack-diff cell) | yes | (this commit) | Deferred to CDP smoke ("Your key" badge visible + no "monthly allowance" copy in BYOK); tsc 0, lint 0, 21 tests incl. 4 badge/cost-cue cases. Error-sanitization + unmount-cancel already done in P1/P3 |

## Follow-up candidates

- Managed-subscription `aiLicenseKey` has no entry UI anywhere: a paying AI subscriber cannot input their license key (consent flow enables the assistant but never collects a key; `ActivationGate` handles only the Lemon Squeezy product license → `app_meta.license`, not `aiLicenseKey`). | why it cannot be done in-wave: out of W40's BYOK scope and is a managed-path product decision (where/how a subscriber enters their key — possibly the product license IS the AI key and the gap is a wiring mismatch) that needs Cole's input. | present-harm: K2 — `src/features/settings/Settings.ai.tsx:30` is the only `aiLicenseKey` write and it clears to `""`; verified this session (no setter to a non-empty value exists in `src/` or `src-tauri/`), so the shipped managed AI-subscription path cannot be activated by a user.

## Result

<!-- Filled at ship by wrap team. -->
