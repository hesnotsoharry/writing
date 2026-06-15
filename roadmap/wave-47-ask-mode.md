---
project: writing
wave: 47
slug: ask-mode
title: Free-form "Ask" mode — context-aware general writing assistant
status: SHIPPED
created: 2026-06-14
shipped: 2026-06-14
merged_to_master: true
---
# Wave 47 — free-form "Ask" mode

Result: Shipped a 5th AI mode — free-form Ask — alongside the 4 task verbs: free-form in topic, harnessed in style (own persona + `<style>`/`<prose>` anti-AI-ism blocks, not the critique-shaped `SHARED_PRINCIPLES`), grounded in context (`buildGrounding` — scene / Story Bible / About / selection), routed through the managed proxy as `verb:"ask"` (metered identically; Haiku, temp 0.7, maxTokens 2048). Distinctness (Decision 1): `ask` is a VerbKey kept OUT of `AI_VERB_ORDER`, surfaced via an "Ask anything" empty-state hero, a separated top-entry in the verb-switch popover, and the floating selection pill (rewired from a latent brainstorm mis-seed); fresh-panel default changed brainstorm→ask. Gates: app lint clean · app tsc clean · 1410/1410 vitest (146 files) · marketing tsc + test clean. Adversarial review BLOCK (default-verb fix location — `useAiPanelSeed` init, not `initialVerb`) + FLAG (hero didn't focus composer — `onFocusInput` threaded) both resolved before commit. CDP smoke deferred per Cole's brief; Ask reuses the identical proxy/streaming/metering path as the 4 already-smoked verbs.
