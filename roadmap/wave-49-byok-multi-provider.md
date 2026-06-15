---
status: PLANNED
created: 2026-06-14
---

# Wave 49 — OpenAI BYOK multi-provider

## Plan

### Status

DRAFT · target v0.9.0 · drafted 2026-06-14.

### Goal

After this wave, a user can paste their own **OpenAI API key** in Settings → AI Writing Assistant
alongside their existing Anthropic key, and the assistant routes **direct from Rust to
`api.openai.com`** (key + prose never touch WritersNook servers) — mirroring W40's Anthropic-direct
pattern. The Rust BYOK layer (`src-tauri/src/byok.rs`) is generalized from Anthropic-hardcoded into a
**provider-routed engine** generic over `{base_url, auth_header, wire_format}`, with a live
OpenAI-compatible SSE adapter. The model picker becomes **registry-driven**: when both keys are
present it shows a merged Claude + ChatGPT menu (GPT-5.4 / 5.4-mini / 5.5), the selected model
routes to the matching provider/key, and the "Your key" badge names the active provider. A
**persistent per-provider usage readout** (accumulated tokens + estimated cost) gives BYOK users the
cost visibility the managed meter provided. The engine and picker registry are shaped so **Wave 45
(local models) consumes them without re-forking** — W49 lands first and publishes the contract.

### Scope

**In scope:**

- **Rust engine (`src-tauri/src/byok.rs`):** refactor the Anthropic-hardcoded path into a
  provider-routed engine generic over `{base_url, auth_header, wire_format}`. Two wire formats live:
  Anthropic (lifted behavior-preserving) + OpenAI-compatible (new SSE parser).
- **Rust OpenAI adapter:** new OpenAI Chat Completions streaming parser (`choices[0].delta.content`
  fragments, literal `data: [DONE]` terminator, final usage-bearing chunk with empty `choices` +
  populated `usage`). **Base-URL-parameterized** but instantiated only with the trusted constant
  `https://api.openai.com` this wave (custom URLs are W45). GPT-5 param mapping
  (`reasoning_effort: 'none'` + `temperature` for the four Standard verbs; `max_completion_tokens`).
- **Keyring:** second per-provider entry `byok-openai` (service `com.coles.writing`, mirroring
  `byok-anthropic`). New `byok_openai_set_key` / `byok_openai_has_key` / `byok_openai_clear_key` /
  `byok_openai_chat` / `byok_openai_stop` commands; `byok_chat` extended to accept a `model` param.
- **Frontend provider discriminant:** decompose `byokMode: boolean` → a provider state
  (`anthropic | openai | null`) derived from which keys are present; `useByokMode` listens to both
  `byok:key-changed` and a new `byok:openai-key-changed` event.
- **Registry-driven picker:** a provider→models registry (the contract W45 appends to); the picker
  renders from it; merged menu showing all models for every provider with a key; selecting a model
  routes to that provider; "Your key" badge reflects the active model's provider.
- **Settings:** `ByokOpenAiKeyRow` (placeholder `sk-...`, label "OpenAI API key", description
  "Direct to OpenAI — your prose never touches our servers"); relabel existing row "Anthropic API
  key".
- **Persistent per-provider usage readout:** accumulate per-turn tokens (from each provider's `done`
  usage) into a persisted per-provider running total + estimated USD (from known cloud rates); a
  readout surface + a clear/reset affordance.
- Model display entries for `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.5` (rates from the research sidecar).

**Out of scope:**

