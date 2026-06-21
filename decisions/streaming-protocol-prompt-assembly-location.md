---
status: ACTIVE
decided-in: wave-34
promoted-during: wave-34-ai-assistant-foundation
---

## Context

Thin provider seam + the "never trains on your manuscript" privacy promise.

## Pick

Proxy-normalized event schema (`{type:'token'|'done'|'error'}`) — the app never speaks Anthropic's wire format. Prompt assembly fully client-side (`src/features/ai/ai.context.ts` + per-verb templates in `src/features/ai/prompts/`); the proxy receives an assembled messages array, meters, relays, and never logs bodies. Honest framing (review amendment): manuscript text DOES transit the proxy — the consent walkthrough copy states the actual data flow (local → our relay → Anthropic; not stored, not logged, not trained on) rather than implying the proxy is blind.

## Rationale

(Embedded in Pick section above.)

## Consequences

Provider swap touches proxy + prompt templates, not the React client. GDPR/DPA formalization is a follow-up (below).

## Enforcement

Acceptance criteria: no `@anthropic-ai/sdk` in `src/`, no body logging in `api/ai/` (grep checks).
