# Model bake-off — Claude (Sonnet 4.6 / Haiku 4.5) vs Codex (GPT-5.4 / 5.4-mini)

**Context:** Wave 28 (`roadmap/wave-28-story-planning-salvage.md`) is run as a head-to-head model
comparison at every agent seat, on Cole's directive. For each task, the Claude agent and a tier-matched
Codex agent get the **same brief** in parallel; the orchestrator (Opus) adjudicates and takes the better
result — or grafts the best of each. This file is the running tally.

**Apples-to-apples pairing** (Codex mirrors the tier + effort of the Claude agent it races):

| Claude agent | Tier | Codex profile | Model · effort |
|---|---|---|---|
| `sonnet-implementer` | Sonnet | `implementer` (stock) | gpt-5.4 · medium |
| `sonnet-architect` | Sonnet | `architect-54` | gpt-5.4 · high |
| `sonnet-adversarial-reviewer` | Sonnet | `adversarial-54` | gpt-5.4 · high |
| `sonnet-diagnostician` | Sonnet | `diagnostician-54` | gpt-5.4 · high |
| `sonnet-explorer` | Sonnet | `explorer-54` | gpt-5.4 · medium |
| `/review` (mechanical) | — | `reviewer` (stock) | gpt-5.4 · medium |
| `haiku-explorer` | Haiku | `explorer-mini-54` | gpt-5.4-mini · low |
| `haiku-research-extractor` | Haiku | `research`-mini (on demand) | gpt-5.4-mini · low |

**Adjudication criteria:** correctness · spec-adherence · completeness · code quality · conciseness ·
acceptance-test pass (implementation only). Adjudication modes: `TAKE-CLAUDE` · `TAKE-CODEX` · `GRAFT`
(best-of-both, noted what came from where) · `TIE`.

**Caveats:** the explorer-mini seat is not perfectly apples-to-apples (full Sonnet 4.6 vs gpt-5.4-mini —
this is the cheap-recon tier by design). The Yjs/TipTap research dispatch (P1 grounding) ran on Claude
`haiku-research-extractor` SOLO before this directive — logged below as Claude-only, no Codex counterpart.

---

## Dispatch log

| # | Seat | Phase | Task | Claude verdict | Codex verdict | Winner | Mode | Notes |
|---|---|---|---|---|---|---|---|---|
| 0 | research | P1 (pre) | Yjs/TipTap format-preserving replace API | (haiku-research-extractor, solo) | — | n/a | — | Pre-directive; no Codex counterpart. (Note: research later corrected by explorer seat — `@tiptap/y-tiptap`, not `y-prosemirror`.) |
| 1 | Explorer (Sonnet) | P1 | Map Find&Replace seam for acceptance test | Strong: full map + found test seam (`vi.mock("../db/schema")` + vitest config in `vite.config.ts`) + concrete `makeDocWithMark` delta recipe + fix-location + schema-match caveat | Strong: full map, equally correct on core, caught `@tiptap/y-tiptap` correction, +read `sqliteSceneDocStore.save` sig; MISSED vitest config (said "none found") | **Claude (narrow)** | GRAFT | Both nailed the `@tiptap/y-tiptap` finding (corrects the research sidecar). Claude's test-seam findings were decisive for authoring the acceptance test; grafted Codex's `save` signature. |

_(rows appended as dispatches complete)_

---

## Running scorecard

| Seat | Claude wins | Codex wins | Graft | Tie | Dispatches |
|---|---|---|---|---|---|
| Implementation | 0 | 0 | 0 | 0 | 0 |
| Architect | 0 | 0 | 0 | 0 | 0 |
| Adversarial review | 0 | 0 | 0 | 0 | 0 |
| Diagnostician | 0 | 0 | 0 | 0 | 0 |
| Reviewer (mechanical) | 0 | 0 | 0 | 0 | 0 |
| Explorer (Sonnet tier) | 0 | 0 | 1 | 0 | 1 |
| Explorer (Haiku tier) | 0 | 0 | 0 | 0 | 0 |

---

## Per-seat overall verdicts (final — filled at wave end)

_To be written at wave wrap: which model wins each seat, with the evidence, and a recommendation on where
to use Codex vs Claude going forward._
