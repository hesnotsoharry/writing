---
vendor: "Zhipu / Z.ai (GLM models)"
sdkVersion: "GLM-5.x via Z.ai Coding-Plan key"
firstWritten: 2026-06-23
lastVerified: 2026-06-23
relatedPaths:
  - src/features/ai/providerModels.ts
  - src/features/ai/adapter/node.transport.ts
  - eval/tasks.ts
notes: "Wiring GLM into the W46 eval harness as an OpenAI-compatible provider via a Z.ai coding-plan key. Endpoint, token-cap, and thinking-mode traps."
---

# Zhipu / Z.ai (GLM) gotchas

## 2026-06-23 — Coding-plan key needs the CODING endpoint, not the general one
Source: W46 eval harness, verified live 2026-06-23

**Gotcha:** a Z.ai **Coding-Plan** key (stored at `C:\Users\coles\.zai-key.txt`) bills on
`https://api.z.ai/api/coding/paas/v4` — NOT the general `https://api.z.ai/api/paas/v4`, which
returns `429 "Insufficient balance or no resource package"` for a coding-plan key even with an
active subscription. `open.bigmodel.cn` (the China-region host) also 429s for this key type.

**Workaround:** point the `zhipu` provider at `https://api.z.ai/api/coding/paas/v4` explicitly;
don't assume the general/`bigmodel.cn` hosts work for a coding-plan key.

**Why:** Z.ai's coding-plan tier is billed and rate-limited separately from the general API tier,
and only the coding-specific host recognizes the coding-plan key's resource package.

## 2026-06-23 — Coding endpoint honors `max_tokens`, silently IGNORES `max_completion_tokens`
Source: W46 eval harness, verified live 2026-06-23

**Gotcha:** the OpenAI SDK sends `max_completion_tokens` by default for chat completions. The
Z.ai coding endpoint silently ignores this field and generates uncapped. Verified:
`max_completion_tokens=64` ran to 954 tokens; `max_tokens=64` capped correctly at 64.

**Workaround:** send `max_tokens` explicitly for this provider (branch on provider in the OpenAI
client params, e.g. `oaiProviderParams()` in `node.transport.ts`) rather than relying on the SDK
default.

**Why:** the coding endpoint's request schema predates or diverges from OpenAI's
`max_completion_tokens` rename; it only recognizes the legacy field name.

## 2026-06-23 — GLM-5.x defaults thinking ON, which can empty the visible `content` field
Source: W46 eval harness, verified live 2026-06-23

**Gotcha:** GLM-5.x models default to extended thinking enabled — hidden `reasoning_content` is
generated and charged against the token budget. On a tight budget this can consume the ENTIRE
allotment, leaving the visible `content` field blank (observed: a 2048-token critique came back
empty because reasoning ate the whole budget).

**Workaround:** send `thinking:{type:"disabled"}` in the request body so the full token budget
goes to visible content. This also matches how Claude/GPT are called in non-thinking mode
elsewhere in the eval harness, keeping the comparison fair across providers.

**Why:** GLM's thinking mode is opt-out, not opt-in, unlike Anthropic's extended thinking
(explicitly enabled per-request). Any code assuming "thinking off by default" for an
OpenAI-compatible provider needs this explicit override for GLM specifically.

**Wiring reference:** provider registered as `zhipu` in `src/features/ai/providerModels.ts` +
`src/features/ai/adapter/node.transport.ts`; key read from `ZHIPU_API_KEY` in `eval/.env.eval`.
Run GLM-only without regenerating other models: `EVAL_MODELS=glm-5.2` (env override in
`eval/tasks.ts`).
