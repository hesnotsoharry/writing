---
project: writing
wave: 47
slug: ask-mode
title: Free-form "Ask" mode — context-aware general writing assistant
status: SHIPPED
created: 2026-06-14
shipped: 2026-06-14
---

# Wave 47 — free-form "Ask" mode

## Goal

Add a 5th AI mode beyond the 4 task verbs (brainstorm / critique / beta-read / proofread): the
writer asks **any** question and still gets the manuscript context attached (current scene /
selection / Story Bible entities / About). The product principle (Cole, evidence-pack-backed):
**free-form in TOPIC, harnessed in STYLE, grounded in CONTEXT — NOT a raw blank box.** A blank box
invites generic AI slop; Ask is harnessed by its own system prompt (writing-assistant persona,
anti-AI-isms, no unprompted prose-generation / padding) and grounded by the existing context
assembly.

## Context (grounding — what already exists)

The AI subsystem (`src/features/ai/`) is **already a multi-turn conversational chat panel**, not a
set of single-shot buttons. Every verb runs through one path keyed on `verb`:

- `AssistantPanel.tsx` → `PanelReady` holds per-session state (`usePanelState`, default verb
  `"brainstorm"`).
- `AssistantPanel.hooks.ts` → `execSend` → `streamAiResponse` calls `assembleContext()` then
  `buildMessages(verb, ctx, ask, history)` then `streamChat()`. History is persisted to SQLite
  (`AiConversationStore`) and replayed via `buildHistory()` — **multi-turn is already production-
  tested for every verb.**
- `prompts/` — one file per verb exporting `build{Verb}Messages(ctx, ask, history?)` + a
  `{VERB}_MAX_TOKENS` const; `prompts/index.ts` is the `buildMessages` dispatcher (exhaustive
  `switch` on `VerbKey`, no `default` — adding a `VerbKey` member without a case is a tsc error).
- `prompts/shared.ts` — `SHARED_PRINCIPLES` (anti-sycophancy, **critique-flavored**: "ground every
  claim in a named line/quote", "state problems directly") + `buildGrounding(ctx)` (injects
  boundary / About / scene excerpt / entities / selection / extra scenes).
- Context-attachment UX (`ContextStripPanel`, `AiContextPicker`, selection pill) is verb-agnostic
  and **reused as-is**.
- Routing: client sends `{ messages, verb, system }` to the managed proxy; the proxy resolves
  model/temp/maxTokens from `marketing/functions/_lib/verb-config.ts` server-side. Metering /
  credits / hard-stop all flow through the existing `done`/`credits-exhausted` events. Ask is
  metered exactly like the other managed verbs — no new billing path.

**Dual VerbKey (load-bearing):** `VerbKey` is defined independently in
`src/features/ai/ai.types.ts:3` (client) and `marketing/functions/_lib/verb-config.ts:13` (server).
Both MUST be updated together — adding `"ask"` to only one silently falls through to
`FALLBACK_VERB_CONFIG` (no error). No compile-time guard couples them.

## Phases

This is a small, tightly-coupled wave (shared `ai.types.ts` + verb contract). Single implementer,
two logical concerns:

### Phase 1 — Ask verb: prompt + dispatcher + server registration
- **New** `src/features/ai/prompts/ask.ts` — `buildAskMessages(ctx, ask, history?)` + `ASK_MAX_TOKENS`.
  Own persona + style + prose-guard blocks (NOT `SHARED_PRINCIPLES`, which is critique-shaped). Still
  calls `buildGrounding(ctx)` so Ask is grounded identically. Exact prompt content in Decision 2.
- `src/features/ai/prompts/index.ts` — add `case "ask"` to `buildMessages`; add `ask` to
  `VERB_MAX_TOKENS`; re-export `buildAskMessages` + `ASK_MAX_TOKENS`.
- `src/features/ai/ai.types.ts` — add `"ask"` to `VerbKey`; add an `AI_VERBS.ask` entry
  (label "Ask", icon, blurb, placeholder, free-form starters). **Do NOT add `"ask"` to
  `AI_VERB_ORDER`** — that array stays the 4 task verbs so Ask reads as distinct (Decision 1).
- `marketing/functions/_lib/verb-config.ts` — add `"ask"` to the server `VerbKey` union and a
  `VERB_CONFIG.ask` entry: `{ model: 'claude-haiku-4-5-20251001', temperature: 0.7, maxTokens: 2048 }`.
- Tests: add `prompts/ask.test.ts` mirroring existing verb-prompt tests (asserts persona present,
  grounding injected, history threaded, no prose-gen instruction present). Mirror any existing
  `verb-config` exhaustiveness test on the marketing side.