- **Custom / OpenAI-compatible base URL + local models** → **Wave 45**. W49 ships only the trusted
  `api.openai.com` constant; the URL-entry UI and loopback/https/cert validation guardrails are W45's
  (that's where untrusted user-typed URLs enter). W49's adapter is base-URL-parameterized so W45
  consumes it without refactor.
- **Gemini / Mistral / other cloud providers** → later wave; the engine generalizes to them but only
  OpenAI is wired this wave.
- **Managed-path (server) changes** → none. The Cloudflare Worker `ProviderAdapter` (W44) is a
  separate code path; W49 is Rust-direct only.
- **Cross-provider auto-fallback on outage** → deferred (error + existing BYOK error path); a mid-task
  silent model switch is a separate product decision.
- **Anthropic billing / RATES math changes** → untouched; BYOK does not meter against managed credit.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Walking skeleton: OpenAI key → Rust-direct stream → panel | sonnet-implementer | **Walking skeleton / cross-boundary (external API) / honeycomb.** Thinnest **end-to-end slice**: add `byok-openai` keyring + set/has/clear commands; new `byok_openai_chat` with a **hardcoded `gpt-5.4`**, the new OpenAI SSE parser (grounded in research sidecar §1–2 — subtract `cached_tokens` from `prompt_tokens`), `reasoning_effort:'none'`+temperature; thin TS wrapper + provisional route so one verb streams from OpenAI; one **CDP smoke**. Anthropic path untouched (zero-regression). | In a live session with an OpenAI key saved, the assistant panel renders a streaming GPT-5.4 reply token-by-token. |
| 2 | Provider-routed Rust engine (generalize `byok.rs`) | sonnet-implementer | **Internal refactor / honeycomb (Rust unit tests per adapter parser).** Behavior-preserving: extract the engine generic over `{base_url, auth_header, wire_format}`; lift Anthropic verbatim (existing cargo tests guard); fold Phase 1's OpenAI path into a base-URL-parameterized `OpenAIAdapter` (instantiated with the `api.openai.com` constant); `byok_chat` gains `model`. **Publish the adapter fn signature + provider-registry shape for the W45 agent.** Engine-shape ADR ratified via the in-wave decision-review cell. | Internal — no observation point |
| 3 | Settings OpenAI key row + multi-provider `useByokMode` | sonnet-implementer | **Trophy (UI + state) / internal-only-ish.** Add `ByokOpenAiKeyRow` (separate `byok:openai-key-changed` event, `sk-...` placeholder); relabel Anthropic row. Decompose `byokMode` boolean → provider discriminant (`anthropic\|openai\|null`) in `useByokMode`; thread it where the boolean threaded. Managed-meter suppression logic unchanged (`!byokMode` still correct). | Settings → AI Writing Assistant shows a second "OpenAI API key" row; after saving a key, the "Your key" badge in the assistant panel updates to name the active provider. |
| 4 | Registry-driven merged model picker | sonnet-implementer | **Trophy / cross-boundary (shared file with W45).** Build the provider→models registry; render the picker from it; **lift the `!byokMode` picker gate** → show all models for every provider with a key (merged Claude + ChatGPT groups); selected model routes to the matching provider/key (thread `model` through `ByokStreamArgs` → `byok_openai_chat`). Empty state (no keys) = managed. | With both keys saved, the assistant panel's model picker displays a Claude group and a ChatGPT group (GPT-5.4 / mini / 5.5); selecting GPT-5.4-mini and sending streams a reply from OpenAI. |
| 5 | Persistent per-provider usage readout | sonnet-implementer | **Trophy / persistent storage (non-trivial running totals).** Accumulate per-turn tokens from each provider's `done` usage into a persisted per-provider total + estimated USD (known cloud rates; custom-endpoint = token-only is W45's concern); render a readout near the badge / in Settings; clear/reset affordance. Storage-location ADR (localStorage vs Tauri store vs SQLite — avoid a migration per project memory) ratified via the in-wave decision-review cell. | After sending GPT turns, the usage readout in Settings shows accumulated tokens and estimated cost per provider, incrementing after each reply. |

### Acceptance criteria

- [ ] `src-tauri/src/byok.rs` (or a new sibling module) exposes a provider abstraction generic over
      `{base_url, auth_header, wire_format}` with two live wire formats (Anthropic + OpenAI-compatible);
      `cargo test` passes including new OpenAI SSE-parse + usage-normalization unit tests.
- [ ] A unit test asserts the cached-token subtraction: given an OpenAI usage chunk with
      `prompt_tokens = P`, `prompt_tokens_details.cached_tokens = C`, the normalized non-cached input =
      `P − C` and cached-read = `C` (no double count).
- [ ] Rust commands `byok_openai_set_key` / `byok_openai_has_key` / `byok_openai_clear_key` /
      `byok_openai_chat` / `byok_openai_stop` are registered in `src-tauri/src/lib.rs`; setting then
      clearing an OpenAI key creates then removes a `byok-openai` entry under service
      `com.coles.writing` (verified via Credential Manager in CDP smoke).
