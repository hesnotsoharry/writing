# Assistant — production handoff (waves 35–36)

**Audience:** the terminal/eng agent porting the AI Assistant from this design
package into the production WritersNook app (Tauri + React + local SQLite).
**Design canon:** the runnable prototype in the design workspace
(`writing-app-design/index.html`, Assistant tab) — this folder is a frozen copy
of its assistant modules plus everything you need to port without the workspace.

## Read order

1. This file (plan, schema, contracts, constraints).
2. `ASSISTANT-SPEC.md` (the design rationale, anatomy, class map, deferred list).
3. `design/*` (the four modules — your visual + behavioral source of truth).
4. `WIRING.md` (how the prototype integrates: slot swap, state, settings, icons).

## What already exists in production (wave 34 — build on it, don't duplicate)

- `ai.client.ts` — session exchange + normalized SSE consumer. Keep as-is.
- `ai.context.ts` — scene excerpt + entity summaries with caps. **Extend** (see Phase 4).
- `prompts/brainstorm.ts` — system template + `BRAINSTORM_MAX_TOKENS`. **Revise** (Phase 5).
- `AssistantPanel.tsx` + `InspectorTabShell` + `.ai-*` styles — **replace** with
  this design (the dev license-key field dies; session acquisition moves behind
  the plan state).

## Locked decisions (do not re-open)

| Decision | Answer |
|---|---|
| Conversation anatomy | **List** (back-chevron header ⇄ conversation rows). Tabs/drawer/stream were explored and rejected — do not port them. |
| Conversation scope | Manuscript-level objects, not per-scene. |
| Verbs | brainstorm · critique · beta-read · proofread, each with a fixed output shape (Phase 5). |
| Context strip | Pinned between thread and composer; chips are a literal inventory (D4). |
| Credits UI | A meter with status words only — no token numbers anywhere. Hard stop at zero. |
| Guardrails | Replace the composer only; history always stays readable. |
| Consent | 3-step walkthrough gates first use; "Assistant enabled" off removes ALL AI chrome including the tab. |
| Selection asks | Floating pill default ON; right-click menu items default OFF (both are Settings toggles). |
| Pricing copy | $14.99/mo subscription + bring-your-own-key tier. |

## Mock → real map

| In `design/` (mock) | In production |
|---|---|
| `AI_SEED_CONVOS`, `aiFakeReply`, `aiStream` | `conversationStore` over SQLite + real `streamChat` via `ai.client.ts` |
| `AI_CREDIT_BASE` + `aiUsed` (% math) | Credit balance from the proxy (`done` events / a balance endpoint), mapped to status words |
| `aiEstimate` (words/4000 ⇒ % of month) | Real estimate: count_tokens (or chars/4 heuristic) over assembled context + messages, against the plan allowance |
| `AI_SEED_ABOUT` | `manuscript_about` row (Phase 1) |
| Tweaks (`aiCredits/aiPlan/aiOffline/aiLayout`) | Real states: proxy responses, subscription status, `navigator.onLine` + fetch failures. `aiLayout` dies — list only. |
| `aiNever` (names, in-memory) | `entities.exclude_from_ai` flag (ids, persisted) |
| Reply texts grounded in "The Salt Year" | The model, obviously |

## Phased plan

### Phase 1 — schema (one migration)

```sql
CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,                -- auto: first ask, 36 chars + ellipsis
  last_verb TEXT,                     -- brainstorm|critique|betaread|proofread
  boundary_chapter_id TEXT,           -- spoiler boundary, nullable
  context_config TEXT,                -- JSON: { extraSceneIds:[], offEntityIds:[], about:bool }
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE ai_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('you','ai')),
  verb TEXT NOT NULL,
  body TEXT NOT NULL,                 -- TEXT, per the base64/TEXT persistence rule
  context_json TEXT,                  -- snapshot of chips at send time (you-messages only)
  credits_cost INTEGER,               -- from the done event (ai-messages only)
  created_at INTEGER NOT NULL
);
ALTER TABLE entities ADD COLUMN exclude_from_ai INTEGER NOT NULL DEFAULT 0;
-- About-this-manuscript: synopsis/genre/tone/pov/notes — columns on projects
-- or a 1:1 manuscript_about table; either is fine, it's five text fields.
```

