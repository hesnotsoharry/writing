---
status: PLANNED
created: 2026-06-16
---

# Wave 52: ai-exclude-prose

## Plan

### Status

PLANNED · target v0.12.0 · drafted 2026-06-16 · **cross-boundary** (client editor + client DB
migration + server proxy). Implements the W46-committed "AI context control & mature-content
handling" slice (W46 Decision 13 + Follow-up candidate §83) in full: (a) per-range hide-from-AI
mark, (b) reactive managed-refusal warning, (c) entity-exclusion persistence fix.

### Goal

After this wave, a writer can select any block of prose and mark it **"Hide from AI."** Marked text
renders with a distinct redacted treatment, persists in the scene's Yjs doc across reloads, and is
**replaced with `[passage hidden by author]`** in everything sent to the AI assistant across all four
production paths (managed proxy, BYOK Anthropic, BYOK OpenAI, BYOK local) — regardless of any
scene/chapter/manuscript content flag. The plain manuscript (export, word-count) keeps the full text.
Separately, when the **managed tier refuses** a request because the manuscript contains explicit
content, the app surfaces a calm "connect a BYOK/local model for mature content" notice instead of a
generic error. And the existing entity-level **"never send to AI"** toggle finally **persists across
sessions** (today it resets every launch; characters/locations can't be excluded at all). The two
selection bubbles that currently fight for space above a selection (`FormatBubble` + the floating
`AiAskPill`) are consolidated into one, and the AI affordance is consent-gated.

This closes W46's Decision 13 product gap: explicit content reaching Cole's managed Anthropic key
risks account suspension (Anthropic moderates at INPUT). The hide-from-AI mark is the writer's tool to
keep explicit passages out of moderated requests; the managed-refusal warning is the safety net when
they forget.

### Scope

**In scope:**

- **(a) `AiExclude` mark.** New TipTap v3 custom Mark in a **new file** `src/editor/extensions/AiExcludeExtension.ts`
  (W46 scout note: no custom marks exist yet — current editor effects are `Decoration.inline`, not
  Marks), registered in `buildExtensions()` `src/editor/Editor.tsx:96`, modeled on the in-tree
  `Highlight` mark. Redacted visual treatment (shaded bg / muted) in `app.css`. A toggle button in
  `src/editor/FormatBubble.tsx` (copying the highlight-swatch pattern at `FormatBubble.tsx:74`).
- **(a) context strip.** A mark-aware extraction variant on the Yjs serialize path
  (`src/yjs/serialize.ts`) that replaces `AiExclude`-marked runs with `[passage hidden by author]`,
  wired into `assembleContext()` (`src/features/ai/ai.context.ts:118`) alongside `filterAiEntities()`
  (`:56`) before prose reaches `buildGrounding()` (`src/features/ai/prompts/shared.ts:123`). Redacts
  **both** the `sceneExcerpt` AND the separate `selectionText` input. Composes with — does NOT
  duplicate — the existing coarse `AiContextPicker` (`AiOverlays.tsx:258`).
- **Bubble overlap + consent.** Fold the "Ask assistant" action into `FormatBubble`; remove the
  standalone `AiAskPill` render at `AssistantPanel.tsx:356`. AI affordances in the bubble appear only
  when `aiConsentGiven` is true; plain formatting buttons stay ungated.
- **(b) managed-refusal warning.** SERVER: in the proxy `marketing/functions/api/ai/chat.ts:264`
  (`!res.ok` branch), distinguish an Anthropic content-policy block (HTTP 400 + policy markers) from
  other upstream failures and emit a new `content-blocked` `NormalizedEvent` (vs. the generic
  `"error"`); log the raw upstream body server-side for shape-confirmation. CLIENT: extend the
  `NormalizedEvent` union (`ai.client.ts:21`) + the event-handler switch
  (`AssistantPanel.hooks.ts:172`) to surface the BYOK/local nudge.
- **(c) entity-exclusion persistence.** New migration adding `exclude_from_ai INTEGER NOT NULL DEFAULT 0`
  to the `characters` and `locations` tables (it already exists on `entities` — `migrations2.ts:203`);
  update the store reads (`sqliteStoryBibleStore.ts:198,214-221`) to select the column and stop
  hardcoding `false`; add a `setEntityExclusion(id, type, exclude)` store method (sqlite + in-memory);
  wire `toggleNever` (`AssistantPanel.tsx:331`) to persist immediately instead of session-local
  `useState`.

**Out of scope:**

- BYOK-tier behavior changes / adult-content routing (memory
  `adult-content-byok-only-managed-tier-sfw`) — separate concern. → deferred: future wave.
- Proactive content-scanning for (b) (rebuilds the moderation layer we're avoiding — W46 chose
  reactive catch-the-refusal). → deferred: explicitly rejected, not deferred.
- The coarse `AiContextPicker` modal redesign — the new mark composes with it, doesn't change it. →
  deferred: N/A.
- A keyboard shortcut for the mark. → deferred: `## Follow-up candidates` if requested.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | `AiExclude` mark + styling + FormatBubble toggle | `sonnet-implementer` | trophy · internal+UI · Create `src/editor/extensions/AiExcludeExtension.ts` via `Mark.create({name:'aiExclude'})` with set/unset/toggle commands — **research TipTap v3 `commands.toggleMark` + custom-mark/Collaboration interaction via ctx7 first** (project is `@tiptap/* ^3.24.0`); register in `buildExtensions` (`Editor.tsx:96`); add redacted CSS; add ONE toggle button to `FormatBubble` copying the highlight swatch pattern (`FormatBubble.tsx:74`). Highlight is the precedent → no walking skeleton. | Select prose → click "Hide from AI" in the format bubble → text shows redacted styling; reload the scene → styling persists (Yjs round-trip). Verify via CDP smoke (port 9222, dev build). |
| 2 | Mark-aware context strip → `[passage hidden by author]` | `sonnet-implementer` | pyramid · **cross-boundary (security-critical)** · Add a redacting extractor on `src/yjs/serialize.ts` (walk `Y.XmlText` deltas, check `attributes.aiExclude`, replace run with the placeholder) used ONLY by `assembleContext`. Redact BOTH `sceneExcerpt` AND `selectionText`. Leave plain `extractPlainText` untouched (export/word-count). **Orchestrator authors the failing acceptance test first.** | An AI request whose scene contains a hidden range carries `[passage hidden by author]` in place of that prose — NOT the raw text — in the assembled context for all 4 paths. Primary oracle: unit test at the `ai.context.ts`/`serialize.ts` seam (Y.Doc with marked run → asserted placeholder substitution). |
| 3 | Bubble overlap resolution + consent gate | `sonnet-implementer` | trophy · UI+consent · Fold "Ask assistant" into `FormatBubble` (optional `onAskAi?` callback so the editor feature stays decoupled); remove the `AiAskPill` render at `AssistantPanel.tsx:356`; gate the AI-ask button on `aiConsentGiven` (`getTweak("aiConsentGiven", false)`). Plain formatting buttons stay ungated. | On text selection only ONE bubble appears (no overlap). With `aiConsentGiven=false` the AI-ask button is absent; format buttons still work. Verify via CDP smoke. |
| 4 | Entity-exclusion persistence (migration + store + wiring) | `sonnet-implementer` | pyramid · cross-boundary (DB schema) · NEW migration: add `exclude_from_ai INTEGER NOT NULL DEFAULT 0` to `characters` + `locations` (parallel to `entities` `migrations2.ts:203`); update reads `sqliteStoryBibleStore.ts:214-221` to SELECT the column + drop the `toPlain` hardcode (`:198`); add `setEntityExclusion(id,type,exclude)` to the `StoryBibleStore` interface (sqlite + in-memory); rewire `toggleNever` (`AssistantPanel.tsx:331`) to persist. **Memory `adding-migration-breaks-prior-migration-tests`: run the FULL test suite after, not just touched.** | Toggle a character/location/entity "never send to AI" → close + relaunch the app → the toggle is still set (was session-local before). Verify via CDP smoke + full-suite green. |
| 5 | Managed-refusal warning (server proxy + client event) | `sonnet-implementer` | honeycomb · **cross-boundary (SERVER — marketing proxy; PUSH IS GATED)** · SERVER: in `marketing/functions/api/ai/chat.ts:264` (`!res.ok`), defensively `await res.json().catch(()=>null)`, and when status is 400 with Anthropic content-policy markers emit `{type:"content-blocked"}` (else keep generic `"error"`); refund path unchanged; **log the raw upstream body**. **ctx7 the Anthropic streaming input-moderation error shape first** — exact body unconfirmed in code. CLIENT: add `content-blocked` to `NormalizedEvent` union (`ai.client.ts:21`) + handle it in `AssistantPanel.hooks.ts:172` to show the BYOK/local nudge. **Marketing gates = test + tsc ONLY (no lint); keep diffs inside `marketing/`; do NOT touch root `eslint.config.mjs`.** Commit but **HOLD push** — surface to Cole (push deploys live writersnook.app). | A managed request on a manuscript with explicit content shows the calm "connect BYOK/local for mature content" notice, not a generic error. Primary oracle: server unit test (mock 400-policy upstream → `content-blocked` SSE) + client handler unit test. **Live confirmation deferred** — needs a real blocked request (Cole-run, post-deploy); server log captures the real body to tighten the parser. |

### Acceptance criteria

- [ ] An `AiExclude` mark is registered in `buildExtensions` and toggles via a `FormatBubble` button
      (`editor.isActive('aiExclude')` reflects state).
- [ ] Hidden prose renders with distinct redacted styling and survives a scene reload (Yjs delta
      round-trip).
- [ ] `assembleContext` replaces every `AiExclude`-marked run in `sceneExcerpt` with
      `[passage hidden by author]` before the `SCENE_EXCERPT_CHARS` slice.
- [ ] `assembleContext` also redacts the separate `selectionText` input when the selection overlaps a
      hidden range.
- [ ] All four production paths (managed `AssistantPanel.hooks.ts:165`; BYOK Anthropic `byok.ts:71`;
      BYOK OpenAI `byok.ts:116`; BYOK local `byok.ts:178`) inherit the redaction via `assembleContext`.
- [ ] Plain `extractPlainText` (export / word-count) is NOT redacted.
- [ ] Exactly one bubble appears on text selection (the `AiAskPill`/`FormatBubble` overlap is gone).
- [ ] No AI affordance appears when `aiConsentGiven` is false; formatting buttons still work AI-off.
- [ ] The entity "never send to AI" toggle persists across an app relaunch for characters, locations,
      AND generic entities (new migration applied; store writes the column; `toggleNever` persists).
- [ ] Full test suite green after the Phase-4 migration (prior migration tests not broken).
- [ ] A managed content-policy refusal yields a `content-blocked` event that surfaces the BYOK/local
      nudge; non-policy upstream failures still yield the generic error.
- [ ] Gates green: client phases — `vitest` (touched), `tsc`, `eslint` (root `eslint.config.mjs`);
      marketing phase — `vitest` + `tsc` only (no lint), diffs confined to `marketing/`.

### Files the next agent should read first

1. `src/editor/Editor.tsx:96` — `buildExtensions`; where the new mark registers; StarterKit
   (`undoRedo:false`) + Collaboration + Highlight wiring.
2. `src/editor/FormatBubble.tsx:74` — highlight toggle pattern (template for the new button); `:194`
   BubbleMenu visibility.
3. `src/yjs/serialize.ts:26` — `extractPlainText` (walks the **Y.Doc** XML fragment via `toDelta()`);
   the strip lives here, mark-aware (check delta `attributes`, NOT ProseMirror `node.marks`).
4. `src/features/ai/ai.context.ts:118` — `assembleContext`; `sceneExcerpt` build (~:122), the
   `selectionText` input, the entity filter `filterAiEntities` (~:56).
5. `src/features/ai/AssistantPanel.tsx:331,334,356` — `neverNames`/`toggleNever` (session-local, to
   persist), `consented` var, `AiAskPill` render (to remove).
6. `src/features/ai/AssistantPanel.parts.tsx:307` — `AiAskPill` (the standalone pill being folded in).
7. `src/db/migrations2.ts:203` — the existing `exclude_from_ai` column on `entities` (template for
   the characters/locations migration).
8. `src/db/sqliteStoryBibleStore.ts:198,214-221` — `toPlain` hardcode (`exclude_from_ai:false`) +
   the character/location SELECT branches that omit the column.
9. `marketing/functions/api/ai/chat.ts:264` — proxy `!res.ok` branch (the ONLY catch point for an
   upstream content block); `marketing/functions/_lib/providers/anthropic.ts:104` — the `pump` adapter.
10. `src/features/ai/ai.client.ts:21` — `NormalizedEvent` union; `AssistantPanel.hooks.ts:172` — the
    event-handler switch.

### Note to the implementer

The spirit of this wave is a **privacy guarantee plus a safety net**, not a cosmetic mark. Phase 2 is
the load-bearing privacy step: the strip MUST happen on the Yjs serialize path (`extractPlainText`
reads the Y.Doc, not the ProseMirror editor state — check delta `attributes`, not `node.marks`) and
MUST cover `selectionText` as well as `sceneExcerpt` — the "Ask about this selection" action passes
selected text in as a separate string, and redacting only `sceneExcerpt` leaks the hidden prose
through that input. Do NOT redact inside plain `extractPlainText` — that would corrupt the writer's
own export and word count; add a redacting variant used only by `assembleContext`.

Phase 5 crosses into the marketing/server tree: the detection HAS to be server-side (the client can't
see the upstream HTTP status), the exact Anthropic error body is unconfirmed so build defensively and
log the raw body, marketing gates are test+tsc only, and the push is HELD for Cole because it deploys
the live proxy. Do not push Phase 5 yourself.

Before declaring a phase complete, restate the observation point from the Phases table Observation
column in your own words and describe what you actually observed there. If you could not observe it
directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not
substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but
not sufficient. First step: verify the `## Locked decisions` section below is filled in.

## Locked decisions

> Decisions 2–5 are research-grounded with single clear answers (W46-ratified placeholder; the strip
> chokepoint is the verified single path; the proxy `!res.ok` branch is the ONLY place upstream
> status+body coexist; the migration shape mirrors the existing `entities` column) — skip-tier, no
> decision-review cell. Decision 1 (bubble overlap) carries mild UI-architecture tension; if the
> Phase 3 implementer deviates from "merge into FormatBubble," route it through the decision-review
> cell (`sonnet-architect` → `sonnet-adversarial-reviewer` `Posture: attack-decision`) before
> re-locking.

## Decision 1: bubble overlap resolution

**Context:** `AiAskPill` (floating portal) and `FormatBubble` (BubbleMenu) both position above a text
selection and overlap.
**Pick:** Fold the "Ask assistant" action into `FormatBubble` as a button; remove the standalone
`AiAskPill` render. The editor feature stays decoupled via an optional `onAskAi?` callback wired by
the App layer (present only when AI is enabled+consented).
**Rationale:** The exclude action is a mark toggle exactly like highlight, which already lives in
`FormatBubble` — both AI affordances belong in the one selection bubble, and merging removes the
overlap by construction rather than by z-index/position tweaking.
**Consequences:** `FormatBubble` gains an optional AI-callback prop; `AiAskPill` is deleted; the
`aiSelPill` tweak's meaning shifts to "show the AI-ask button in the bubble."
**Enforcement:** advisory-only (route through decision-review cell on deviation).
durable: candidate

## Decision 2: omission representation = `[passage hidden by author]`

**Context:** When hidden prose is stripped, what does the AI see in its place?
**Pick:** Replace each hidden run with the literal marker `[passage hidden by author]` — AI-visible,
NOT a silent delete. (W46-ratified string; supersedes the draft's `[omitted by author]`.)
**Rationale:** Cole's explicit W46 requirement — the assistant must know text was omitted so it
doesn't assume a narrative gap and hallucinate continuity. A visible marker preserves continuity
awareness without exposing content.
**Consequences:** Assembled-context length includes the marker (negligible vs the 2000-char
`SCENE_EXCERPT_CHARS` budget); the marker is a one-place constant.
**Enforcement:** advisory-only (asserted by the Phase 2 acceptance test).

## Decision 3: strip at the `assembleContext` chokepoint via a mark-aware serialize variant

**Context:** Where does the redaction happen so all four AI paths inherit it without redacting
export/word-count?
**Pick:** Add a redacting extractor on `src/yjs/serialize.ts` (mark-aware over Y.Doc deltas) called
ONLY by `assembleContext`, alongside `filterAiEntities`; leave plain `extractPlainText` untouched.
**Rationale:** `assembleContext` is the verified single chokepoint for all prose-to-AI flow (managed +
3 BYOK); the strip there covers every path once. Keeping plain `extractPlainText` un-redacted protects
export and word count.
**Consequences:** Two extraction functions coexist (plain + redacting); AI paths use the redacting
one, everything else the plain one.
**Enforcement:** advisory-only (asserted by the Phase 2 acceptance test: AI path redacts, export does
not).
durable: candidate

## Decision 4: managed-refusal detection point = server proxy, new `content-blocked` event

**Context:** A managed content-policy refusal must be distinguished from billing/overload/network
failures so the app can nudge toward BYOK/local instead of showing a generic error. Where is that
distinction observable?
**Pick:** Detect server-side in the proxy `marketing/functions/api/ai/chat.ts:264` (`!res.ok`) — the
ONLY place the upstream HTTP status and body coexist — and emit a new `content-blocked` `NormalizedEvent`
(extend the union + client switch). Build defensively (HTTP 400 + content-policy markers) and log the
raw upstream body; live confirmation of the exact Anthropic shape is deferred to a real blocked request.
**Rationale:** The proxy today collapses ALL non-ok upstream responses into one generic error event
(`chat.ts:264-267`), erasing the signal; the client never sees the status. There is exactly one catch
point. A new event type (vs. overloading `"error"` with a reason field) keeps the client switch
explicit and the refund path untouched.
**Consequences:** Wave crosses into `marketing/` (server) — gates are test+tsc only, push deploys the
live proxy (HELD for Cole). `NormalizedEvent` union + the `AssistantPanel.hooks.ts` switch both gain a
member. The defensive parser may need a one-line tightening after the first real refusal body is logged.
**Enforcement:** advisory-only (asserted by Phase 5 server + client unit tests; live confirmation is a
post-deploy verification follow-up).
durable: candidate

## Decision 5: entity-exclusion persistence via a new column migration

**Context:** The "never send to AI" toggle is session-local `useState` (`AssistantPanel.tsx:331`) and
characters/locations hardcode `exclude_from_ai:false` (`sqliteStoryBibleStore.ts:198`) — it resets
each launch and can't exclude characters/locations at all.
**Pick:** New migration adding `exclude_from_ai INTEGER NOT NULL DEFAULT 0` to `characters` +
`locations` (mirroring the existing `entities` column at `migrations2.ts:203`); store reads select the
column; a new `setEntityExclusion` method persists the toggle.
**Rationale:** The column already exists and is read correctly for generic entities; extending the same
shape to characters/locations is the minimal, consistent fix. Persisting at toggle time matches how
the rest of the store works.
**Consequences:** New migration → run the FULL suite (memory `adding-migration-breaks-prior-migration-tests`:
appended migrations break prior migration tests via hardcoded LATEST + partial seed fixtures).
**Enforcement:** advisory-only (asserted by the Phase 4 acceptance test + full-suite green).

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | ✓ | ✓ | 4fdf4c3 | code+gates green, review PASS 6/6; runtime CDP smoke deferred to batched client smoke |
| 2 | ✓ | ✓ | 2bc4f13 | strip unit-tested at all 3 redaction targets (sceneExcerpt + selectionText two-path + extra-scene); panel-tier review caught a CRITICAL `s.toString()` selection leak (all 3 seats converged), fixed + suppression-branch regression test added; 37/37 tests green; runtime CDP smoke deferred to batched client smoke |
| 3 | ✓ | ✓ | (pending) | "Ask assistant" folded into FormatBubble (single bubble, removes AiAskPill overlap); AI action consent-gated (`aiEnabled && aiConsentGiven && aiSelPill`), formatting + AiExcludeToggle ungated; editor-ask inherits Phase-2 redaction via `extractAiSafeSelection` (review PASS on the security angle); 6/6 tests green; single-bubble visual confirm deferred to batched CDP smoke |
| 4 | — | — | — | — |
| 5 | — | — | — | — |

## Follow-up candidates

<!-- empty by default; staged only if a candidate clears the Tier-3 triple gate -->

## Result

<!-- filled at ship by wrap team -->