- [ ] `byok_chat` accepts a `model` param and forwards it (no longer the hardcoded Haiku constant).
- [ ] `useByokMode` returns a provider discriminant (`'anthropic' | 'openai' | null`) and updates on
      both `byok:key-changed` and `byok:openai-key-changed`.
- [ ] The model picker renders from a provider→models registry; with both keys present it shows a
      Claude group and a ChatGPT group; the `!byokMode` blanket gate is gone.
- [ ] Selecting a GPT model and sending routes through `byok_openai_chat` (model threaded via
      `ByokStreamArgs`) and renders a streaming reply.
- [ ] Settings shows two key rows ("Anthropic API key" + "OpenAI API key") with distinct DOM events.
- [ ] A per-provider usage total persists across an app restart and increments after each BYOK turn;
      a clear/reset control zeroes it.
- [ ] An invalid OpenAI key produces a sanitized "Invalid API key — check Settings" (real OpenAI 401,
      key never leaked to logs/UI) — parity with the W40 Anthropic 401 path.
- [ ] `npm run lint`, `tsc`, `npm run test` (vitest) and `cargo test` are all green at wave end.

### Files the next agent should read first

1. `roadmap/wave-49-byok-multi-provider-research.md` — **current OpenAI API/contract specs** (Chat Completions
   streaming over reqwest, cached-token math, `reasoning_effort`/`temperature` 400, model IDs/pricing).
   The phase briefs are grounded in it; treat as input, verify model IDs at build.
2. The `## Locked decisions` section of this wave file — confirm decisions are filled before coding.
3. `src-tauri/src/byok.rs` — the Anthropic-hardcoded BYOK path being generalized (keyring constants
   `byok-anthropic`, the direct `api.anthropic.com` call, the Anthropic SSE parser, the hardcoded
   `MODEL` constant). This is the file Phase 1 extends and Phase 2 refactors.
4. `src-tauri/src/lib.rs` (command registration ~L165–169) — where new commands register.
5. `src/features/ai/byok.client.ts` — the thin TS `invoke()` wrappers to mirror for OpenAI.
6. `src/features/ai/useByokMode.ts` — the boolean to decompose into a provider discriminant.
7. `src/features/ai/AssistantPanel.parts.tsx` (~L273–278) — the `!byokMode` picker gate to lift, and
   the `ModelPop` popover to make registry-driven.
8. `src/features/ai/AssistantPanel.tsx` + `AssistantPanel.hooks.ts` + `AssistantPanel.byok.ts` — the
   `byokMode` prop threading, the `execSend` route branch (~hooks.ts L247), and `ByokStreamArgs`
   (needs a `model` field).
9. `src/features/settings/Settings.ai.tsx` — `ByokKeyRow` to mirror for OpenAI.
10. `roadmap/wave-40-byok-phase-1.md` + `decisions/0002` / `0003` — the locked BYOK pattern (direct
    routing, key stays in Rust) W49 extends, not replaces.
11. `.claude/vendor-gotchas/keyring.md` + `anthropic.md` — prior BYOK traps to honor.

### Note to the implementer

The spirit of this wave: **extend the W40 BYOK pattern to a second provider by generalizing, not
duplicating.** The privacy property is load-bearing — the key lives in the keychain, crosses the IPC
boundary exactly once into Rust, and never re-enters JS (ADR 0003). Do not weaken that for OpenAI.
First step: verify the `## Locked decisions` section has decisions filled in. Resist these
temptations: do NOT build a custom/local endpoint UI or relax TLS — that's W45, and W49's only
endpoint is the trusted `api.openai.com` constant (no URL validation needed). Do NOT touch the
managed-path Cloudflare Worker or its billing math — BYOK is Rust-direct and unmetered. Do NOT
"improve" the shipped Anthropic path beyond the behavior-preserving lift in Phase 2 (existing cargo
tests are the guard; if they change, you changed behavior). Keep the picker **registry-driven** so the
W45 agent appends a "Local" group without re-forking it — publish the registry shape early (Phase 2).