`context_json` shape (mirrors the prototype receipt):
`{ sceneId, sceneTitle, sceneWords, entityNames:[], extraSceneTitles:[], selWords:null|n, about:bool, boundaryChapterId:null|id, boundaryLabel:null|str }`

### Phase 2 — styles

Port `design/assistant.css` near-verbatim into the app stylesheet (it is 100%
token-driven; light/dark and the accent re-tint come for free). Drop the
sections you won't ship: `.ai-convtabs`, `.ai-drawer*`, `.ai-divider`
(tabs/drawer/stream). Keep `.insp-tabs/.insp-pane/.insp-embed` — they replace
the wave-34 `.ai-tab-*` rules.

### Phase 3 — components (TSX)

Convert `design/assistant.jsx` + `design/assistant-overlays.jsx`. Swap `window`
globals for imports. Components to keep: `InspectorTabs` (replaces
`InspectorTabShell`), `AssistantPanel` (list paths only — delete the
`layout === "tabs"/"drawer"/"stream"` branches), `AiBody`, `AiReceipt`,
`AiMessage`, `AiEmptyState`, `AiDormant`, `AiConvoList`, `AiMeter`,
`useProseSelection`, `AiAskPill`, `AiConsent`, `AiContextPicker`, `AiAboutCard`.

⚠️ **Constraint fixes required during conversion** (the prototype bends two
production rules):
- `AssistantPanel`'s `pendingAsk` effect calls `setVerb`/`setAttachedSel` inside
  `useEffect`. Restructure: handle the pending ask at the event site (the pill /
  menu handler can write verb + selection into the same store the panel reads)
  or key-remount the composer.
- The autoscroll effect mutates DOM (`scrollTop`) — that's fine (no setState),
  keep it.
- No `any`; type the verb union, message, conversation, and context-snapshot
  shapes from the schema above.

### Phase 4 — context assembly (`ai.context.ts`)

Extend `assembleBrainstormContext` → `assembleContext(verb, cfg)`:
- multiple scenes (open scene always + `extraSceneIds`), per-scene char caps;
- filter entities by `exclude_from_ai` AND per-ask `offEntityIds`;
- include About fields when `cfg.about`;
- include selection text when attached (cap it too);
- spoiler boundary: include a system-prompt line *"Behave as if you have not
  read past {chapter}; do not reference events beyond it."* and exclude
  later-chapter scenes from any future whole-manuscript context;
- **D4:** anything this function sends MUST be representable as a chip. If you
  add an input, add its chip + receipt entry in the same PR.

### Phase 5 — verb templates (`prompts/*.ts`) — the "harness pass"

One file per verb, exporting `buildMessages(ctx, ask, history)` + `MAX_TOKENS`.
Shared skeleton: role line → grounding rules → About block → context sections →
response-format discipline. Output contracts the client renders:
- **brainstorm** (1024 tok): 2–4 short paragraphs; bullets allowed, `**bold**` lead-ins.
- **critique** (1024 tok): exactly three `### ` sections — `What's working`,
  `Questions to sit with`, `If I pushed on one thing`.
- **beta read** (1024 tok): first-person reader; may quote lines with `> `.
- **proofread** (1536 tok): only `EDIT|<from>|<to>|<why>` and `NOTE|<text>`
  lines after an optional one-line preamble. Never stylistic edits. Render via
  the `AiBody` parser; deliver as a block (no token-streaming UI for this verb).
Multi-turn: pass the conversation's prior messages; the reserve estimate must
track the full messages array + system (post-9343691 behavior).

### Phase 6 — stores + panel wiring

