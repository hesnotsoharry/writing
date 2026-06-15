---
project: writing
wave: 48
title: Cache-prefix re-placement + 1-hour TTL (Anthropic prompt caching)
status: SHIPPED
created: 2026-06-13
shipped: 2026-06-15
merged_to_master: true
depends_on: [W39 (credits.ts in-flight — merge first)]
relates_to: [W44 (provider-aware caching), follow-up 2026-06-13-precise-cache-write-reserve]
---
# W48 — Cache-prefix re-placement + 1-hour TTL

Result: P1 (commit `5642d8a`) moved `sceneExcerpt` + `selectionText` out of the cached `system` block into the `messages` user turn via a new `buildVolatileUserBlock(ctx)`, keeping only stable grounding (role, principles, About, Story Bible entities) in the cached prefix — so the cache survives scene edits. P3 (commit `e4d53d8`) extended the TTL to 1h via `cache_control: { type: "ephemeral", ttl: "1h" }` plus the required `anthropic-beta: extended-cache-ttl-2025-04-11` header; `estimateCredits(systemLength)` now reserves at the 1h cache-write rate, closing follow-up `2026-06-13-precise-cache-write-reserve`. Mechanical review PASS (Checks 1–3 clean, 4–6 N/A); wave-end adversarial review FLAG→addressed (ask-verb placement test + beta-header invariant test added; tests after fixes: aiVerbPrompts.test.ts 36/36, marketing W48 suite 28/28). Live behavioral oracle (P2 cache-survives-edits + P4 economics) deferred to post-deploy.