Before declaring a phase complete, restate the observation point from the Phases table Observation
column in your own words and describe what you actually observed there. If you could not observe it
directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not
substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but
not sufficient.

## Locked decisions

> Decisions are appended here via the decision-review cell (`sonnet-architect` → `sonnet-adversarial-reviewer`
> `Posture: attack-decision` → orchestrator adjudication) as the wave progresses, EXCEPT the
> scope/product decisions below which carry **user-lock authority** (ratified directly by Cole at plan
> time, 2026-06-14). The two technical ADRs flagged below are ratified in-wave at the phase that needs
> them.

### Decision 1: W49 ↔ W45 boundary (scope) — USER-LOCKED

**Context:** W45 (local models) runs in parallel; both touch `byok.rs` + the picker. Who builds what.
**Pick:** W49 builds the provider-routed engine + cloud OpenAI + registry-driven picker + per-provider
usage. W45 consumes the engine (passes local base URLs), and owns the custom-URL entry UI, the
loopback/https/cert validation guardrails, and local model discovery. W49 lands first.
**Rationale:** build the engine once in the wave that owns it; the other wave is a pure consumer →
minimal collision on the two shared surfaces (`byok.rs`, the picker).
**Consequences:** W49's OpenAI adapter must be base-URL-parameterized from the start (even though it
only passes the `api.openai.com` constant) so W45 needs no Rust refactor; the picker must be
registry-driven so W45 appends entries structurally untouched.
**Enforcement:** advisory-only (cross-wave coordination; the registry-shape publish in Phase 2 is the
coordination artifact). `durable: candidate`.

### Decision 2: OpenAI model lineup (product) — USER-LOCKED

**Context:** which OpenAI models the BYOK picker offers (BYOK = user pays OpenAI directly, so the
managed $10-allowance argument does not constrain).
**Pick:** GPT-5.4 + GPT-5.4-mini + GPT-5.5 (full current lineup).
**Rationale:** the user funds their own usage; no allowance reason to withhold the pricier model.
**Consequences:** three model IDs + display rates to verify at build (research sidecar §3–4; flag
VERIFY on any rate not confirmed by two sources).
**Enforcement:** advisory-only (the picker registry is the single source of the offered list).

### Decision 3: Cost-visibility depth (product) — USER-LOCKED

**Context:** BYOK has no managed meter; how much usage/cost UX to build (ties the queued
BYOK-usage-visibility follow-up).
**Pick:** persistent per-provider running total (accumulated tokens + estimated USD), with a
clear/reset affordance.
**Rationale:** Cole's pick; closes the follow-up's core ask with a durable readout, not just a
per-turn flash.
**Consequences:** needs a persistence decision (Decision 4) and per-turn usage capture on the BYOK
`done` event.
**Enforcement:** advisory-only (Phase 5 acceptance criteria).

### Decision 4: Picker UX with multiple keys (product) — USER-LOCKED

**Context:** what the model-selection surface looks like when both an Anthropic and an OpenAI key are
stored.
**Pick:** one merged picker showing all models for every provider with a key (Claude group + ChatGPT
group); the selected model determines which provider/key routes; the "Your key" badge reflects the
active model's provider; empty state (no keys) = managed.
**Rationale:** Cole's pick; one mental model, fewest clicks, infers provider from the choice.
**Consequences:** `byokMode` boolean must decompose into a provider discriminant; the picker becomes
registry-driven; the badge becomes provider-aware.
**Enforcement:** advisory-only (Phase 4 acceptance criteria).

### Decision 5: Rust provider-engine abstraction shape — RATIFIED (decision-review cell, 2026-06-14)

`durable: candidate` (W45 consumes this contract).

**Context:** generalize the two duplicated Rust BYOK drain loops (`byok_chat` Anthropic + `byok_openai_chat`) into one engine, behavior-preserving for the shipped Anthropic path, and publish the contract the parallel W45 (local models) agent consumes.

