---
status: OPEN
created: 2026-06-14
updated: 2026-06-14
qualifying-criterion: new-UI-primitive
cannot-be-cleared-by: sonnet-implementer-dispatch
present-harm: K2 — src/features/settings/Settings.ai.tsx:30 is the only aiLicenseKey write and it clears to ""; verified this session (no setter to a non-empty value exists in src/ or src-tauri/), so the shipped managed AI-subscription path cannot be activated by a user
resolved-during: wave-40
---

# Managed AI-subscription license key — no entry UI

## Summary

The managed AI-subscription path has an `aiLicenseKey` field in the settings schema, but there is no UI anywhere for a user to input or set it. A paying subscriber cannot activate the managed AI assistance because the key-entry flow is missing. This is distinct from BYOK (which has its own direct-to-Anthropic path) and requires a product decision on where/how the key should be entered.

## Gap detail

- `aiLicenseKey` in `src/features/settings/Settings.ai.tsx` is only written to `""` (the clear path at line 30).
- `ActivationGate` handles only the Lemon Squeezy product license (`app_meta.license`), not the AI subscription license.
- Consent flow enables the assistant but never collects an AI license key.
- Result: a user who purchases the managed AI subscription has no way to activate it.

## Open questions (for Cole)

1. Is `aiLicenseKey` distinct from the product license, or are they the same field under different names?
2. If distinct, where should the user enter the AI key—only in Settings, or also in the activation/subscription flow?
3. What UX copy, field label, and validation rules should accompany the key-entry field?

## Acceptance criteria (once product decision is made)

- [ ] A new "Your AI subscription key" row is added to `Settings.ai.tsx` with a masked paste field (similar to the BYOK key row).
- [ ] On paste and save, the key is stored in `settings.store.ts` and persists to localStorage as `writing.aiLicenseKey`.
- [ ] When a key is present, the row shows a "Remove key" button; when absent, shows the paste field.
- [ ] `ActivationGate` reads the key from settings and includes it in the managed AI flow (or the product decision clarifies whether the key is actually used there at all).
- [ ] Tests cover the field render, store/clear cycle, and integration with the managed assistant path.
