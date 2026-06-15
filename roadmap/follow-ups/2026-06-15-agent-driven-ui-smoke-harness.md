---
status: OPEN
created: 2026-06-15
qualifying-criterion: schema
cannot-be-cleared-by: sonnet-implementer-dispatch
present-harm: K3 — 2026-06-14 Phase-3 run-phase returned `smokeStatus: CANNOT-LAUNCH`, reason "smoke-config.json not found at `C:\Web App\writing-w49-byok\.claude\smoke-config.json`"; affects automated smoke on all UI phases.
---

# Follow-up: Agent-driven UI-smoke harness for run-phase workflow

## Summary

The project lacks a `.claude/smoke-config.json` configuration file, blocking the `sonnet-smoke-runner` step in the run-phase workflow from running automated CDP-driven smoke tests on UI phases. During Wave 49 Phase-3 (Settings OpenAI key row), the run-phase returned `CANNOT-LAUNCH` status for UI smoke, requiring manual `npm run tauri dev` + browser inspection instead of deterministic agent-driven smoke.

## Impact

- **Cross-wave reach:** affects automated smoke on every future UI phase
- **Consequence:** UI changes rely on manual developer smoke-testing instead of reproducible agent-driven runs
- **Status quo:** Phase 3–5 of W49 deferred live CDP smoke due to dev app downtime; code coverage and tests green, but runtime observation incomplete

## Gap detail

The smoke harness requires:

1. **`.claude/smoke-config.json` schema + content** — configuration file naming the Tauri WebView2 CDP debug port (port 9222 for dev builds) and attach strategy
2. **Tauri/WebView2 CDP setup investigation** — validate the attach mechanism against a running dev app per project memory `app-can-be-smoked-via-cdp-port` (WebView2 CDP port reachable, `tauri-devtools` MCP bridge confirmed)
3. **run-phase workflow integration** — wire the `sonnet-smoke-runner` step to read the config and attach to the live dev-app process
4. **End-to-end validation** — run a UI phase through the full run-phase → smoke → gate loop with the harness active and confirm the smoke step produces usable screenshots/assertions

## Why this is a follow-up and not Phase 0 inline

Fixing this requires:

1. **Multi-file coordination** — config file creation, run-phase workflow adjustment (if needed), and Tauri shell configuration
2. **Schema design** — the smoke-config shape must be compatible with the `sonnet-smoke-runner` catalog agent's expectations (research needed; see `~/.claude/rules-deferred/manual-smoke-gate.md` for baseline)
3. **Integration testing** — attach strategy must be validated against a running Tauri dev app with WebView2 active; this is not a unit test scenario
4. **Cross-tool expertise** — requires understanding of Tauri runtime, WebView2 CDP protocol, and the run-phase workflow's `sonnet-smoke-runner` call site

This is **schema design + cross-boundary wiring** (Tauri shell ↔ WebView2 ↔ MCP tools) — not a single sonnet-implementer dispatch.

## Suggested approach

1. **Research the smoke-config schema:** read `~/.claude/rules-deferred/manual-smoke-gate.md` to understand the expected shape; consult existing smoke-config examples in other projects (Agent IDE likely has one for Electron).
2. **Investigate Tauri/WebView2 CDP:** verify the debug port (9222 for dev, 9223+ for production) is accessible on `localhost:9222`, test with a simple `curl` or CDP client against the running dev app.
3. **Author `.claude/smoke-config.json`:** define the project's smoke target (platform: `tauri`, app-launch strategy if needed, CDP attach endpoint, expected page URL patterns).
4. **Validate the harness:** run a small UI-bearing test phase (Phase 0 or a quick smoke-focused phase) through run-phase with the harness enabled and confirm the `sonnet-smoke-runner` step produces screenshots and passes assertions.
5. **Document the attach setup:** add a section to `.claude/vendor-gotchas/tauri.md` or the project CLAUDE.md explaining the smoke-harness mechanics for future developers.

---

*Qualified from Wave 49 follow-up candidates. Schema design + cross-boundary (Tauri/WebView2/MCP integration). Cannot be cleared by single implementer dispatch (requires design, validation, integration testing).*
