---
status: ACTIVE
decided-in: wave-35
promoted-during: wave-35-assistant-redesign-port
---

## Context

Design canon (HANDOFF Phase 8) says `ai_enabled` defaults OFF in production. But it currently defaults `true`, and flipping it risks hiding the AI tab from existing users (Cole + partner) on next launch depending on whether their setting is explicitly persisted. Surfaced by the wave-end review as a spec deviation recorded only in a phase status row, not a locked decision.

## Pick

Keep `TWEAK_DEFAULTS.aiEnabled = true` this wave; the production default-OFF flip is a Cole/launch decision (pairs naturally with the wave-36 launch). The dormant-card experience is gated by `aiConsentGiven` (default false) regardless, so a fresh install still shows "the assistant is asleep" until opted in.

## Rationale

Avoids disrupting the existing user installs (Cole + partner) on next launch while deferring the production default-OFF flip to the launch decision point where it pairs naturally with wave-36.

## Consequences

New installs see the AI tab (in dormant state) without user action — a deliberate, documented deviation from design-canon default-OFF until Cole flips it.

## Enforcement

advisory-only — `TWEAK_DEFAULTS.aiEnabled` in settings.store.ts; flip is a one-line change at launch. Cross-wave: wave-36 launch must decide the flip.
