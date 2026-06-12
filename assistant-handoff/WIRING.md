# Assistant — wiring reference (how the prototype integrates)

How the four `design/` modules hook into the host app in the design prototype.
Production equivalents differ (TSX, stores, no window globals) — use this as
the integration shape, not literal code. Line references are to the design
workspace (`writing-app-design/`), current as of Jun 2026.

## 1 · Inspector slot swap (`shell.jsx`)

The right panel becomes `InspectorTabs` when the assistant is enabled, with
both panes kept mounted (hidden via `[hidden]`) so drafts and streams survive
tab switches:

```jsx
{!focus && view === "write" && scene && (() => {
  const inspectorNode = <Inspector embed={aiOn} ...existingProps />;
  if (!aiOn) return inspectorNode;                 // zero AI chrome when off
  return (
    <InspectorTabs tab={inspTab} setTab={setInspTab}
      scenePane={inspectorNode}
      assistantPane={<AssistantPanel
        t={t} scene={openScene} tree={tree}
        convos={ai.convos} setConvos={ai.setConvos}
        activeId={ai.activeId} setActiveId={ai.setActiveId}
        about={ai.about} aiCtx={ai.ctx} never={ai.never}
        used={ai.used} setUsed={ai.setUsed} sel={sel}
        pendingAsk={pendingAsk} clearPendingAsk={() => setPendingAsk(null)}
        onOpenConsent={() => setOverlay("aiconsent")}
        onOpenContext={() => setOverlay("aicontext")}
        onToast={(label) => setToast({ label })}
        onSaveNote={(body) => actions.saveNote(body)} />} />
  );
})()}
```

`Inspector` gained an `embed` prop: when true it renders its scroll body inside
`.insp-embed` instead of its own `.panel-inspector` wrapper (one-line change).

## 2 · Editor → panel asks (`shell.jsx`)

```jsx
const [inspTab, setInspTab] = React.useState("scene");
const [pendingAsk, setPendingAsk] = React.useState(null);
const sel = useProseSelection();                       // live editor selection
const askFromEditor = (verb, snap) => { setInspTab("assistant"); setPendingAsk({ verb, sel: snap }); };
```

- **Pill** (default on): `{aiReady && t.aiSelPill !== false && !focus && view === "write" && sel
  && <AiAskPill sel={sel} onAsk={(snap) => askFromEditor("brainstorm", snap)} />}`
- **Right-click** (default off): a `contextmenu` handler on the editor stage —
  bail unless the selection anchors inside `.prose`; menu items label
  `Selection · N words`, then *Brainstorm from this / Critique this passage /
  Proofread this passage*, each calling `askFromEditor(verb, snap)`.

The panel consumes `pendingAsk` by setting the verb + attaching the selection
chip, then clears it. (Prototype does this in a `useEffect` — production must
restructure per the no-setState-in-useEffect rule; see HANDOFF Phase 3.)

## 3 · App-level state (`app.jsx`)

```jsx
const [aiConvos, setAiConvos] = React.useState(AI_SEED_CONVOS);   // → conversationStore
const [aiActive, setAiActive] = React.useState(firstId);
const [aiAbout, setAiAbout] = React.useState(AI_SEED_ABOUT);      // → manuscript_about
const [aiNever, setAiNever] = React.useState([]);                 // → entities.exclude_from_ai
const [aiUsed, setAiUsed] = React.useState(0);                    // → real credit balance
const [aiCtxState, setAiCtxState] = React.useState({
  extraSceneIds: [], offEntities: [], about: true, boundary: null,
});
```

Settings/feature flags (prototype Tweaks → production settings store):
`aiOn` (false by default in prod!) · `aiConsented` · `aiLayout:"list"` (hard-code) ·
`aiPlan` · `aiSelPill:true` · `aiSelMenu:false`. `aiCredits`/`aiOffline` are
design-review knobs only — real states come from the proxy and the network.

## 4 · Overlays (`shell.jsx`)

```jsx
{overlay === "aiconsent" && <AiConsent onClose={...}
  onEnable={() => { /* persist consent + enabled, open Assistant tab, toast:
    "The assistant is on — it sees only what's in the chips" */ }} />}
{overlay === "aicontext" && <AiContextPicker tree={tree} scene={openScene}
  chars={chars} locs={locs} aiCtx={ai.ctx} setAiCtx={ai.setCtx}
  never={ai.never} toggleNever={ai.toggleNever}
  about={ai.about} setAbout={ai.setAbout} onClose={...} />}
```

Both use the app's standard `.scrim` + `.sheet` shell.

## 5 · Settings section (`settings.jsx`)

Nav: `{ id: "assistant", label: "Assistant", icon: "sparkle" }` (between
Writing and Backup & data). Rows: Enable (desc: "Off removes every trace of AI
from the app — no tab, no chips, nothing.") · Plan segmented
Subscription/My own key (+ password-style key field when byok, "Stored on this
machine only — never synced, never sent to us.") · the two selection toggles ·
"First-run walkthrough · Show again". Closing privacy block:

> **Every byte that leaves this machine is visible and intentional.** Requests
> send only what's in the "What I can see" chips. Nothing is stored, logged, or
> used for training — by us or by the model provider. When the allowance runs
> out the assistant stops; it never bills you by surprise.

The About screen line changed from "No built-in AI, by design." to
"AI only if you ask for it — the assistant is opt-in, visible about what it
sees, and fully removable."

## 6 · New icons (`icons.jsx` — 24-box, 1.6 stroke, currentColor)

```
sparkle   <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>
send      <path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>
shield    <path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10z"/>
shieldOff <path d="M19.7 14c.2-.64.3-1.31.3-2V5l-8-3-3.2 1.2"/><path d="M4.5 4.9 4 5v7c0 6.4 8 10 8 10a20.3 20.3 0 0 0 5.6-3.5"/><line x1="2" y1="2" x2="22" y2="22"/>
cloudOff  <path d="M22.61 16.95A4.5 4.5 0 0 0 18 11h-1.26a8 8 0 0 0-7.05-6"/><path d="M5 5a8 8 0 0 0 4 15h9a4.5 4.5 0 0 0 1.33-.2"/><line x1="2" y1="2" x2="22" y2="22"/>
moon      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
```

Verb icons reuse existing glyphs: brainstorm `zap` · critique `target` ·
beta read `book` · proofread `check`.

## 7 · Render-environment gotchas (carried into the CSS)

- No `both`-fill entrance animations on critical surfaces (headless captures —
  and some throttled tabs — freeze keyframes at frame 0). Base states are
  visible; animations only embellish.
- No CSS transition on state-swapped colors that must read correctly in a
  frozen frame (the consent step dots learned this the hard way).
- `.ai-thread` is `overflow-x: hidden`; the meter row and section labels are
  `white-space: nowrap` — the panel is 296px, treat every new label as a
  wrap hazard.