`conversationStore`: list/create/delete/appendMessage/updateTitle; title
auto-derives from the first ask. Send flow = snapshot chips → insert you-message
→ stream into an ai-message → write `credits_cost` on done. Streaming message
lives in component state; persist on completion (don't write per token).

### Phase 7 — billing + guardrail states

Map proxy credit state → meter status words: ≥55% used "About half left",
≥80% "Running low" (warn), 100% "Used up" (danger) + composer replaced by the
allowance card. Plan states: active / expired (renew card) / byok (no meter,
"Using your own API key"). Offline: `navigator.onLine` + a failed fetch both
flip the banner; queue nothing — asks simply wait for the writer. Cost cue:
show only when one ask ≥2% of the monthly allowance.

### Phase 8 — consent + settings + removal

Persisted flags: `ai_enabled` (default OFF in production — dormant until opted
in) and `ai_consented`. The Assistant tab exists only when enabled; consent
walkthrough (copy below) gates the first real use. Settings → Assistant section
per `WIRING.md`. When disabled: no tab, no pill, no menu items, no settings
remnants beyond the enable row itself.

### Phase 9 — selection affordances

`useProseSelection` listens to `selectionchange`, scoped to the editor surface
(min 3 words). Pill (default on) renders fixed above the selection; right-click
items (default off) join the existing editor context menu under a
"Selection · N words" label. Both attach a selection snapshot + switch to the
Assistant tab.

## Copy inventory (port verbatim — this wording was reviewed)

- Dormant: **"The assistant is asleep"** / "Brainstorm, critique, beta-read and
  proofread — grounded in your manuscript. Nothing leaves your machine until
  you turn it on." / button "See how it works".
- Consent steps: **"A collaborator in the margins"** · **"You can always see
  what it sees"** · **"A meter, not a bill"** (full copy in
  `design/assistant-overlays.jsx`); final button "Turn on the assistant"; fine
  print "$14.99/month, or bring your own API key. Cancel any time — your
  writing never depends on it."
- Offline: "You're offline. The assistant will be here when you're back — your
  writing is never affected."
- Expired: "Your assistant plan has lapsed" / "Old conversations stay readable.
  New asks need an active plan — or your own API key, in Settings."
- Empty: "This month's allowance is used up" / "Resets {date}. The assistant
  stops here rather than running up a bill — top up only if you want more now."
  Buttons: "Top up" / "Wait for {month}".
- Meter words: "Plenty left this month" / "About half left" / "Running low" /
  "Used up" + "Resets {date}".
- Settings privacy block: "Every byte that leaves this machine is visible and
  intentional. …" (full text in `WIRING.md`).

## QA checklist

- [ ] Toggle "Enable the assistant" off → zero AI chrome anywhere (tab, pill,
      menu items, settings rows beyond the toggle).
- [ ] First enable → dormant card → walkthrough → consent persisted; replay
      from Settings works.
- [ ] Send in each verb; critique renders three sections; proofread renders
      edit rows + notes, arrives as a block.
- [ ] Receipt on every you-message expands to the exact chips that applied —
      including selection word count and boundary.
- [ ] Context picker: open scene locked; entity shield persists across restarts
      (`exclude_from_ai`); estimate moves when scenes toggle.
- [ ] Spoiler boundary line present in the outgoing system prompt.
- [ ] Kill the network mid-stream → graceful stop, offline banner, writing
      unaffected; restore → composer back, history intact.
- [ ] Drain allowance → composer swaps to the allowance card at exactly 100%;
      no surprise request goes out.
- [ ] BYOK plan → no meter, no allowance card, key stored locally only.
- [ ] Dark theme + each accent: panel, picker, consent all re-tint (token check).
- [ ] Esc closes overlays; ⌘↵ sends; Stop aborts (AbortController).

## Deferred (designed but not in this wave — see spec)

Style sample · author preferences · chapter-so-far rolling summaries ·
`exclude_from_ai` shield on the Full Entry rail · conversation rename ·
top-up checkout flow (marketing site owns purchase; `WN_TODO_*` pattern).

---

*Update this file's status line and the spec changelog when the port lands —
the design workspace README expects a "what changed" note.*