**Pick — enum dispatch + a new `byok_engine.rs` module.** `byok_engine.rs` holds: `enum WireFormat { Anthropic, OpenAiCompatible }`, `enum ParseLine`, `struct RequestSpec { url, headers: Vec<(&'static str, String)>, body: serde_json::Value }`, and `async fn run_stream(...)` (the shared drain). Per-provider SSE parser helpers STAY in `byok.rs` / `byok_openai.rs`; `WireFormat::parse_line` calls into them. `byok_chat` gains a `model: String` param (drops the hardcoded `MODEL` const). Existing cargo tests must stay green (behavior-preservation guard).

**Rationale (corrected per adversarial review):** enum dispatch is chosen for **compile-time exhaustiveness** (a new wire format becomes a compile error, not a silent `Ignore`) and **zero allocation on the per-SSE-line hot path** with **zero new crates** — NOT because of async-trait dyn-incompatibility (sync `fn` works fine behind `dyn`; that argument was a non-sequitur). The per-provider variation is entirely synchronous, so no async trait is warranted.

**Consequences:**
- **Accepted cost:** the central `WireFormat` enum is a coordination hotspot for future genuinely-different wire formats (Gemini-class) — each adds an enum variant + a `parse_line` arm + a `byok_engine` import. Bounded and acceptable at 2 formats; W45's local provider reuses `OpenAiCompatible` (adds NO variant). The engine importing from all provider modules (hub-knows-all) is accepted mild debt, not a Rust cycle (intra-crate references are unrestricted).
- **`ParseLine::SetUsage` carries cached tokens** (`{ input, cached, output }`), and `run_stream` accumulates all three — even though Phase 1/2 `NormalizedEvent::Done` does not yet emit `cached`. This keeps the seam forward-compatible so **Phase 5** surfaces cached cost without re-plumbing the parse boundary (Phase 5 adds an additive `cached_tokens` field to `NormalizedEvent::Done` + migrates the W40 frozen serialization test — a deliberate, reviewed contract evolution, NOT a silent break).
- **Key-lifetime invariant (hard requirement):** `run_stream` must consume/drop the `RequestSpec` (which owns the api-key string in `headers`) immediately after `send()` returns, before the drain loop — preserving the W40 posture where the key never lives across the stream. The `RequestSpec` MUST NOT be retained for logging/retry.
- **`ParseLine` control-flow contract (must be engine-owned):** the literal `data: [DONE]` is detected by the drain loop BEFORE `parse_line` is called (never routed through it, or it returns `Ignore` and the loop hangs until timeout); `ParseLine::StreamError` ⇒ engine emits `NormalizedEvent::Error` + `break`. Terminal `Done` fires on every exit path (cancel / read-error / `[DONE]` / stream-error), unchanged from W40.
- **SSRF backstop (defense-in-depth):** `run_stream` rejects any `url` whose scheme is not `http`/`https` and never relaxes TLS — a minimal tripwire that complements (does NOT replace) W45's loopback/https/cert validation. Decision 1 keeps full URL validation with W45; this is a last-line guard against a W45 validation gap, since the engine is the final code site before the user's prose + key hit the network.

**Published W45 contract** (the W45 agent builds against this — relayed to Cole for the parallel session):
- Rust: W45 authors `byok_local.rs` with `byok_local_chat(state, stream_id, base_url: String, model, messages, system, max_completion_tokens, temperature, api_key: Option<String>, on_event)` — builds a `RequestSpec` (Authorization header omitted when `api_key` is `None`, for keyless local servers) and calls `run_stream(..., WireFormat::OpenAiCompatible, ...)`. W45 validates `base_url` before calling; omits `reasoning_effort` (local servers reject it). No `byok_engine.rs` change needed unless a local-server wire quirk forces a `WireFormat::LocalCompat` variant.
- TS: Phase 4 creates `src/features/ai/providerRegistry.ts` with `ProviderId = 'anthropic' | 'openai' | 'local'`, `ProviderGroup[]` `PROVIDER_REGISTRY`, the `BYOK_CMD_*` shared command-name constants, `getModelEntry`, and `getBadgeLabel`. **Dispatch is the `BYOK_SEND` map** (`src/features/ai/AssistantPanel.byok.ts`) keyed `ProviderId → stream-handler-fn`. W45 registers a local provider by: appending a `'local'` group to `PROVIDER_REGISTRY` + adding a `local:` entry to `BYOK_SEND` (referencing a `streamByokLocalResponse` wrapper). (An earlier `PROVIDER_COMMAND` map was removed at wave-end — it was dead; `BYOK_SEND` is the single dispatch registry.)

