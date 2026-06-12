# Assistant — AI panel design canon (waves 34–36)

**Status:** built into the canon prototype (Jun 2026). Supersedes the wave-34
Phase 3 dev panel (`src/.../AssistantPanel.tsx`) visually and extends it with the
wave 35–36 feature set: four verbs, conversations as manuscript-level objects,
context pickers + never-share flags, About-this-manuscript, spoiler boundary,
selected-text asks, cost cues, and the full guardrail-state vocabulary.

Discovery inputs honored: `2026-06-12-ai-assistant-v2-context-and-conversations.md`
(Cole: tabs-leaning conversations · manuscript synopsis · "a few other things")
and the wave-34 briefing ("AI you control" — honest context, meter-not-math,
writing always primary).

Files: `assistant-data.jsx` · `assistant.jsx` · `assistant-overlays.jsx` ·
`assistant.css` (+ wiring in `shell.jsx`, `app.jsx`, `settings.jsx`,
`inspector.jsx`, `icons.jsx`, `index.html`).

---

## The hole it fills

Wave 34 shipped a working brainstorm exchange with an honest context strip, but
it is a *transient* single exchange in a dev-gated tab. Waves 35–36 need: more
verbs with their own tones, conversations that persist and don't swallow a
296px panel, context the writer can shape (and refuse), and billing/guardrail
states that inform without alarming. This canon build answers all of those in
the app's own visual language so eng can port against something whole.

## Design decisions (and why)

- **The Assistant is a sibling tab of the Scene inspector** (`Scene · Assistant`
  underline tabs at the top of the right panel — same pattern as production's
  `InspectorTabShell`, restyled to canon). Both panes stay mounted; switching
  tabs never loses a draft or a stream.
- **Verb is a chip on the composer**, not a toolbar: a small accent-tinted
  `Brainstorm ▾` chip opening a 4-row popover (icon · name · one-line blurb).
  In a fresh conversation the empty state shows a 2×2 verb-card grid plus two
  starter prompts per verb, so the verbs are discoverable without permanent
  chrome.
