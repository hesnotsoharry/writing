# AI assistant v2 — harness, conversations, manuscript context

**Status:** discovery input for wave-35 planning (Cole, 2026-06-12, during wave-34 Phase 4).
**Source:** live use of the Phase 3 brainstorm panel on a real scene.

## Cole's asks

1. **Improve the harness.** The brainstorm system prompt works but is a four-line generalist
   preamble. Wants a real prompt-quality pass.
2. **Tabs / conversation model.** Either a tab system for the Assistant panel or tying the
   panel per scene — Cole leans tabs. (Current panel is a single transient exchange.)
3. **Manuscript synopsis section.** A user-filled general description of the manuscript that
   always rides along, so the model has a synopsis of the work it's helping with.
4. Explicitly invited "a few other things we could add."

## Technical shaping (agent recommendation, 2026-06-12)

- **Harness pass → fold into wave 35's verb-template phase** (critique/beta-read/proof
  templates must be authored anyway). Structured context sections, genre/tone awareness,
  verb-specific response-format discipline. Not wave-sized on its own.
- **Conversations: manuscript-level objects, NOT per-scene.** Persisted in local SQLite
  (consistent with local-first); tabs/list UI in the panel; each message snapshots the
  scene-context chips that applied at send time. Multi-turn = messages array grows; mind
  the credit-reserve estimate (input grows per turn) and a context-window cap with visible
  truncation. Meatiest item — anchor of wave 35 or a sibling wave.
- **Manuscript synopsis: "About this manuscript" fields** (synopsis, genre, tone, POV/tense,
  free-form "things the assistant should know") stored per manuscript, always included in
  the system prompt. Small scope, high grounding value. Wave 35.

## Additional candidates (unratified)

- Style sample: a user-chosen paragraph as register reference for suggestions.
- Spoiler boundary per conversation ("model may know chapters 1–12 only").
- Author preferences block: UK/US spelling, profanity tolerance, etc.
- Chapter-so-far rolling summaries as cheap whole-manuscript context (interacts with
  wave-35's planned whole-manuscript context + count_tokens estimate UX).

## Constraints carried forward

- D4 honest framing: anything new that leaves the machine must surface in the "What I can
  see" strip / consent copy.
- D3 metering: per-verb max_tokens constants; multi-turn grows input cost — reserve
  estimate must track the full messages array + system (it does, post-9343691).
