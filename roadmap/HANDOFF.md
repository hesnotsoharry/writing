---
project: writing
updated: 2026-06-07
---

## Current state
- **Working branch: `orchestrator-test-fixes`** (NOT master). HEAD `d75bb19`. master is clean pre-work +
  the `design-reference/` canon; we fix `orchestrator-test-fixes` feature-by-feature, then merge to master
  at wave end.
- **Wave 28 (story-planning-salvage) IN PROGRESS.** Salvaging Sonnet's butchered wave-27 8-feature
  story-planning build, one feature per phase, run as a **Claude (Sonnet 4.6) vs Codex (GPT-5.4) model
  bake-off at every agent seat** (Cole's experiment). Plan + locked decisions + per-phase status:
  `roadmap/wave-28-story-planning-salvage.md`. Per-feature damage map: `roadmap/discovery/2026-06-07-sonnet-salvage-audit.md`.
- **P1 Find & Replace — SHIPPED + smoke-PASS** (`7741080`): format-preserving replace + killed the
  replace-all self-undo. **P2 Snapshots — SHIPPED + smoke-PASS** (`d75bb19`): CSS ported (overlay was
  unstyled), stale-scene rail fixed, title-bar history entry, restoring spinner. Both CDP-smoked live.
- Full suite NOT yet run wave-wide (per-phase touched tests + lint + tsc are green each phase). Wave-end
  full suite + `/review` + wrap happen after P8.

## Next (resume here)
1. **P3 — Entity types** (next phase). Mostly data fixes: wrong DEF_FIELDS labels/icons/accents/tiers in
   `src/storybible/fullEntry/defs.ts` + `BibleTypes.tsx`, faction missing "Conflicts" section, `.avatar.generic-entity`
   CSS gap, new-type avatar fallback. See audit "Feature 4" + `design-reference/ENTITY-TYPES-SPEC.md`.
2. Then P4 Relationships+FullEntry, P5 Outliner+Labels, P6 Goals, P7 Focus, P8 Auto-link → wrap.
3. **4 product decisions need Cole's lock at their phases** (drafted in the wave file `## Locked decisions`):
   Q-PEOPLEGROUP + Q-PRESETS (P4), Q-LABELCAP (P5), Q-FROZEN (P7/P8). The other 4 are decide-and-explain.

## How we work (bake-off cadence — Cole's directive)
- **Full bake-off every seat.** Light-touch adjudication on cheap seats (recon/explorer — quick note);
  full adjudication on implementation + adversarial. Codex tier-matched to the Claude agent it races.
- **Per-phase loop:** recon bake-off (`sonnet-explorer` + codex `explorer-54`) → orchestrator authors a
  failing acceptance test → impl bake-off (`sonnet-implementer` + codex `implementer`, each in its worktree)
  → adversarial bake-off (`sonnet-adversarial-reviewer` + codex `adversarial-54`, both on BOTH impls) →
  adjudicate → `git apply` the winning foundation to the main tree → single `sonnet-implementer` fix-forward
  → CDP smoke → commit. Log every seat in `MODEL-BAKEOFF.md`.
- **Scorecard so far (n=2):** Implementation = **Claude** wins architecture+discipline both phases (Codex
  wins speed ~4×, but introduced test-integrity/scope regressions). Adversarial = **Codex** narrow both —
  edge is TOOL-driven (it executes/reproduces; the read-only Claude reviewer made a P1 false-positive +
  missed a P2 data-corruption bug). Explorer ≈ tie. **Meta-finding: both models ship plausible code that
  passes a reasonable acceptance test; the executing reviewer is what catches the real bugs — strengthen
  acceptance tests + lean on the adversarial layer.**
- **⚠️ Context-asymmetry confound (verified 2026-06-07):** Claude subagents auto-receive the full
  `~/.claude/rules/` corpus + project/global CLAUDE.md + project memory; Codex agents get only `~/.codex/AGENTS.md`
  + the brief. So P1–P2 partly measure Claude-with-full-rules vs Codex-with-AGENTS.md-only (explains Codex's
  config-hacks — it lacked the injected "don't weaken shared gates" discipline). **DECISION FOR P3+ (ask Cole):**
  level the field by adding a condensed project-conventions + gate-discipline preamble to every Codex brief
  (no `any`, key-remount not setState-in-effect, base64 TEXT, editor frozen, NEVER touch shared config to pass
  a gate, surgical fixes) — OR keep "native configs" and just annotate. Recommend: level it. See MODEL-BAKEOFF.md confound note.
- **Codex profiles** (`~/.codex/*.config.toml`): stock `implementer`/`reviewer` = gpt-5.4 medium; `architect-54`/
  `adversarial-54`/`diagnostician-54` = 5.4 high; `explorer-54` = 5.4 medium; `*-mini-54` = gpt-5.4-mini (Haiku tier).
  Invoke: `codex exec --profile <name> --skip-git-repo-check --output-last-message <file> "$(cat brief)" </dev/null`.

## Infra / housekeeping
- **Bake-off worktrees:** `C:\Web App\writing-bakeoff-claude` + `writing-bakeoff-codex` (node_modules junctioned
  to main). Per phase: `git -C <wt> reset --hard orchestrator-test-fixes && git -C <wt> clean -fdq`.
- **CDP smoke:** `npm run tauri dev` → port 9222 → `tauri-devtools` MCP (screenshot/snapshot/click/fill/
  evaluate_script). A dev server from this session may still be running; relaunch if not. Memory `app-can-be-smoked-via-cdp-port`.
- Test project "The Salt Road" was mutated during smokes (scene→chapter ×9; an auto-snapshot exists) —
  throwaway test data, reversible via in-app snapshots/undo.
- Temp brief/result files in `%TEMP%` (`bakeoff-*.txt`, `codex-*.txt`) are disposable. `~/.codex/dispatch-stream.log` is Cole's.
- `src-tauri/Cargo.lock`/`Cargo.toml` churn from the running dev server — exclude from commits.

## Reference index
- Wave file: [wave-28-story-planning-salvage.md](wave-28-story-planning-salvage.md) · Audit: [discovery/2026-06-07-sonnet-salvage-audit.md](discovery/2026-06-07-sonnet-salvage-audit.md)
- Bake-off tally: [../MODEL-BAKEOFF.md](../MODEL-BAKEOFF.md) · P1 research: [wave-28-story-planning-salvage-research.md](wave-28-story-planning-salvage-research.md)
- Canon: `design-reference/` (FEATURE-WAVE-PLAN.md + per-feature SPECs) · Build: `npm run tauri dev` · Test: `npm run test` · Lint: `npm run lint:fix`
- Open follow-up candidates (in wave file, filed by wrap team at wave-end): F&R embed-offset (latent), F&R open-scene-no-refresh, snapshots cross-scene-restore corruption (data-loss, pre-existing), snapshots binder-menu rail-refresh.