- **Output shapes per verb:** brainstorm = short paragraphs + bold-led bullets;
  critique = three fixed sections ("What's working / Questions to sit with /
  If I pushed on one thing"); beta read = first-person reader voice with quoted
  lines; proofread = edit rows (struck `from` → `to` + a why) and NOTE lines —
  delivered as a block, not a trickle. Replies render serif-quoted prose
  (`.ai-q`) and never touch the manuscript; hover actions are Copy and
  **Save to notes** (lands in the existing Quick-notes inbox).
- **Conversations are manuscript-level objects** (per the v2 doc, *not*
  per-scene). Each user message snapshots the context chips that applied at
  send time — the receipt renders as a quiet "Saw The Causeway +3" line that
  expands to literal chips. Four panel anatomies ship behind the
  **Tweaks → Assistant → Conversations** radio:
  - `tabs`: pill-tabs above the thread + a `+`.
  - `list` *(✅ DECIDED — the default; port this one)*: a back-chevron header;
    the thread area becomes a conversation list.
  - `drawer`: current thread + a history drawer sliding over the panel.
  - `stream`: one continuous thread with date dividers, no objects UI at all.
- **"What I can see" lives between thread and composer** — pinned to the ask,
  not the reply. Chips: open scene (accent), +N scenes, linked entities, About
  this manuscript, selection, spoiler boundary. An `Adjust` affordance opens
  the context picker. A dashed ghost chip offers "Use selection · N words"
  whenever prose is selected.
- **Context picker** (sheet): About-card with inline editor (synopsis · genre ·
  tone · POV/tense · free-form notes — always rides along), a chapter/scene
  checklist (open scene locked in), the Story Bible list with per-entity
  include checkboxes **and a shield = "never share with AI"** (struck +
  dimmed when set), a **spoiler boundary** select ("Read up to Chapter …" —
  the model is told to act as if it hasn't read past it), and a live
  size-estimate meter ("≈ N% of your monthly allowance per ask").
- **A meter, not math.** The footer meter shows remaining allowance as a thin
  accent bar with status words only ("Plenty left this month" / "About half
  left" / "Running low" warn / "Used up" danger) + the reset date. BYO-key
  plan replaces the meter with "Using your own API key". A **cost cue**
  appears above the composer only when an ask is unusually large (≥2% of the
  month in one go) — a butter-tinted note, never a blocker.
- **Guardrails replace the composer, never the history.** Offline = parchment
  banner + disabled composer ("your writing is never affected"). Expired plan =
  card with Renew · $14.99/mo + "Use my own key". Empty allowance = card with
  the reset date, "Top up", and "Wait for July" — the hard stop framed as the
  feature, not the failure. Old conversations stay readable in every state.
- **Consent before anything leaves the machine.** Until first-run consent, the
  tab shows a dormant card ("The assistant is asleep… nothing leaves your
  machine until you turn it on"). The walkthrough is three steps — *A
  collaborator in the margins* / *You can always see what it sees* (live chip
  demo) / *A meter, not a bill* (live meter demo) — ending in "Turn on the
  assistant". Replayable from Settings and Tweaks.
- **Selected-text asks, both ways** (the exploration the editor-menu canon
  deferred): a floating dark "✦ Ask the assistant" pill above any prose
  selection (default **on**), and brainstorm/critique/proofread items in the
  selection right-click menu (default **off** — the editor menu canon is
  no-AI; this is the opt-in exception). Both routes switch to the Assistant
  tab with the selection attached as a chip.
- **Settings → Assistant** (new nav section): enable toggle ("off removes
  every trace of AI"), plan (Subscription / My own key + key field), the two
  selection affordances, walkthrough replay, and a shield-led privacy block.
  The About screen's "No built-in AI, by design" line became "AI only if you
  ask for it…".

## Data reality check

Exists in production (wave 34): `ai.client.ts` (session + normalized SSE),
`ai.context.ts` (scene excerpt + entity summaries, caps), `prompts/brainstorm.ts`,
`AssistantPanel.tsx` + `InspectorTabShell`, `.ai-*` styles. **New for port:**

- `ai_conversations` + `ai_messages` tables (local SQLite): conversation
  `{id, manuscript_id, title, verb, created_at}`; message `{id, conversation_id,
  role, verb, body, context_json, created_at}` — `context_json` is the chip
  snapshot (scene id+title+words, entity names, extra scene ids, sel word
  count, about flag, boundary chapter id).
- `manuscript_about` (or columns on the project row): synopsis, genre, tone,
  pov, notes — folded into every system prompt.
- Entity flag `exclude_from_ai` (boolean) — honored by `ai.context.ts` and the
  picker; surfaced later on the Full Entry too (deferred).
- Per-request context config: extra scene ids, per-ask entity exclusions,
  spoiler boundary — panel state, persisted per conversation.
- Verb templates: `prompts/{critique,betaread,proofread}.ts` with per-verb
  `MAX_TOKENS` + response-format discipline (the v2 "harness pass"). Critique's
  three sections and proofread's edit-row grammar (`EDIT|from|to|why`,
  `NOTE|text`) are part of the template contract so the client can render rows.
- Credit display mapping: proxy reports credits; client maps to the
  status-word meter (≥80% used = "Running low", 100% = stop). No token numbers
  in UI anywhere.

Mocked here: replies (`AI_REPLIES`, grounded in The Salt Year), streaming
(`aiStream`, word-batched), estimate math (`aiEstimate` — words/4000 ⇒ % of
month), credit base per Tweak state.

## Wiring map (prototype)

- `app.jsx` — tweak defaults (`aiOn aiConsented aiLayout aiCredits aiPlan
  aiOffline aiSelPill aiSelMenu`) + state: `aiConvos/aiActive`, `aiAbout`,
  `aiNever[]`, `aiUsed` (session % spent), `aiCtxState` — passed as the `ai`
  prop bag.
- `shell.jsx` — `inspTab`/`pendingAsk` state, `useProseSelection()`, the
  `InspectorTabs` slot swap (plain `Inspector` when `aiOn` is off), `AiAskPill`,
  the selection right-click menu (`proseCtxMenu` on `.view-stage`), the
  `aiconsent`/`aicontext` overlays, and the Tweaks "Assistant" section.
- `inspector.jsx` — `embed` prop (renders `.insp-embed` instead of
  `.panel-inspector` inside the tab shell).
- `icons.jsx` — new: `sparkle send shield shieldOff cloudOff moon`.

## Class map

`.insp-tabs/.insp-tab/.insp-pane/.insp-embed` (slot) · `.ai-panel` ·
`.ai-offline` · `.ai-convtabs/.ai-convtab` · `.ai-convhead` ·
`.ai-convlist/.ai-convrow/.ai-newconv` · `.ai-drawer(-scrim/-head)` ·
`.ai-thread` · `.ai-msg-you/.bubble/.ai-receipt(-chips)` ·
`.ai-msg-ai/.ai-msg-head/.ai-msg-body/.ai-h/.ai-q/.ai-edit/.ai-note/.ai-cursor/.ai-msg-acts` ·
`.ai-divider` · `.ai-empty/.ai-verbgrid/.ai-verbcard/.ai-starters` ·
`.ai-dormant` · `.ai-foot/.ai-ctx-label/.ai-chips/.ai-chip(--scene/--sel/--ghost/--more)` ·
`.ai-costcue` · `.ai-composer/.ai-input/.ai-verbchip/.ai-verbpop/.ai-send/.ai-stop/.ai-kbd` ·
`.ai-meter(-row/-track/-fill)` · `.ai-guard` · `.ai-askpill` ·
`.ai-consent` · `.ai-picker/.ai-sec-label/.ai-about-*/.ai-scenetree/.ai-scenerow/.ai-check/.ai-entgrid/.ai-entrow/.ai-boundary/.ai-picker-foot` ·
`.ai-privacy` (Settings).

All token-driven; dark theme and the Settings accent come for free. **Capture
gotchas honored:** no `both`-fill entrance animations on critical surfaces, no
transition on state-swapped dot colors (headless captures freeze them).

## Tweaks (for review)

Assistant enabled · Conversations (tabs/list/drawer/stream) · Credits
(plenty/low/empty) · Plan (active/expired/key) · Offline · Ask pill on
selection · Ask in right-click menu · Replay first-run walkthrough.

## Deferred follow-ups

- **Style sample** (user-chosen paragraph as register reference) and **author
  preferences** (UK/US, profanity tolerance) — unratified v2 candidates; the
  About card's free-form notes covers the urgent cases.
- **Chapter-so-far rolling summaries** as cheap whole-manuscript context —
  interacts with the count_tokens estimate UX; design when wave 35 lands it.
- `exclude_from_ai` surfaced on the Full Entry (a shield row in the rail).
- Conversation rename (titles auto-derive from the first ask for now) and
  cross-scene "continue this conversation here" affordances.
- Consent copy legal pass; localized pricing.

## Changelog

- **Jun 2026 — conversation anatomy decided: LIST.** Owner reviewed all four
  anatomies and picked the list ("tabs are a bit too much"). `aiLayout` default
  flipped to `list`; production should port the list anatomy only (the other
  three remain in the prototype for reference). Handoff package for the
  terminal agent: `assistant-handoff/` at the project root.
- **Jun 2026 — initial canon build** (this document): everything above; four
  conversation anatomies; spoiler boundary added beyond the brief; editor
  selection pill + opt-in right-click items; Settings/About copy updated from
  "No built-in AI" to "AI only if you ask for it".
