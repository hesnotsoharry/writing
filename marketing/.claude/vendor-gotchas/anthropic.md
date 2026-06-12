---
vendor: "anthropic"
sdkVersion: "TBD"
firstWritten: 2026-06-12
lastVerified: 2026-06-12
relatedPaths:
  - marketing/functions/api/ai/chat.ts
  - src/features/ai/prompts/
notes: "API behavior, streaming, system field handling"
---

# Anthropic gotchas

## 2026-06-12 — system field must be included in request; omission loses context

Source: wave-34-ai-assistant-foundation, commit 264c564

**Gotcha:** when calling the Anthropic API through a proxy, if you construct the messages request without passing the `system` field, the model loses context provided in that field. The proxy received an assembled messages array from the client but dropped the system field before relaying to Anthropic. The impact was subtle at first (replies were plausible but lacked grounding in the system context). Detected at live smoke when the model could not reference specific worldbuilding concepts that should have been in the system prompt.

**Workaround:** always include the `system` field in the request to Anthropic. If building a proxy, pass the system field through untouched from the client or inject it at the proxy. When calculating token costs and reserve credits, count the characters in the system field just like message bodies — do not skip system in the reserve math.

**Why:** the `system` field is a first-class parameter in the Anthropic API (not bundled into messages). It shapes the model's behavior and context. A proxy implementation that iterates over the messages array but ignores system will silently drop it. The API does not error if system is absent — it just runs without that context.