**⚠️ Correction to the W45 contract (wave-end review, 2026-06-15) — RELAY THIS to the W45 agent.** The Rust + registry surface above is necessary but NOT sufficient. To make a `'local'` provider functionally reachable, W45 ALSO edits these 4 TS sites (W49 left them anthropic/openai-shaped; the registry-ready hooks exist but the BYOK *key-tracking* chain is provider-pair-shaped):
  1. `src/features/ai/byokUsage.ts` — widen `type SupportedProvider = "anthropic" | "openai"` to include `'local'` (else `recordUsage("local", …)` is a TS error).
  2. `src/features/ai/useByokKeys.ts` — track a `local` key + fold it into `byokActive` (else a local-only key never sets `byokActive`, so `execSend` falls through to the managed path and the local provider is unreachable).
  3. The `byokKeys: { anthropic: boolean; openai: boolean }` type chain (`PanelMsgArgs`, `AssistantPanel` props, `computeEffectiveByokModel`) — widen to carry `local` (else the `'local'` group is filtered out of the picker even with a key set).
  4. `src/features/ai/AssistantPanel.parts.tsx` model chip — W49 hardened the label lookup to `AI_MODELS[p.model]?.label ?? p.model` (was a crash for IDs not in `ManagedModel`). W45's local model IDs are not in `ManagedModel`; rely on this fallback OR add local IDs to the `ManagedModel`/`AI_MODELS` source. (W49 already shipped the defensive guard, so no crash — but the chip shows the raw ID until W45 supplies a display name.)

**Enforcement:** decision-review cell fired (`sonnet-architect` → `sonnet-adversarial-reviewer` `Posture: attack-decision` → orchestrator adjudication, FLAG → all 4 flags addressed above); behavior-preservation enforced by the existing cargo test suite; the key-drop + `[DONE]` + SSRF-tripwire requirements are advisory-to-the-implementer (carried in the Phase 2 brief; verified by the phase reviewer cell).

### Decision 6: usage-total persistence location — RATIFIED (decide-and-explain, 2026-06-15)

**Context:** where the Phase-5 per-provider BYOK usage totals (tokens + estimated USD) persist.
**Pick:** `localStorage` (renderer-side), keyed per provider.
**Rationale:** the cell was downgraded to decide-and-explain — the choice is low-stakes and
constrained to one clear answer. Usage counters are **non-secret, non-critical, informational**;
localStorage persists across app restarts in WebView2, needs **zero new deps and zero Rust wiring**,
and **avoids the SQLite-migration trap** (project memory: appending a migration silently breaks prior
migration tests). The only downside — cleared if the user wipes WebView data — is acceptable for
informational stats. A Tauri store-plugin JSON is the upgrade path if durability ever becomes critical.
**Consequences:** the readout reads/writes localStorage; the clear/reset control wipes the key. Not
synced, not backed up (informational only).
**Enforcement:** advisory-only (Phase 5 acceptance criteria). Downgraded from the decision-review cell
because the migration constraint leaves a single defensible option (no architect dispatch fired).

## Status

