---
status: ACTIVE
decided-in: wave-42
promoted-during: wave-42-ai-isms-harness
---

## Context

Launch-doc Decision 2 (2026-06-13) chose "worker appends the house-style block." That design's fatal flaw: the worker is only on the subscription-proxy path; the future BYOK-direct path (W40) calls Anthropic directly and never hits the worker, so worker-appended content never reaches BYOK users. The brief revises the decision to client-injection so the harness ships in the binary and reaches both paths.

## Pick

Inject the block **client-side** at the single prompt-assembly choke point (`buildMessages` → `applyHouseStyle`), with content + an on/off toggle delivered by a **remote-config endpoint** (`GET /api/ai/house-style`, a CF Pages Function on writersnook.app, source-embedded JSON, `no-store`). Two separable layers: `SHARED_PRINCIPLES` (W37 anti-sycophancy) stays always-on and baked-in; the new `HOUSE_STYLE_BLOCK` (anti-AI-isms + register) is the remotely-tunable W42 layer, also baked-in as the fail-open default. A dormant `perModelAddenda` map is built for W44.

## Rationale

Client-injection is the only design that reaches BOTH proxy and BYOK (both flow through `buildMessages` — declared invariant, see Consequences). Remote config on the marketing site decouples content tuning/rollback from the slow signed-installer cadence: a git push → ~60–120 s CF build flips it, no app release. Baked-in default means the harness is present offline / first-run / before the fetch resolves (fail-open-to-baked-in, the industry-standard remote-config bootstrap pattern — Firebase Remote Config / LaunchDarkly). Endpoint (not static JSON) is forced by CORS: CF Pages adds no CORS headers to static assets, so a Tauri-WebView fetch of a static file hard-fails; KV-backed is over-built at zero users.

## Consequences

- A versioned house-style string lives on the marketing site with ~1–2 min rollback. **Rollback scope is the W42 layer ONLY** — `SHARED_PRINCIPLES` (W37) is compiled into the binary and changing it still needs a signed release. (Adversarial-review fix: this scope is stated explicitly so an operator under pressure doesn't assume the sycophancy layer is remotely toggleable.)
- **Declared invariant:** any future direct-Anthropic path (W40 BYOK) MUST route its system-prompt assembly through `buildMessages`, or the house-style injection is bypassed. W40's design must honor this. (Adversarial-review FLAG_UNCERTAIN: the BYOK soundness is contingent on this invariant, which doesn't exist in code yet.)
- **Composition must use the function-form replacement** `system.replace(SHARED_PRINCIPLES, () => SHARED_PRINCIPLES + "\n" + activeBlock)` — NOT string concatenation — because `String.prototype.replace` expands `$&` / `` $` `` / `$'` in a string replacement even for non-regex search, and the remote `block` (a style guide that may contain `$`/quoted punctuation) would silently corrupt the prompt. Plus an idempotency guard (the composer is contracted to run once on a freshly-built system string). (Adversarial-review fix.)
- v1 content is PROVISIONAL; `enabled:false` is the kill switch if it harms output. W46 tunes it.

## Enforcement

advisory-only (W42 implements; rollback path = marketing redeploy / `enabled:false` flip). The function-form-replace + idempotency + the four-verb `SHARED_PRINCIPLES`-anchor requirement are covered by Phase-1 unit tests.
