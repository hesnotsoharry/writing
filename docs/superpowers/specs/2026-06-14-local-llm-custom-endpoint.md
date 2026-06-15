# Spec — Wave 45: Local-LLM / custom OpenAI-compatible endpoint

> Status: SIGNED OFF (Cole, 2026-06-14) — scope = multiple saved endpoints. Stage-2 behavioral spec.
> Audience: the W45 implementing agent. Pairs with the wave plan at `roadmap/wave-45-local-llm.md`
> (authored after sign-off).

## 1. One-line intent

Let a user point the assistant at a **local or self-hosted OpenAI-compatible model server** (Ollama,
llama.cpp, LM Studio, or any compatible endpoint) — free, no managed credits, no subscription —
through a guarded custom-endpoint entry flow, with honest per-endpoint privacy framing.

## 2. Why (product framing — Cole, 2026-06-14)

Two jobs, both endorsed:
- **Privacy / offline differentiator.** "Your words can stay on your machine." A marketing angle and
  a real audience (writers who won't send prose to any cloud).
- **Free power-user / bring-your-own-model.** For writers already running Ollama/LM Studio. Like BYOK,
  but free and local. Subscription cannibalization is accepted as goodwill.

AI remains never-required; this is opt-in and dormant until configured.

## 3. The W49 ↔ W45 boundary (load-bearing — do not cross)

W45 runs in parallel with W49 (BYOK multi-provider). **W49 builds the engine once; W45 consumes it.**
W49 lands first and freezes its contract in W49 Phase 1.

| Surface | Owner | W45's relationship |
|---|---|---|
| `src-tauri/src/byok.rs` provider-routed engine ({base_url, auth_header, wire_format}) | **W49** | W45 *calls* its public adapter fn with a local base URL. Never edits it. |
| OpenAI-compatible SSE parser | **W49** | W45 reuses it as-is (local servers speak OpenAI wire format). |
| `byokMode: boolean` → provider discriminant refactor | **W49** | W45 does not touch the discriminant plumbing. |
| Registry-driven model picker | **W49** | W45 *appends* a "Local" provider group to the registry. Additive only. |
| Custom/local **endpoint-entry UI** | **W45** | Owned. |
| **URL-validation guardrails** (loopback-http / https-required / cert-on) | **W45** | Owned — W45 is where untrusted user-typed URLs enter. W49's endpoint is a trusted constant and needs none of this. |
| **Local model discovery** (Ollama `/api/tags`, llama.cpp/OpenAI `/v1/models`) | **W45** | Owned. |
| Smart per-endpoint **consent copy** | **W45** | Owned. |

**Hard rule:** if a change would edit `byok.rs`'s engine, the discriminant refactor, the parser, or
the picker's structural rewrite, it belongs to W49 — stop and coordinate, do not implement it in W45.

## 4. User-facing behavior (the spec proper)

### 4.1 Entry point & saved-endpoints management
- The disabled **"Custom endpoint — Coming soon"** row in Settings → AI (`Settings.ai.tsx:100`)
  becomes a real, enabled control opening a **saved-endpoints manager**.
- The manager shows a **list of saved custom/local endpoints** (named), with **add / edit / delete**
  and a **default/active selection**. Like saved connections.
- Adding/editing opens the **endpoint-entry form** (§4.2) (modal or expanded section — plan decides).
- Endpoint configs (URL, name, selected model, has-key flag) persist locally (settings store);
  the API key itself lives in the OS keychain, one entry per endpoint, NOT in the settings store.

### 4.2 Endpoint-entry form fields
1. **Name** (required) — user-friendly label (defaults to host:port; editable). Identifies the endpoint
   in the list and the picker group.
2. **Endpoint URL** (required) — e.g. `http://localhost:11434` (Ollama) or `https://my-box:8080`.
3. **API key** (optional) — blank for plain local Ollama; required for authenticated/remote servers.
   Stored in the OS keychain via the W40/W49 keyring pattern (one entry per endpoint; never held in
   React state after entry).
4. **Model** (required to compose) — populated by discovery (§4.4); manual entry is the fallback.

### 4.3 URL validation (guardrails — fire on save, before any request)
- **Loopback carve-out:** `http://` is allowed ONLY for loopback hosts — `localhost`, `127.0.0.0/8`,
  `::1`. Traffic never leaves the machine, so plaintext is acceptable.
- **HTTPS required for remote:** any non-loopback host MUST be `https://`. Reject `http://remote` with
  a clear message ("Remote endpoints must use https:// — plaintext would expose your text on the network").
- **Cert validation stays ON.** Never offer a "skip cert check" toggle. Self-signed remote certs fail
  with a clear message; the fix is a real cert, not relaxed validation. (Loopback uses the http
  carve-out, so it never needs cert relaxation.)
- **Malformed URL** → reject with a specific message (not a generic failure).
- Validation logic lives in Rust (where requests originate and where W49's engine is), exposed as a
  validate-then-save command or inline in the save path.

### 4.4 Model discovery
- On a valid endpoint (and key, if provided), the app **queries the endpoint for its model list**:
  - Try Ollama-native `GET /api/tags` first (Ollama's canonical list endpoint), then
  - Fall back to OpenAI-compatible `GET /v1/models`.
  - (Exact endpoints + response shapes to be verified against current Ollama/llama.cpp docs at
    plan/impl time per the research-before-implementing rule — do not code from memory.)
- Discovered models populate the **Model** picker. The user selects one; it becomes the active model
  for ALL verbs (one model across ask/brainstorm/critique/betaread/proofread — local servers don't do
  per-verb model policy).
- **Manual fallback:** if discovery returns nothing or fails (server up but no list endpoint), the user
  can type a model name. Discovery is a convenience, not a hard requirement.
- **Per-verb temperature/maxTokens** are resolved client-side (a local mirror of the server's
  `VERB_CONFIG`), since the managed proxy that normally owns that policy is bypassed.

### 4.5 Picker integration (additive to W49's registry)
- Once an endpoint is configured, its discovered models appear as a **"Local"** (or endpoint-labeled)
  group in W49's unified provider+model picker — same surface as managed Claude/GPT and BYOK-cloud.
- Selecting a local model routes the request through W49's OpenAI-compatible adapter with the local
  base URL. No managed credits, no balance fetch, no subscription gate.

### 4.6 Consent / privacy (smart per-endpoint, honest in both cases)
- The AI consent/enable flow still fires (consistent activation mental model), but the copy is
  **parameterized by endpoint**:
  - **Loopback endpoint** → strong copy: *"Your text stays on your machine. Nothing leaves this device."*
  - **Remote endpoint** → honest copy: *"Your text is sent to the endpoint you configured. We never see
    it — but it does leave your machine, to a server you control."*
- Principle (ratified with Cole): we control the honesty of our framing; the user controls where their
  data goes. We do not over-promise "never leaves your machine" for a remote endpoint, and we do not
  pretend a remote endpoint is private-by-us.
- The current hard-coded cloud-framed `CONSENT_STEPS` (`AiOverlays.tsx:12-38`) must be parameterized or
  branched for the local/custom case — reusing the cloud copy verbatim would be misleading.

### 4.7 Gating bypass (free path)
- A local/custom endpoint requires **no subscription license** and **no credits**:
  - The balance fetch is bypassed (same treatment BYOK gets at `AssistantPanel.tsx:273`), `canCompose`
    is forced true for the local path.
  - The subscription license gate that unlocks managed AI does not gate the local path.
- Usage display for local/custom endpoints is **free / no-cost** (no dollar estimate — we can't know an
  arbitrary endpoint's pricing; at most a token-count signal if W49's usage total surfaces one).

### 4.8 Error handling (must be real, not stubbed)
- **Endpoint unreachable** ("Ollama not running" / connection refused) → clear, actionable inline
  message ("Couldn't reach <label>. Is your local model server running?"), not a silent failure or a
  raw error.
- **Endpoint reachable but model missing / wrong** → surface the server's error.
- **Untrusted response stream:** the response is treated as hostile input — malformed SSE chunks,
  oversized payloads, non-OpenAI shapes must not crash the parser. (W49 owns the parser; W45's job is
  to confirm this hardening exists / file a coordination note if it doesn't, NOT to re-implement it.)
- **Discovery failure** falls back to manual model entry (§4.4), not a dead end.

## 5. Out of scope (explicitly NOT this wave)
- Embedded llama.cpp / bundled inference engine (multi-GB binary, model-download UX) — a future wave.
- Any edit to W49-owned surfaces (engine, parser, discriminant refactor, picker rewrite).
- Per-token dollar cost estimation for arbitrary endpoints.
- Mobile (Phase 2).
- (IN scope this wave per Cole 2026-06-14: multiple saved endpoints with add/edit/delete + default
  selection.) Still OUT: cross-device sync of the saved-endpoints list (Phase 2 sync territory).

## 6. Dependencies & sequencing
- **Hard dependency:** W49 lands first and publishes its **provider-registry contract + adapter fn
  signature** (W49 Phase 1). W45 integration phases gate on that contract.
- **Buildable in parallel now** (W49-independent): URL-validation logic, model-discovery HTTP, the
  Settings endpoint-entry form shell, per-verb client-side config.
- **Gated on W49 contract:** wiring the local path through W49's adapter; appending to W49's registry;
  picker integration.

## 7. Acceptance criteria (observable)
1. With Ollama running at `http://localhost:11434`, a user can add the endpoint, see discovered models,
   pick one, and get a streamed assistant response — with NO subscription and NO credit decrement.
2. Adding `http://some-remote-host` (non-loopback, plaintext) is **rejected** with the https-required
   message.
3. Adding `https://valid-remote` with a self-signed cert **fails closed** (cert validation on), with a
   clear message — no "skip cert" escape hatch exists.
4. The consent copy shown for a `localhost` endpoint says text stays on the machine; for a remote
   endpoint it honestly says text is sent to the configured server.
5. With the local endpoint server stopped, composing yields a clear "couldn't reach / is it running?"
   message, not a crash or silent hang.
6. Local models appear in the same unified picker as managed/BYOK models (W49 registry), labeled as the
   local/custom group.
7. No W49-owned file (`byok.rs` engine, parser, discriminant plumbing, picker structural code) is
   edited by W45's diff — only consumed/extended additively.
8. A user can save **two or more** named endpoints, switch the default between them, edit one, and
   delete one — each endpoint's key is independently stored/cleared in the keychain.

## 8. Open items to resolve at plan time
- Verify Ollama `/api/tags` + OpenAI-compat `/v1/models` shapes against current docs (ctx7/vendor docs).
- Form factor: modal vs expanded Settings section.
- Exact W49 contract shape (registry entry type + adapter fn signature) — fill in once W49 publishes.
- Whether per-verb client-side temperature/maxTokens needs user-tunable overrides (default: no, mirror
  server defaults).