| Phase | Dispatched | Completed | Commit | Observation point hit |
|---|---|---|---|---|
| 1 | 2026-06-14 | 2026-06-14 | `83f216d` | ✅ Panel rendered "Invalid API key — check Settings" via live OpenAI 401 (CDP smoke through the React UI route). |
| 2 | 2026-06-14 | 2026-06-14 | `11fac3a` | ✅ Internal refactor (behavior-preserving). Smoke: both Anthropic + OpenAI invalid-key paths render sanitized 401 through the shared `run_stream` (CDP). Panel PASS (security FLAG addressed). |
| 3 | 2026-06-14 | 2026-06-14 | `9c043b9` | ⚠️ Code + tests green (vitest 1454 + 6 new: OpenAI row label, 3 badge-text branches, OpenAI routing). Review FLAG (test-adequacy) addressed. Live CDP smoke deferred — dev app not running + no smoke-config (see follow-up); behavior test-covered. Needs Cole eyeball: two key rows + badge flip. |
| 4 | 2026-06-15 | 2026-06-15 | `9c152ee` | ⚠️ Code + tests green (vitest 1491 + 4 guard/dispatch tests). Panel FLAG (routing/contract) addressed: registry-driven `BYOK_SEND` dispatch + key-absent guard + `ProviderId` casts. Live smoke deferred (dev app down). Needs Cole eyeball: merged picker shows keyed-provider groups + GPT model routes to OpenAI. |
| 5 | 2026-06-15 | 2026-06-15 | `6308049` | ⚠️ Code + tests green (cargo 37, vitest 1503 + 14 byokUsage). Done gains cached_tokens (frozen test migrated, Decision 5); per-provider usage→localStorage (Decision 6); Settings readout + Reset. Panel FLAG (comment + event test) addressed. Live smoke deferred (dev app down). Needs Cole eyeball: usage readout + est cost after a BYOK turn. |

## Follow-up candidates

- Wire an agent-driven UI-smoke harness for the run-phase workflow (project lacks `.claude/smoke-config.json`, so the `sonnet-smoke-runner` step CANNOT-LAUNCH on every UI phase — UI smokes currently depend on the implementer manually running `npm run tauri dev` + driving CDP, which silently no-ops when the dev app isn't running). Cross-wave reach (every future UI wave); needs the smoke-runner config schema + the Tauri/WebView2 CDP-attach setup (per memory `app-can-be-smoked-via-cdp-port`) investigated + validated against a running dev app — not a single sonnet-implementer one-shot. | present-harm: K3 — 2026-06-14 Phase-3 run-phase returned `smokeStatus: CANNOT-LAUNCH`, reason "smoke-config.json not found at `C:\Web App\writing-w49-byok\.claude\smoke-config.json`"; affects automated smoke on all UI phases.

## Result

### Mechanical review

**Inputs:** Plan `roadmap/wave-49-byok-multi-provider.md` · Diff `master..HEAD` (W49 commits) · Graph available · 2026-06-15.

- **Check 1 (forward-trace):** PASS — the wave-end cross-phase review traced the full BYOK flow (picker → `routeByokSend` → `BYOK_SEND` → `byok_openai_chat`/`byok_chat` with the selected model → SSE → `Done{cached}` → `recordUsage`) to production consumers; the threaded `model` + `cached_tokens` reach production at every hop. No silent drops.
- **Check 2 (plan universals):** PASS — both providers handled consistently (meter suppressed for EITHER key; picker shows groups for ALL keyed providers; all prior cargo/vitest tests stay green). No narrowed quantifier.
- **Check 3 (dead exports):** PASS *after fix* — flagged `PROVIDER_COMMAND` (providerRegistry.ts) as dead (zero production consumers; the Phase-4 routing fix uses the `BYOK_SEND` map). Removed it + its test + the unused `CommandName` type; updated the W45 contract to register in `BYOK_SEND`. Grep-clean; tsc/lint/vitest green.
- **Check 4 (schema-removal migration):** N/A — Tauri app, no electron-store JSON-Schema config; the wave ADDED `cached_tokens` (additive), removed no persisted schema property.
- **Check 5 (boundary-phase acceptance tests):** PASS-with-note — cross-boundary phases 1 (external OpenAI API) + 4 (W45-shared picker). Phase 1's boundary contract was orchestrator-authored (the `byok_openai.rs` frozen parser/usage tests — the cached-token subtraction + SSE parse), Written before the implementer dispatch and built-around (not modified) by the implementer. Deviation from the formal convention: the contract is embedded in the impl module (a frozen `#[cfg(test)]` block) rather than a separate `…-acceptance/` file with a predating commit. Substance met (orchestrator owns the contract, implementer couldn't change it, it passed).
- **Check 6 (mutation score):** N/A — no `stryker.config` in project root.

#### Verdict

**PASS** (Check 3 flagged the `PROVIDER_COMMAND` dead export; addressed inline by removal before this verdict). Checks 1/2/5 ran clean; 4/6 N/A.

<!-- Wave summary + telemetry filled below at wrap. -->
