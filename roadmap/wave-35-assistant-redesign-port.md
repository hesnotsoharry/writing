---
status: IN-PROGRESS
created: 2026-06-12
---

# Wave 35 — Assistant redesign port

## Plan

### Status

DRAFT · target v0.7.0 · drafted 2026-06-12.

### Goal

The Assistant panel is replaced by the design-canon redesign from `assistant-handoff/`: conversations are persisted manuscript-level objects in SQLite (list UI with back-chevron header), four verbs (brainstorm · critique · beta-read · proofread) each with a fixed output shape rendered by the panel, an "About this manuscript" card whose fields ride along in every system prompt, a context picker with extra scenes / per-entity shields (`exclude_from_ai`) / spoiler boundary, selection affordances (floating ask-pill + right-click menu items), a status-words-only credit meter with guardrail states, and a 3-step consent walkthrough gating first use — with the wave-34 billing polish (cost math, reset-date drift, superseded Supabase function) folded in. The dev license-key field dies; "Assistant enabled" off removes all AI chrome.

### Scope

**In scope:**

- SQLite migrations 16–17 (`src/db/migrations2.ts`): `ai_conversations` + `ai_messages` tables, `entities.exclude_from_ai` column (via `ensureColumn`), `manuscript_about` 1:1 table — schema verbatim from `assistant-handoff/HANDOFF.md` Phase 1.
- 6 new icons (sparkle, send, shield, shieldOff, cloudOff, moon — SVG paths in `WIRING.md:111-118`) + port of `design/assistant.css` into `src/styles/app.css`, canonizing the design's class vocabulary (`.insp-*`, full `.ai-*` map) and deleting production's `.ai-tab-*` rules.
- TSX port of `design/assistant.jsx` + `assistant-overlays.jsx` (list paths only — tabs/drawer/stream branches deleted), replacing `AssistantPanel.tsx` internals + `InspectorTabShell` + `ConsentWalkthrough.tsx`; both setState-in-effect instances (`pendingAsk`, `AiAboutCard` draft sync) restructured per project lint.
- `conversationStore` over SQLite (list/create/delete/appendMessage/auto-title; explicit child-row delete, not relying on FK cascade) wired to real `streamChat`; persist streamed message on completion only.
- `ai.context.ts` → `assembleContext(verb, cfg)`: multi-scene, About fields, selection text, `exclude_from_ai` + per-ask off-entities, spoiler-boundary system line; D4 rule — every input representable as a chip + receipt entry in the same PR.
- Verb templates `src/features/ai/prompts/{brainstorm,critique,betaread,proofread}.ts` — shared skeleton, per-verb output contracts + `MAX_TOKENS`, multi-turn history pass-through (the discovery doc's "harness pass").
- Billing/guardrail states: meter status words, allowance card at 100%, plan active/expired states, offline banner, ≥2% cost cue; plus wave-34 polish: `marketing/functions/api/ai/chat.ts` cost math → `CREDIT_UNIT_USD`, Supabase migration dropping superseded `decrement_credits`, `reset_at` drift (prefer LS `renews_at`), blank reset-date in first-month 429 body.
- Consent + settings + removal: 3-step walkthrough modal (verbatim copy from `assistant-overlays.jsx`), Settings → Assistant section per `WIRING.md:93-106` (enable toggle, selection toggles `aiSelPill`/`aiSelMenu`, walkthrough replay, privacy block), `ai_enabled` default OFF, zero AI chrome when disabled; panel reacts to Settings-side changes live (fixes the wave-34 next-mount-only bug).
- Selection affordances: `useProseSelection` (ProseMirror-native selection read via editor `selectionUpdate`, min 3 words), `AiAskPill`, right-click items added to `buildEditorContextMenu` gated on `aiEnabled && aiSelMenu`.

**Out of scope:**

- Marketing site AI/pricing pages ($14.99 card, AI feature copy) — **wave 36** (pricing page currently has zero AI mention; ships together with live-mode LS swap).
- BYOK (bring-your-own-Anthropic-key) plumbing — **wave 36, pending the user lock below**; wave 35 ships subscription plan-state only, Settings plan row lands with the BYOK segment when the plumbing exists.
- Launch checklist (live LS variant IDs, live webhook, Resend wiring) — wave 36, per HANDOFF next-steps.
- Design-spec deferred list: style sample, author preferences, chapter-so-far rolling summaries, `exclude_from_ai` shield on the Full Entry rail, conversation rename, top-up checkout flow — future waves (tracked in `ASSISTANT-SPEC.md` deferred section).
- Tabs/drawer/stream conversation layouts — rejected in the design workspace; do not port (locked).
- Phase-2 product deferrals unchanged: board side-panel features, live sync, mobile.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| A | Schema migrations 16–17 + Supabase 0004 | sonnet-implementer | honeycomb · cross-boundary (persistent storage) · `reviewTier: panel`. Migrations 16 (`ai_conversations`/`ai_messages` + `exclude_from_ai`) and 17 (`manuscript_about`), idempotent per house pattern; Supabase 0004 drops `decrement_credits`. Orchestrator authors failing migration acceptance test BEFORE dispatch. Run FULL test suite (prior-migration tests break on appended migrations — known gotcha). | Internal — no observation point |
| B | Icons + stylesheet port | haiku-implementer | trophy · internal-only · `reviewTier: skip` + smoke. 6 new icons from WIRING.md SVG paths; Settings nav AI icon feather→sparkle; port `assistant.css` minus `.ai-convtabs`/`.ai-drawer*`/`.ai-divider`; delete `.ai-tab-*` rules (class-canon decision D2). | Settings nav renders the sparkle icon next to "AI" in the live app; no unstyled regression on the existing panel |
| C | Component port (TSX) | sonnet-implementer | trophy · internal-only · `reviewTier: single` + smoke. Port `assistant.jsx`+`assistant-overlays.jsx` list-paths-only to typed TSX; fix both setState-in-effect instances (pendingAsk → event-site store write; AiAboutCard → key-remount); wire to existing wave-34 data paths (single transient convo) so the panel is live before the store lands. Dispatch sonnet-phase-scout first — 3+ separable slices likely. | Assistant tab in the live app renders the redesigned panel — composer, verb chip, meter, context strip, dormant card — and a brainstorm ask streams a reply into the new thread UI |
| D | conversationStore + persistence wiring | sonnet-implementer | honeycomb · cross-boundary (persistent storage) · `reviewTier: panel`. Store list/create/delete/appendMessage/auto-title (36-char first ask); send flow snapshot-chips → you-message insert → stream → persist on done with `credits_cost`; explicit message deletes. Orchestrator authors failing store acceptance test BEFORE dispatch. | Conversation list shows prior conversations after a full app restart; back-chevron returns from a thread to the list; deleting a conversation removes it and its messages |
| E | Context assembly v2 | sonnet-implementer | honeycomb · cross-boundary (feeds the proxy request) · `reviewTier: single`. `assembleContext(verb, cfg)` per HANDOFF Phase 4: multi-scene caps, About block, selection, shields, boundary line; chars/4 heuristic estimate (decision D5); D4 chip-parity rule enforced in review. Orchestrator authors failing assembly acceptance test BEFORE dispatch. | The receipt on a sent message expands to the exact chips that applied — About, extra scene titles, selection word count, boundary label — and a shielded entity never appears in the receipt |
| F | Verb templates (harness pass) | sonnet-implementer | pyramid · internal-only · `reviewTier: single`. Four `prompts/*.ts` files exporting `buildMessages(ctx, ask, history)` + `MAX_TOKENS`; output contracts per HANDOFF Phase 5 (critique = exactly three `###` sections; proofread = `EDIT\|`/`NOTE\|` lines, delivered as a block); multi-turn history included in reserve estimate. | In the live panel, a critique reply renders exactly three headed sections and a proofread reply renders edit rows + notes arriving as a block, not a token stream |
| G | Billing + guardrail states + wave-34 billing polish | sonnet-implementer | trophy · cross-boundary (proxy contract) · `reviewTier: single` + smoke. Meter status words (55/80/100% thresholds), allowance card replaces composer at 100%, expired/renew card, offline banner (navigator.onLine + failed fetch), ≥2% cost cue; `chat.ts` cost math → `CREDIT_UNIT_USD`; `reset_at` prefers LS `renews_at`; first-month 429 body gets a real reset date. | Draining the allowance in the live panel swaps the composer for the "used up" card with a real reset date; killing the network mid-stream shows the offline banner and history stays readable |
| H | Consent + settings + removal | sonnet-implementer | trophy · internal-only · `reviewTier: single` + smoke. 3-step walkthrough modal (verbatim copy), Settings Assistant section per WIRING.md (enable, selection toggles, replay, privacy block), `ai_enabled` default OFF, tweaks-store extension (`aiSelPill`/`aiSelMenu`), live reaction to Settings changes (no next-mount lag). | Toggling "Enable the assistant" off in Settings removes the Assistant tab, pill, and menu items everywhere instantly; first enable shows the dormant "asleep" card, and "See how it works" runs the 3-step walkthrough ending in "Turn on the assistant" |
| I | Selection affordances | sonnet-implementer | trophy · internal-only · `reviewTier: single` + smoke. `useProseSelection` on editor `selectionUpdate` (ProseMirror-native read, `coordsAtPos` for pill position, min 3 words), `AiAskPill` (default on), right-click items in `buildEditorContextMenu` (default off); both attach selection snapshot + switch to Assistant tab. | Selecting 3+ words in the editor floats the ask-pill above the selection; clicking it switches to the Assistant tab with a "Selection · N words" chip attached to the composer |

Wave verification strategy (declared once, per Site 4): every UI phase (B, C, G, H, I — and D/E/F via their panel-visible effects) is smoked agent-side via the dev app's CDP port 9222 + tauri-devtools MCP (`smoke: true` in the run-phase brief); dnd is not involved this wave, so CDP covers the full surface. The first UI-phase smoke doubles as the capability probe.

### Acceptance criteria

- [ ] Migration 16 creates `ai_conversations` + `ai_messages` with the exact columns in `assistant-handoff/HANDOFF.md` Phase 1, and `entities.exclude_from_ai` exists with default 0; migration 17 creates `manuscript_about`; `npm run test` passes the FULL suite (including prior-migration tests).
- [ ] Supabase migration 0004 exists and drops `decrement_credits`; `chat.ts` cost computation references `CREDIT_UNIT_USD` (no inline magic number).
- [ ] `grep -r "ai-tab-" src/` returns zero hits; `grep -r "icon.*sparkle"` (or equivalent icon-registry check) shows all 6 new icons registered.
- [ ] `AssistantPanel` contains no `layout === "tabs"`, `"drawer"`, or `"stream"` branch; no `any` in the ported AI files (`npm run lint` green).
- [ ] `DEV_LICENSE_KEY` and the dev key-entry field are gone from `src/features/ai/`.
- [ ] Conversations survive app restart: create → quit → relaunch → list shows it (CDP smoke evidence in phase D status row).
- [ ] Each verb sends and renders its contract: critique = three `###` sections; proofread = `EDIT|`/`NOTE|` rows as a block; brainstorm/beta-read stream normally (CDP smoke evidence).
- [ ] Receipt JSON snapshot (`context_json`) on a you-message matches the chips displayed at send time, including selection word count and boundary label.
- [ ] Outgoing system prompt contains the spoiler-boundary line when a boundary is set (assert in the assembly acceptance test).
- [ ] With `exclude_from_ai = 1` on an entity, its name/notes appear in no assembled context (assert in the assembly acceptance test) and it renders shielded in the picker.
- [ ] `ai_enabled` off → `grep`-level check + CDP smoke: no Assistant tab, no pill, no context-menu AI items, Settings shows only the enable row.
- [ ] Meter shows status words only — no token or credit numbers anywhere in the panel DOM.
- [ ] 429 body in the first month carries a non-blank reset date; panel "Resets {date}" renders it.
- [ ] Esc closes overlays; ⌘/Ctrl+↵ sends; Stop aborts the stream (AbortController) — CDP smoke.
- [ ] Dark theme + accent re-tint: panel, picker, consent all token-driven (CDP screenshot in both themes).

### Files the next agent should read first

1. `roadmap/wave-35-DRAFT-research.md` — current external API/contract specs (TipTap selection, count_tokens, tauri-plugin-sql migration gotchas — note the FK-cascade pragma finding).
2. `assistant-handoff/HANDOFF.md` — the port plan, mock→real map, verbatim copy inventory, QA checklist. The design package is canon.
3. `assistant-handoff/ASSISTANT-SPEC.md` + `assistant-handoff/WIRING.md` — anatomy/class map; slot swap, settings wiring, icon SVGs, animation gotchas.
4. `assistant-handoff/design/assistant.jsx` + `assistant-overlays.jsx` + `assistant.css` + `assistant-data.jsx` — visual + behavioral source of truth (mock data file shows the shapes).
5. `## Locked decisions` section of this wave file — imported design decisions + wave-level picks.
6. `src/features/ai/AssistantPanel.tsx` + `AssistantPanel.brainstorm.tsx` — what's being replaced; `wrapInspectorSlot` is the production glue point.
7. `src/features/ai/ai.client.ts` — kept as-is; the streaming/session contract everything wires into.
8. `src/features/ai/ai.context.ts` + `src/features/ai/prompts/brainstorm.ts` — the extension baselines for phases E and F.
9. `src/db/migrations2.ts` — migration pattern (idempotent `up`, `ensureColumn`, registration array; latest = 15 "boards").
10. `src/features/settings/Settings.sections.tsx` (AiSection, line ~278) + `src/features/settings/settings.store.ts` — settings integration points; tweaks type needs `aiSelPill`/`aiSelMenu`.
11. `src/editor/EditorContextMenu.tsx` + `src/editor/Editor.tsx` — existing right-click wiring phase I extends.
12. `.claude/vendor-gotchas/tauri.md` — before touching capabilities or anything title-bar adjacent.

### Note to the implementer

This wave is a **port, not a redesign** — the design package is canon and its locked-decisions table is closed (list UI won; tabs/drawer/stream are dead branches, delete them on sight). Resist: improving the design's copy (it was reviewed — port verbatim), collapsing the per-verb prompt files into one clever abstraction (one file per verb is deliberate), touching the marketing site (wave 36), and building BYOK plumbing (wave 36, pending lock). The prototype bends two production rules (setState-in-effect ×2) — fix them per the phase C brief, don't import them. Editor work must be ProseMirror-native; jsdom is not an oracle for editor behavior — CDP smoke is. First step: verify the `## Locked decisions` section below has decisions filled in, including the two REQUIRES USER LOCK items resolved.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

> Decisions are NOT appended here freely. Per the decision-review cell (`~/.claude/rules/best-practice-spectrum.md`, M-42 P2): a non-trivial decision must run `sonnet-architect` → `sonnet-adversarial-reviewer` (`Posture: attack-decision`) → orchestrator adjudication BEFORE it is written into `## Locked decisions`. The `adversarial_review_enforce.mjs` hook denies the wave-file edit if the cell has not fired; genuinely trivial decisions skip via the `review-tier-{session_id}.json` sidecar.

### Decision 0: Design-package decisions imported (Cole-ratified in the design workspace — do not re-open)

**Context:** `assistant-handoff/HANDOFF.md` carries a locked table: conversation **list** anatomy (tabs/drawer/stream rejected), manuscript-level conversation scope, four verbs with fixed output shapes, pinned context strip with literal-inventory chips, status-words-only meter with hard stop, guardrails replace composer only, consent walkthrough + full chrome removal, pill default ON / menu default OFF, $14.99 + BYOK pricing copy.
**Pick:** Adopt wholesale as wave canon.  **Rationale:** These were explored and ratified in the design workspace; re-litigating them is the failure mode the handoff explicitly forbids.  **Enforcement:** phase briefs cite the table; adversarial reviewers attack divergence from it.

### Decision 1: `manuscript_about` as a 1:1 table, not columns on `projects`

**Context:** Spec allows either. **Pick:** Separate `manuscript_about(project_id PK REFERENCES projects, synopsis, genre, tone, pov, notes)`.  **Rationale:** Keeps AI-scoped data out of the hot `projects` row touched by many non-AI code paths, and matches the removability ethos (AI data cohesive and droppable). Single-row read, no meaningful join cost.  **Enforcement:** migration 17 + phase A acceptance test.

### Decision 2: CSS class canon = the design package's vocabulary

**Context:** Production tab shell uses `.ai-tab-*`; the design uses `.insp-tabs/.insp-pane/.insp-embed` + the full `.ai-*` map — mixing them breaks rendering (explorer risk F1). **Pick:** Design vocabulary wins; `.ai-tab-*` rules and class references deleted in phase B/C.  **Rationale:** The design CSS is the artifact being ported near-verbatim; translating it to legacy names invites drift.  **Enforcement:** acceptance criterion (`grep "ai-tab-"` = 0) + phase B brief.

### Decision 3: Token estimate = chars/4 heuristic locally; exact cost from `done` events

**Context:** The composer estimate must update live; Anthropic `count_tokens` is free but sits behind the proxy (the client holds no API key), so live per-keystroke counting would be a chatty proxy round-trip. **Pick:** chars/4 heuristic over assembled context + messages for the live estimate; authoritative cost recorded from the stream's `done` event.  **Rationale:** Matches the handoff's sanctioned fallback; zero network; the meter is status-words anyway so ±10% estimate error is invisible.  **Enforcement:** phase E/G briefs; no `count_tokens` proxy endpoint added this wave.

### Decision 4: Don't rely on SQLite FK cascade for message deletes

**Context:** Research found `ON DELETE CASCADE` requires `PRAGMA foreign_keys=ON`, which tauri-plugin-sql does not guarantee per-connection. **Pick:** Keep the FK declaration in the schema, but `conversationStore.delete` explicitly deletes child `ai_messages` rows in the same operation.  **Rationale:** Correct under either pragma state; no orphan rows if the pragma is ever off.  **Enforcement:** phase D acceptance test asserts zero orphan messages after delete.

### Decision 5: Wave 35/36 split (LOCKED by Cole, 2026-06-12 — as recommended)

**Context:** The design handoff targets "waves 35–36"; HANDOFF.md also queues marketing AI/pricing pages + the launch checklist. **Recommendation (industry-standard):** wave 35 = the full assistant port (phases A–I above); wave 36 = monetization completion — marketing AI/pricing pages, live-mode LS variant IDs + webhook, BYOK plumbing (per Decision 6), Resend seam if needed. Emerging alternative: fold marketing pages into wave 35 as a phase J (keeps copy/price shipping atomically with the feature, but grows an already 9-phase wave and the pages block nothing — the app is the surface). Cutting-edge alternative: split wave 35 itself in two (A–F core / G–I states+affordances) — rejected as the design package is one coherent artifact and a half-ported panel is worse than none.
**Pick:** 35 = port, 36 = monetization completion.  **Enforcement:** scope section above; wave-36 planning input.

### Decision 6: BYOK timing (LOCKED by Cole, 2026-06-12 — as recommended)

**Context:** The ratified consent copy promises "or bring your own API key," and the design's plan states include `byok` (no meter, key local-only) — but production has no BYOK path at all (explorer risk F4): it needs key storage, a second streaming route (direct Anthropic call with the CORS-enabling header, or via the Tauri shell), and an SSE-normalization adapter. **Recommendation:** build BYOK in **wave 36, before real-money launch** — the copy ships in 35 as written (the promise is honored before any paying user sees it, since live LS mode also lands in 36); wave 35's Settings plan row renders subscription-only, and the `byok` plan state lands with its plumbing. Alternative: include BYOK as wave-35 phase J if shipping copy that references a not-yet-real tier for the days between 35 and 36 is unacceptable.
**Pick:** BYOK → wave 36.  **Enforcement:** out-of-scope list above; phases G/H briefs render subscription-only plan state.

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 0 (plan + oracle) | — | 2026-06-12 | e053852 + c6b351a | n/a — oracle confirmed failing 14/14 for "migrations absent" |
| A | 2026-06-12 (run-phase `wf_322c4431-c7c`, panel tier) | 2026-06-12 | (this commit) | Internal — no observation point; oracle 14/14 green, full suite 1308 green, panel PASS (1 FLAG: stale header — fixed by orchestrator) |
| B | 2026-06-12 (run-phase, skip tier + smoke) | — | — | — |

## Follow-up candidates

<!-- DEFAULT: empty. Stage only Tier-3 TRIPLE-gate items with present-harm: pointers. -->

## Result

<!-- Filled at ship by wrap team. -->
