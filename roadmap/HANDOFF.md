---
project: writing
updated: 2026-06-16
---

## Current state
- Branch: master  ·  Latest commit: 35d561b  ·  Tag: v0.12.0 (prepped, not yet shipped)
- **W52 SHIPPED TO MASTER.** "Hide from AI" mark (redacts prose from all 4 AI paths) + entity persist fix + managed content-policy refusal UX. Gates green (tsc 0, eslint 0, vitest green save 6 W46-unrelated failures).

## Next 3 steps
1. Cole bumps version in package.json + src-tauri/{Cargo.toml,Cargo.lock,tauri.conf.json}, tags v0.12.0, runs `.\publish.ps1` interactively.
2. Agent-driven CDP smoke W52 client phases (P1 mark visual + Yjs persistence; P3 single-bubble + consent-gate; P4 toggle-persists). WebView2 CDP port 9222 + tauri-devtools MCP. Green vitest ≠ working editor.
3. W46 eval rig-v2 panel-judge scoring (separate agent, won't finish until morning); 6 failing scorer/eval-runner tests are in-flight work, not W52 regressions.

## Active work
- No wave in flight. W52 complete; batch wrap done.
- Open follow-ups: 5 active, none W52-related — entity-context strip staleness · W39 trial-abuse smoke (acceptance gate) · agent-driven UI smoke harness (smoke-config.json) · Turnstile hardening.
- **Dev note:** dev + installed share %APPDATA%\com.coles.writing\writing.db (real manuscripts + license). Agent UI smoke via CDP port. Do NOT run publish.ps1 (Cole only). Do NOT send live AI during smoke.

## Reference index
- **W52 commits:** 4fdf4c3, 2bc4f13, c4af305, 5ae6017, 35d561b (all on master)
- **Durable decisions:** [decisions/](decisions/) — ADR 0014 (trial-identity), ADR 0015 (spend-cap)
- **Vendor-gotchas:** [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) — Ollama, Tauri traps
- **Project conventions:** [CLAUDE.md](../CLAUDE.md) · **Open follow-ups:** [inbox](follow-ups/)
