# Adult content: BYOK + permissive model only; managed tier stays SFW

decided-in: research 2026-06-15 (4 parallel passes; full memo at `research/2026-06-15-adult-content-policy-research.md`); recorded to decisions/ during M-73 memory salvage, 2026-07-10
status: PARTIALLY RATIFIED — the defense-in-depth pair is Cole-ratified (2026-06-15, W46 follow-up candidates); the overall architecture stance is the researched recommendation, not yet explicitly ratified

**Context:** frontier API (Anthropic/OpenAI) cannot serve explicit fiction under a managed subscription — confirmed 4 ways. Anthropic moderates at the INPUT stage, so even a benign task (proofread/critique) on a chapter *containing* an explicit scene gets refused, and repeated attempts risk **Cole's** managed account (≈1.45M accounts deactivated in 6 months, ~3.3% appeal success). `safety_identifier` tags reduce but do not eliminate dev-account liability. No app in the market resells frontier API for adult fiction; the three market paths are own/finetuned models (NovelAI/Sudowrite), BYOK+permissive (NovelCrafter), or local/self-host (KoboldAI).

**Pick:**
- Managed tier (Cole's keys) = **non-explicit writing only**; never positioned for adult content.
- Adult/explicit path = **BYOK + a permissive model** via the existing OpenAI-compatible BYOK/local endpoint (shipped W45/W49) — liability rides on the user's key. Needs to become a documented, intentional path. The house-style harness applies to ALL paths including local/custom (`buildMessages` is upstream of the provider split) — the BYOK adult path is first-class, not degraded.
- Do NOT build a managed uncensored lane (proxying OpenRouter-uncensored) unless Cole chooses to operate moderation (age-gate + CSAM blocking + ToS).
- Quality gap of permissive models (Dolphin 3.0 Mistral 24B, Hermes 3/4, NovelAI Erato) is small — margin-of-error on prose.

**Consequences:**
- **Embedded-content UX must not fail silently**: a romance writer pasting a chapter with one explicit scene into the managed tier hits silent refusals — detect/warn + point to BYOK/local. Paired defense-in-depth (Cole-ratified): (1) per-text-range "hide from AI" TipTap `aiExclude` Mark (Yjs-persisted, stripped at `assembleContext()` before `buildGrounding()`); (2) reactive managed-refusal warning. (1) is user-driven so it complements, never replaces, (2).
- Eval runs on Cole's generation keys keep explicit content OUT of the matrix (would measure refusals and accrue account strikes); content-permissiveness screening happens on the permissive models' own access.
- Claude's practical line for creative tasks: romance/sensual/fade-to-black OK; explicit categorically refused (same across tiers). OpenAI: transformation-exception on paper, inconsistent in practice; adult mode paused indefinitely (Mar 2026).
- CSAM is a separate universal hard line (NCMEC reporting, every tier) — never conflate with the adult-content question.

**Enforcement:** advisory-only (architecture stance; the refusal-warning + aiExclude slices carry the mechanical halves once built).
