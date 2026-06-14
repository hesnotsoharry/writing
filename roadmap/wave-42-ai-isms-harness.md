---
status: DRAFT
created: 2026-06-14
note: DRAFT — W42 anti-AI-isms harness MECHANISM + provisional v1 content. Built on branch wave-42-ai-isms-harness.
---

# Wave 42 — Anti-AI-isms harness (mechanism + provisional v1 content)

## Plan

### Status

DRAFT · target v0.8.x (desktop) + marketing proxy redeploy · drafted 2026-06-14.

### Goal

After this wave the WritersNook AI assistant has a **versioned, client-injected house-style / anti-AI-isms block** appended to every verb's system prompt. Because the block is injected client-side in `buildMessages` (the single prompt-assembly choke point both the subscription-proxy path and the future BYOK-direct path flow through), it **ships in the app binary** and reaches BYOK-direct calls too — unlike the prior worker-append design, which never reaches a client that calls Anthropic directly. The block's content and an on/off toggle are **remote-config-driven** (a `GET /api/ai/house-style` Cloudflare Pages Function on writersnook.app), so it can be tuned or rolled back via a marketing-site redeploy (~60–120 s) **without a signed desktop-app release**. A **per-model-addendum** knob is built but dormant (activated by W44's model picker).

This wave delivers the **mechanism + provisional v1 content only**. Final tuned content, per-model addenda values, and the post-hoc-pass decision come from **W46's eval results** — W42 builds the knobs, W46 sets the values. All v1 content is marked PROVISIONAL.

### Verification strategy (wave-level)

Mechanism is **pure-function + fetch-guard logic** → covered by vitest (`applyHouseStyle` composition + the fetch guard-chain + the marketing endpoint handler). Unlike W37's editor/AI-behavior phases, no ProseMirror/runtime oracle is needed — this is string assembly and a JSON endpoint, both jsdom/Workers-testable. Per the session brief, **smoke is skipped** for this wave. A green `vitest` + `tsc` + `eslint` is the gate; a one-line behavioral confirmation (system prompt contains the block on a live call) is left as an optional post-merge check for Cole.

### Scope

**In scope:**

- **[1] Composition core (client, `src/features/ai/prompts/shared.ts`):** add `HouseStyleConfig` interface, the baked-in `HOUSE_STYLE_BLOCK` constant (v1 provisional content), `HOUSE_STYLE_DEFAULT` config, `MAX_HOUSE_STYLE_BLOCK = 4_000`, and the pure `applyHouseStyle(system, config, model?)` composer. `SHARED_PRINCIPLES` (W37 anti-sycophancy) is left unchanged and always-on; the new layer is appended after it.
- **[2] Remote-config store + fetch (client, new `src/features/ai/ai.house-style.ts`):** module-singleton `_active`, `getActiveHouseStyleConfig()`, and `fetchAndStoreHouseStyleConfig()` with the fail-open-to-baked-in guard chain.
- **[3] Wiring (client):** `buildMessages` (`prompts/index.ts`) wraps the verb-builder result with `applyHouseStyle(raw.system, getActiveHouseStyleConfig())` — external signature unchanged. Eager startup `useEffect` in `src/App.tsx` fires the fetch once.
- **[4] Remote endpoint (marketing, new `marketing/functions/api/ai/house-style.ts`):** `GET` + `OPTIONS` Pages Function, source-embedding `{version:1, enabled:true, block:<v1 text>, perModelAddenda:{}}`, `Cache-Control: no-store`, CORS via existing `_lib/cors.ts`.
- **[5] Tests:** `applyHouseStyle` (null config, enabled/disabled, empty-block, `$`-pattern safety, per-model addendum reachable, idempotency); the fetch guard chain (reject / !ok / bad-JSON / type-guard / over-length → baked-in); the endpoint handler (shape + CORS).
- **[6] Docs:** revise Decision 2 in `roadmap/discovery/2026-06-13-reddit-launch-readiness.md` (worker-append → client-injected) and update its W42 entry to MECHANISM-SHIPPED / content-PROVISIONAL.

**Out of scope:**

- **Final tuned content + per-model addenda values + post-hoc-pass decision** → W46 (the eval sets the values; the knobs exist after this wave).
- **localStorage last-known-good cache + version-monotonicity guard** → deferred (baked-in default IS the v1 offline story; LKG is a future upgrade when sessions lengthen).
- **Activating per-model addenda** → W44 (model picker makes the model id known client-side).
- **Touching `SHARED_PRINCIPLES` content or the W37 sycophancy layer** → unchanged; this wave only adds the anti-AI-isms layer.

### Phases

- **Phase 1 — Mechanism + content + tests:** scope items [1][2][3][4][5]. One cohesive cross-file implementation (the client and the endpoint share the `HouseStyleConfig` JSON contract, so they land together to keep the shape consistent). Gate: `tsc` + `eslint` + touched vitest green.
- **Phase 2 (wrap) — Docs + decision promotion:** scope item [6] + wave result + HANDOFF.

## Locked decisions

## Decision 1: Anti-AI-isms harness — client-injected, remote-config-toggleable block (REVISES launch-doc Decision 2)

**Context:** Launch-doc Decision 2 (2026-06-13) chose "worker appends the house-style block." That design's fatal flaw: the worker is only on the subscription-proxy path; the future BYOK-direct path (W40) calls Anthropic directly and never hits the worker, so worker-appended content never reaches BYOK users. The brief revises the decision to client-injection so the harness ships in the binary and reaches both paths.

**Pick:** Inject the block **client-side** at the single prompt-assembly choke point (`buildMessages` → `applyHouseStyle`), with content + an on/off toggle delivered by a **remote-config endpoint** (`GET /api/ai/house-style`, a CF Pages Function on writersnook.app, source-embedded JSON, `no-store`). Two separable layers: `SHARED_PRINCIPLES` (W37 anti-sycophancy) stays always-on and baked-in; the new `HOUSE_STYLE_BLOCK` (anti-AI-isms + register) is the remotely-tunable W42 layer, also baked-in as the fail-open default. A dormant `perModelAddenda` map is built for W44.

**Rationale:** Client-injection is the only design that reaches BOTH proxy and BYOK (both flow through `buildMessages` — declared invariant, see Consequences). Remote config on the marketing site decouples content tuning/rollback from the slow signed-installer cadence: a git push → ~60–120 s CF build flips it, no app release. Baked-in default means the harness is present offline / first-run / before the fetch resolves (fail-open-to-baked-in, the industry-standard remote-config bootstrap pattern — Firebase Remote Config / LaunchDarkly). Endpoint (not static JSON) is forced by CORS: CF Pages adds no CORS headers to static assets, so a Tauri-WebView fetch of a static file hard-fails; KV-backed is over-built at zero users.

**Consequences:**
- A versioned house-style string lives on the marketing site with ~1–2 min rollback. **Rollback scope is the W42 layer ONLY** — `SHARED_PRINCIPLES` (W37) is compiled into the binary and changing it still needs a signed release. (Adversarial-review fix: this scope is stated explicitly so an operator under pressure doesn't assume the sycophancy layer is remotely toggleable.)
- **Declared invariant:** any future direct-Anthropic path (W40 BYOK) MUST route its system-prompt assembly through `buildMessages`, or the house-style injection is bypassed. W40's design must honor this. (Adversarial-review FLAG_UNCERTAIN: the BYOK soundness is contingent on this invariant, which doesn't exist in code yet.)
- **Composition must use the function-form replacement** `system.replace(SHARED_PRINCIPLES, () => SHARED_PRINCIPLES + "\n" + activeBlock)` — NOT string concatenation — because `String.prototype.replace` expands `$&` / `` $` `` / `$'` in a string replacement even for non-regex search, and the remote `block` (a style guide that may contain `$`/quoted punctuation) would silently corrupt the prompt. Plus an idempotency guard (the composer is contracted to run once on a freshly-built system string). (Adversarial-review fix.)
- v1 content is PROVISIONAL; `enabled:false` is the kill switch if it harms output. W46 tunes it.

**Enforcement:** advisory-only (W42 implements; rollback path = marketing redeploy / `enabled:false` flip). The function-form-replace + idempotency + the four-verb `SHARED_PRINCIPLES`-anchor requirement are covered by Phase-1 unit tests.

`durable: candidate`

## Follow-up candidates

- localStorage last-known-good cache + version-monotonicity guard for the house-style config (deferred from v1). present-harm: none yet — config re-fetches each session; LKG only matters once sessions lengthen or offline AI usage appears. Not in-wave: needs a staleness/rollback-poisoning design (the version field is reserved now for this). (K3: forward dependency, no current harm — likely a NON-qualifying candidate, recorded for the auditor to judge.)
- Extract the duplicated `API_BASE` derivation (`import.meta.env.VITE_AI_PROXY_URL ?? "https://writersnook.app"`) — now in both `ai.client.ts:47` and the new `ai.house-style.ts` — to one shared config constant. present-harm: file:line `src/features/ai/ai.client.ts:47` + new `ai.house-style.ts` duplicate the literal; drift risk if the prod URL ever changes. Small; auditor may close as trivial-now.

## Result

**SHIPPED (mechanism + provisional v1 content) — 2026-06-14, branch `wave-42-ai-isms-harness`.** Not yet merged/pushed at time of writing (autonomous session; Cole to review). Commits: Phase 1 `b2810aa` (mechanism + content + tests), Phase 2 (docs/wrap).

### What shipped
- **Client composition core** (`src/features/ai/prompts/shared.ts`): `HOUSE_STYLE_BLOCK` (v1 provisional anti-AI-isms ban list + show-don't-tell register), `HouseStyleConfig`, `HOUSE_STYLE_DEFAULT`, `MAX_HOUSE_STYLE_BLOCK = 4_000`, and the pure `applyHouseStyle(system, config, model?)` composer. `SHARED_PRINCIPLES` (W37) untouched + always-on; the W42 layer is appended after it.
- **Remote-config store + fetch** (`src/features/ai/ai.house-style.ts`, new): module-singleton + `fetchAndStoreHouseStyleConfig()` with a 5-guard fail-open-to-baked-in chain (reject / !ok-before-parse / bad-JSON / type-guard / length-cap).
- **Wiring**: `buildMessages` (`prompts/index.ts`) wraps the verb-builder system with `applyHouseStyle(…, getActiveHouseStyleConfig())` (external signature unchanged; `routeVerb` extracted to keep both fns ≤40 lines). `App.tsx` fires the config fetch once on mount.
- **Remote endpoint** (`marketing/functions/api/ai/house-style.ts`, new): `GET`+`OPTIONS`, source-embedded `{version:1,enabled:true,block,perModelAddenda:{}}`, `Cache-Control: no-store`, CORS via `_lib/cors.ts`.
- **Docs**: launch-doc Decision 2 revised in place (worker-append → client-injected, with the BYOK-flaw why); W42 entry → MECHANISM-SHIPPED / content-PROVISIONAL / eval-moved-to-W46.

### Verification
- Client: `tsc` 0, `eslint` 0, full `vitest` **1413/1413** (15 new W42 tests).
- Marketing: `tsc` 0, full `vitest` **208/208** (4 new endpoint tests incl. a client↔endpoint drift tripwire).
- Smoke: skipped per session brief (mechanism is pure string/fetch logic — jsdom/Workers-testable, no runtime oracle needed).
- Reviews: decision-review cell (attack-decision) → FLAG, both fixes (function-form replace, rollback-scope doc) baked into the locked decision. attack-diff review → FLAG, both fixes applied (deleted 2 dead comment-stub files; added the drift tripwire).

### Caveats / what's NOT done (deliberate)
- v1 content is PROVISIONAL — W46's eval sets the tuned values, per-model addenda, and the post-hoc-pass decision.
- `perModelAddenda` is dormant (client doesn't know the model; server pins Haiku) — W44's model picker activates it.
- No localStorage LKG cache / version-monotonicity guard (baked-in default IS the v1 offline story) — deferred.
- The remote endpoint is committed but **not deployed** until the branch merges + master is pushed (push = CF Pages deploy). Until then, clients fetch-fail → baked-in default (correct fail-open; the harness still applies).

### Cole's to-do
- Review + merge `wave-42-ai-isms-harness` → master (push deploys the marketing endpoint live).
- (Optional) Behavioral confirm on a live call: the assembled system prompt contains `<house-style>` after `SHARED_PRINCIPLES`.