### Phase 2 — distinct Ask UI (the "conversational chat-panel, not a 5th button" surface)
- `src/features/ai/AssistantPanel.hooks.ts` — `usePanelState` default verb `"brainstorm"` → `"ask"`
  (fresh panel opens conversational).
- `src/features/ai/AiComponents.tsx` — `AiEmptyState`: add a distinct **"Ask anything"** hero
  affordance ABOVE the 4-verb grid (primary, free-form framing; clicking sets verb `"ask"` + focuses
  input). The existing 4-verb grid stays below as the "or pick a task" secondary. Ask gets its own
  starters. Update `AiDormant` copy to mention asking anything.
- `src/features/ai/AssistantPanel.parts.tsx` — `VerbPop`: render an Ask entry at the top (separated
  from the 4 `AI_VERB_ORDER` task verbs) so users can switch back to Ask from a task. `PanelFooter`
  verb chip already renders `AI_VERBS[verb]` → shows "Ask" automatically.
- `src/features/ai/AssistantPanel.tsx` — rewire the floating selection pill: `AiAskPill` `onAsk`
  currently `seedAsk("brainstorm", liveSel)` → `seedAsk("ask", liveSel)` (the pill already reads
  "Ask the assistant" — this fixes a latent label/behavior mismatch).
- CSS: reuse existing `ai-*` classes; add minimal styling for the hero if needed (match existing
  tokens / the two-tier hover doctrine — neutral furniture, accent only on content surfaces).

## Locked decisions

## Decision 1: Ask is a distinct conversational lead, not a 5th task-verb button
**Context:** Brief mandates "a conversational chat-panel UI distinct from the 4 verb buttons." The
panel is already conversational, so distinctness is about framing/affordance, not new architecture.
**Pick:** Add `"ask"` as a `VerbKey` but keep it OUT of `AI_VERB_ORDER`; surface it via a dedicated
empty-state hero + the selection pill + a separated top entry in the verb-switch popover; default the
fresh panel to Ask.
**Rationale:** Keeps the 4 task verbs as discrete task buttons (picker + empty-state grid unchanged)
while giving Ask its own free-form, conversational-first entry — faithful to "distinct from the 4
buttons" with the smallest change to a production-tested panel.
**Consequences:** Fresh-panel default verb changes brainstorm→ask (visible behavior change, reversible
one-liner). Any code iterating `AI_VERB_ORDER` keeps the 4 verbs; code reading `AI_VERBS[key]` must
tolerate the new `ask` key (it does — record is keyed by `VerbKey`).
**Enforcement:** advisory-only (design intent; tsc exhaustiveness enforces the verb wiring).

