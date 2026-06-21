---
id: 0010
title: BYOK routing — direct to Anthropic from Rust
status: accepted
decided-in: wave-40
promoted-during: wave-40
date: 2026-06-13
durable: true
---

# Decision 0010: BYOK routing — direct to Anthropic from Rust

**Context:** Where a BYOK user's request goes — direct to `api.anthropic.com` vs through the existing writersnook proxy. Touches the privacy narrative.

**Pick:** Direct to `api.anthropic.com` from the **Rust backend** (reqwest streaming → Tauri `Channel<NormalizedEvent>` → JS). Key + prose never touch writersnook servers; key never enters the WebView after paste.

**Rationale:** Cole's explicit decision — the strongest privacy claim and the whole point of BYOK. Rust-owns-the-call also wins on streaming (reqwest has first-class streaming; `tauri-plugin-http` does not) and CORS (none at the Rust layer). The cost — client-side raw Anthropic SSE parsing + a Rust-side verb→model policy — is accepted.

**Consequences:** Client now owns Anthropic wire-format parsing (breaks the managed path's "Decision 4" normalized-SSE separation, in the BYOK branch only); no server-side rate/abuse buffer for BYOK (the user's own quota governs).

**Enforcement:** advisory-only (architecture); the meter-isolation acceptance criteria + the per-phase adversarial reviewer guard the privacy/isolation invariant.
