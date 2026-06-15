---
status: SHIPPED
created: 2026-06-13
shipped: 2026-06-13
merged_to_master: true
note: SHIPPED 2026-06-13 — pushed to master (HEAD 22808a3) + marketing AI proxy DEPLOYED via Cloudflare Pages + tagged v0.8.0. Remaining: Cole runs publish.ps1 (interactive) to cut the desktop installer, and the post-deploy behavioral CDP smoke (both noted in ## Result → Cole's to-do).
---
# Wave 37 — AI Harness Optimization (prompts + server-side verb config + caching)

Result: All 5 phases complete — anti-sycophancy verb prompts (P1), scene-truncation honesty (P2), privacy-footgun removal from `assembleBrainstormContext` (P3), server-side `VERB_CONFIG` + model-aware billing `[F]` (P4), prompt caching `[6]` (P5) — merged with Wave 36 at `e261f8d`, pushed as v0.8.0 (HEAD `22808a3`), deploying the marketing AI proxy via Cloudflare Pages. Gates: root 1398/1398, marketing 199/199, tsc clean both trees, lint clean; 2 per-phase panel reviews + wave-end adversarial review (attack-diff) returned FLAG-no-BLOCK: backward-compat for v0.6.0 clients confirmed, billing math clean, caching request-shape valid. All verbs remain on `claude-haiku-4-5-20251001`; the Haiku→Sonnet model upgrade is a deliberate deferred cost decision — `VERB_CONFIG` makes the flip a one-line, correctly-billed change.

Research sidecar retained: [wave-37-ai-harness-optimization-research.md](wave-37-ai-harness-optimization-research.md)