## Decision 2: Ask gets its own persona + anti-AI-ism prompt, not SHARED_PRINCIPLES
**Context:** `SHARED_PRINCIPLES` is critique-shaped ("ground every claim in a named line/quote",
"state problems directly") — wrong for a free-form Q&A that may be general (craft, process, plot
logic) and not about judging a passage.
**Pick:** Author an Ask-specific system prompt: writing-assistant persona + a `<style>` block (no
praise/preamble, ban common AI-isms, length-matches-question, no padding) + a `<prose>` guard (do
NOT generate story prose/rewrites unless explicitly asked; keep it tight when asked). Still call
`buildGrounding(ctx)` for context.
**Rationale:** Matches the W47 design ("Ask gets its own system prompt … anti-AI-isms, no unprompted
prose-generation / padding"). The prose-guard is the slop-guard at the layer closest to the "blank
box" the research warns about.
**Consequences:** Two principle blocks now exist (SHARED for task verbs, Ask-local for Ask). If a
future wave (W42) ships a worker-appended house-style block, it layers on top of both.
**Enforcement:** advisory-only.

### Ask system prompt (the deliverable's quality core — implement verbatim)
```
You are a writing assistant embedded directly inside a fiction writer's manuscript.
The writer can ask you anything: craft questions, story problems, plot logic, character
motivation, word choice, research-style questions, or how to approach a revision.
Answer the actual question directly and usefully. Lead with substance — no preamble.
Use the manuscript context below when it is relevant; when the question is general, you do
not need to force a connection to the open scene.
<style>
Do not open with praise, a compliment, or a restatement of the question. No "Certainly",
"Great question", "I'd be happy to" — just answer.
Avoid AI-isms and filler: no "delve", "tapestry", "testament to", "navigate the complexities",
"it's important to note", "in the realm of", "rich and vibrant", or hollow throat-clearing.
Match the length of your answer to the question. Short questions get short answers. Do not pad
with restated conclusions or summaries.
Write plainly and concretely. Prefer specifics over generalities.
</style>
<prose>
Do NOT generate story prose, scene drafts, or rewrites unless the writer explicitly asks for them.
Your default is to advise and discuss, not to write the writer's book for them.
When the writer does ask for prose, keep it tight and purposeful — no purple description, no
filler beats, no padding to fill space.
</prose>
```
(`ASK_MAX_TOKENS = 2048` for the client estimate const; server `maxTokens` is authoritative.)

## Acceptance

- Free-form question + attached context → grounded, harnessed answer; context-selection visible in
  the strip (controllable-context differentiator); metered correctly (credits decrement, hard-stop
  holds) — Ask routes through the managed proxy as `verb: "ask"`.
- Ask is reachable as a distinct conversational entry (empty-state hero + selection pill), not just a
  5th item in the task-verb picker.
- Multi-turn works (history threads through `buildHistory` like every verb).
- Gates green: `npm run lint`, `npm run test` (touched), `tsc`. Marketing side: `test` + `tsc` (no
  lint in marketing per project canon).
- `VerbKey` updated in BOTH `ai.types.ts` and `marketing/functions/_lib/verb-config.ts`.

## Follow-up candidates

None. (Note, not a candidate: `aiVerbPrompts.test.ts`'s `VERB_MAX_TOKENS` assertion covers only the
4 task verbs — that file carries a wave-35 "may NOT modify" comment, and `aiAskPrompt.test.ts`
already pins `ASK_MAX_TOKENS === 2048`, so there is no present harm and nothing to file.)

## Result

**Status: COMPLETE — branch `wave-47-ask-mode`, all gates green, NOT pushed (awaiting Cole review/merge).**

Shipped: a 5th AI mode, free-form **Ask**, alongside the 4 task verbs. Free-form in topic, harnessed
in style (own persona + `<style>`/`<prose>` anti-AI-ism + no-unprompted-prose-gen blocks, NOT the
critique-shaped `SHARED_PRINCIPLES`), grounded in context (`buildGrounding` — scene / Story Bible /
About / selection), routed through the existing managed proxy as `verb:"ask"` (metered + hard-stopped
identically to other verbs; global Haiku default model, temp 0.7, maxTokens 2048).

Key realisation vs the design doc's premise: the assistant panel was **already** a multi-turn
conversational chat surface (persisted history, context-attachment UX) — so Ask is a new verb +
persona prompt + a *distinct* entry, not new conversational architecture. Distinctness (Decision 1):
`ask` is a `VerbKey` kept OUT of `AI_VERB_ORDER`; surfaced via an empty-state "Ask anything" hero
(focuses the composer), a separated top entry in the verb-switch popover, the floating selection pill
(rewired from a latent `brainstorm` mis-seed), and the fresh-panel default verb (brainstorm→ask).

Files: NEW `prompts/ask.ts` + `src/test/aiAskPrompt.test.ts`; edited `ai.types.ts`, `prompts/index.ts`,
`marketing/functions/_lib/verb-config.ts` (server VerbKey + VERB_CONFIG.ask — **dual-VerbKey both
sides**), `AssistantPanel.{hooks,slot,parts,tsx}.ts(x)`, `AiComponents.tsx`, `styles/app.css`, and
`AssistantPanel.test.tsx` (mock + assertions updated for the new Ask default).

**Review:** `sonnet-adversarial-reviewer` (attack-diff) returned BLOCK + FLAG, both real, both fixed:
- BLOCK — the default-verb change first landed in `AssistantPanel.hooks.ts` where `initialVerb` is
  never null (so `?? "ask"` was dead). Real fix was in `AssistantPanel.slot.ts` (`useAiPanelSeed`
  init + `AI_ASK_FROM_EDITOR` fallback → `"ask"`).
- FLAG — empty-state hero didn't focus the composer; added `onFocusInput` threaded hero→PanelThread→
  PanelReady.

**Gates:** app lint clean · app tsc clean · full app suite **1410 passed (146 files)** · marketing
tsc clean · marketing test passed.

**Smoke: DEFERRED per Cole's session brief** ("skip smoke testing for the most part"). Ask reuses the
identical proxy/streaming/metering path as 4 already-smoked verbs; the only net-new surfaces (prompt,
empty-state hero, popover entry, pill) are covered by the new unit test + the updated component test.
A live CDP smoke (type a free-form Ask, confirm grounded answer + credit decrement + meter) is the
one thing not exercised end-to-end — worth a 2-minute pass before/after merge.
