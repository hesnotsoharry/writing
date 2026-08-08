# Hover treatments are a deliberate two-tier system

decided-in: design session 2026-06-10 (Cole-ratified); recorded to decisions/ during M-73 memory salvage, 2026-07-10
status: ACTIVE

**Context:** the app's hover styles look inconsistent on first read; the inconsistency is load-bearing.

**Pick:** two tiers by semantics —
- **Neutral tier** (`background: var(--parchment-deep)`): furniture — buttons, binder chapter/scene rows, list rows, icon buttons.
- **Accent tier** (`--accent-ring` border / `--accent-wash`): content-you-act-on surfaces — bible entity cards, goal cards/rows, filter chips, add-entity CTAs, in-prose entity links.
- **Corkboard cards are an intentional outlier**: lift + slight rotate, no color (physical index-card metaphor).

**Rationale:** the accent only signals "content" because most hovers don't use it. Spreading accent hovers app-wide dilutes the signal and fights the Quiet Study calm.

**Consequences:** new interactive surfaces pick a tier by semantics (furniture vs content), never by copying the nearest neighbor. Do NOT "fix" the inconsistency. Hover inventory grouped in `app.css` (2026-06-10 session).

**Enforcement:** advisory-only (design doctrine; reviewers check against this ADR).
