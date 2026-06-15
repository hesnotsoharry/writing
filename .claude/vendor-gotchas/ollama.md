---
vendor: "Ollama"
sdkVersion: "0.x (OpenAI-compatible API)"
firstWritten: 2026-06-15
lastVerified: 2026-06-15
relatedPaths:
  - src-tauri/src/byok_local.rs
  - src/features/settings/Settings.ai.tsx
notes: "Local LLM model server with dual discovery endpoints (Ollama-native + OpenAI-compat)."
---

# Ollama gotchas

## 2026-06-15 — Model discovery requires native `/api/tags` endpoint before OpenAI-compat fallback
Source: wave-45
**Gotcha:** Ollama exposes installed models via TWO distinct endpoints: a **native Ollama endpoint** (`GET /api/tags`) and an **OpenAI-compatible endpoint** (`GET /v1/models`). Neither is guaranteed to work on all Ollama versions or configurations. A naive discovery implementation that tries only the OpenAI-compatible endpoint may fail to discover native Ollama models or receive an empty list. The native endpoint is preferred because it returns Ollama's full model registry; the OpenAI-compatible endpoint is a fallback for compatibility but may be incomplete on some setups.
**Workaround:** Discovery requests should follow this sequence: (1) try `GET http://localhost:11434/api/tags` (native Ollama); (2) on failure or empty response, fall back to `GET http://localhost:11434/v1/models` (OpenAI-compat); (3) return the model list from whichever succeeds first. Parse the response format for each endpoint — Ollama's `/api/tags` returns `{ "models": [ { "name": "...", ... } ] }`, while `/v1/models` returns `{ "data": [ { "id": "...", ... } ] }`. Both formats are valid; translate to a normalized model-name list for the picker. If both fail, surface a clear error ("Couldn't reach Ollama — is it running?").
**Why:** Ollama's native endpoint is the authoritative source for the full registry. The OpenAI-compatible endpoint exists for client compatibility but is not always fully populated, making the native endpoint the primary discovery path.
