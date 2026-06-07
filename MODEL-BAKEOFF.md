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
| 2 | Implementation | P1 | Fix Find&Replace: format-preserving replace + kill self-undo | Sound architecture: text-space surgical delete/insert in XmlText leaves, atomic `doc.transact()`, no paragraph flattening, clean constraints (no setState-in-effect, no lint weakening), +191/−118 across 5 files. Bugs: `replaceInDoc` not recursive → bullet-lists/blockquotes found-by-search but silently skipped; ASCII `\b` whole-word (fails on "café"); toast 5s timer resets on every re-render. **44 min.** | Fast (~10 min); Unicode-property whole-word; clean toast-gated undo wiring; +424/−99 across 9 files. Bugs: synthetic projection coordinate-space mismatches plaintext offsets → latent wrong-target on multi-paragraph / after-styled-text; flattens each touched paragraph to one `Y.XmlText` (drops non-text inline structure); **setState-in-useEffect violation**; unjustified `max-depth:off` lint weakening. | **Claude (foundation)** | GRAFT | Both pass the (too-weak) acceptance test; **neither landable**. Claude's bugs are additive fixes; Codex's is an architectural coordinate-model flaw + data-flattening. Plan: Claude base + graft Codex's Unicode whole-word + undo-toast wiring; orchestrator adds recursion + strengthens the test. Codex wins **speed (4.4×)**. |
| 3 | Adversarial review | P1 | Attack both impls (4 reviews: each reviewer × each impl) | On Claude-impl: **FLAG** — found the core recursion bug via static analysis, uniquely named the real trigger (lists/blockquotes), caught a Unicode case-folding length bug + did the deepest data-loss/transaction analysis. On Codex-impl: **BLOCK but FALSE-POSITIVE headline** — hand-traced the projection math and claimed acceptance T1 fails; T1 empirically passes 3/3. Read-only (no execution). | On Claude-impl: **BLOCK** — *reproduced* bugs by executing (sibling-node non-replace; "café" whole-word). On Codex-impl: **BLOCK**, accurate, no overclaim. Full sandbox execution. | **Codex (narrow, tool-aided)** | — | Bug-FINDING ≈ tie (high convergence on the real bugs). Decisive: the executing Codex reviewer avoided the false-positive the read-only Claude reviewer fell into. The edge is substantially the TOOL (sandbox exec), not pure model reasoning — Claude's static review was otherwise equal/better on precision (real-world trigger, case-folding, data-loss). |
| 4 | Explorer (Sonnet) | P2 | Map Snapshots seam | Strong: full CSS-gap list, `snapshots.css` section map, stale-scene bug + 2nd staleness axis (diff baseline), `sceneInspector` test-prop omissions | Strong: exact line refs per class, caught `vh-diff-text` not in `snapshots.css` (must be newly defined), pinned restore-spinner anchor | Codex (narrow) | TAKE-CODEX (light) | Light-touch adjudication per directive. Effective tie; Codex sharper on line-level CSS precision + the missing-source-class catch; Claude better narrative + section map. Both fully usable for the briefs. |
| 5 | Implementation | P2 | Snapshots: CSS port + stale-scene rail + title-bar + spinner | Lean +142/−25, surgical, benign config (`passWithNoTests`), intact test isolation. **Race-safe hook (no stale-flash)** — returns `[]` in-flight. Bugs: restore spinner is dead code (onCancel collapses confirming branch before busy renders); rail stale after restore; `.note` defined globally (restyles P1 Find&Replace); diff-baseline forced `""` on cross-scene. ~22 min. | Fast; got diff-baseline (loads non-active scene) + restore-spinner MORE correct; wrote a real HistoryRail test. Bugs: **stale-flash** (no `[]` reset on switch); **`vite.config isolate:false` + 8GB heap = test-integrity regression, verified UNNECESSARY by both reviewers**; non-surgical rewrite (`VersionHistory.shared.tsx` split + deleted doc comment); overlay stale-text; non-reentrant restore. ~3× churn (11 files). | **Claude (foundation)** | TAKE-CLAUDE + fix-forward | Both BLOCK-worthy; neither landable. Claude's base is cleaner (race-safe core + surgical + benign config); Codex's wins on baseline/spinner correctness but loses decisively on the global test-isolation regression + scope. Fix-forward Claude's spinner/.note/rail-refresh; pre-existing cross-scene-restore → follow-up. |
| 6 | Adversarial review | P2 | Attack both impls (4 reviews) | On Claude-impl: **FLAG** — caught the dead spinner + rail-stale-after-restore; MISSED the cross-scene restore data-corruption + the `.note`/Find&Replace side-effect. On Codex-impl: BLOCK — deep `isolate:false` analysis (traced it to an unsevered SQLite import) + stale-flash + scope creep. Read-only. | On Claude-impl: **BLOCK** — found the **cross-scene restore data-corruption** (restore writes scene B into active scene A) the Claude reviewer missed + `.note` side-effect + dead spinner. On Codex-impl: BLOCK — *re-ran tests with isolation forced on* to prove the config weakening was collateral. Executes. | **Codex (narrow, tool-aided)** | — | Both strong + convergent on most findings. Codex edges again: found the most-severe bug (data-corruption) the Claude reviewer missed, and empirically proved the config regression unnecessary. Same tool-asymmetry conclusion as P1 (execution > read-only for verdict reliability). |

_(rows appended as dispatches complete)_

---

## Running scorecard

| Seat | Claude wins | Codex wins | Graft | Tie | Dispatches |
|---|---|---|---|---|---|
| Implementation | 1 | 0 | 1 | 0 | 2 |  (P1 graft / P2 take-Claude; Claude wins architecture+discipline both times, Codex wins speed both times) |
| Architect | 0 | 0 | 0 | 0 | 0 |
| Adversarial review | 0 | 2 | 0 | 0 | 2 |  (Codex narrow both times, edge is tool-driven: P1 avoided a false-positive, P2 found a data-corruption bug the read-only Claude reviewer missed) |
| Diagnostician | 0 | 0 | 0 | 0 | 0 |
| Reviewer (mechanical) | 0 | 0 | 0 | 0 | 0 |
| Explorer (Sonnet tier) | 0 | 1 | 1 | 0 | 2 |
| Explorer (Haiku tier) | 0 | 0 | 0 | 0 | 0 |

---

## Per-seat overall verdicts (final — filled at wave end)

_To be written at wave wrap: which model wins each seat, with the evidence, and a recommendation on where
to use Codex vs Claude going forward._
