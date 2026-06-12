/* Assistant — the AI panel in the inspector slot (waves 34–36 design canon).
   One verb chip + composer, honest "What I can see" chips, conversations as
   manuscript-level objects (four anatomies via Tweaks: tabs / list / drawer /
   stream), a meter-not-math credit readout, and calm guardrail states.
   Mock streaming via assistant-data.jsx. */

/* ---- Inspector slot wrapper: Scene · Assistant tabs ------------------------ */

function InspectorTabs({ tab, setTab, scenePane, assistantPane }) {
  return (
    <div className="panel-inspector">
      <div className="insp-tabs">
        <div className={"insp-tab" + (tab === "scene" ? " on" : "")} role="button" onClick={() => setTab("scene")}>
          <Icon name="fileText" className="ic" /> Scene
        </div>
        <div className={"insp-tab" + (tab === "assistant" ? " on" : "")} role="button" onClick={() => setTab("assistant")}>
          <Icon name="sparkle" className="ic" /> Assistant
        </div>
      </div>
      <div className="insp-pane" hidden={tab !== "scene"}>{scenePane}</div>
      <div className="insp-pane" hidden={tab !== "assistant"}>{assistantPane}</div>
    </div>
  );
}

/* ---- Live prose selection hook + floating Ask pill -------------------------- */

function useProseSelection() {
  const [sel, setSel] = React.useState(null);
  React.useEffect(() => {
    const read = () => {
      const s = document.getSelection();
      if (!s || s.isCollapsed) { setSel(null); return; }
      const n = s.anchorNode;
      const el = n && (n.nodeType === 3 ? n.parentElement : n);
      if (!el || !el.closest || !el.closest(".prose")) { setSel(null); return; }
      const text = s.toString().trim();
      if (text.split(/\s+/).length < 3) { setSel(null); return; }
      let rect = null;
      try { rect = s.getRangeAt(0).getBoundingClientRect(); } catch (e) {}
      setSel({ text, words: text.split(/\s+/).length, rect });
    };
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, []);
  return sel;
}

function AiAskPill({ sel, onAsk }) {
  if (!sel || !sel.rect) return null;
  const top = Math.max(8, sel.rect.top - 40);
  const left = sel.rect.left + sel.rect.width / 2;
  return (
    <div className="ai-askpill" style={{ top, left }}
      onMouseDown={(e) => { e.preventDefault(); onAsk({ text: sel.text, words: sel.words }); }}>
      <Icon name="sparkle" className="ic" /> Ask the assistant
    </div>
  );
}

/* ---- Reply body renderer (markdown-lite + proofread edit rows) --------------- */

function aiInline(text, key) {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <b key={key + "-" + i}>{p}</b> : p));
}

function AiBody({ text, streaming }) {
  const lines = text.split("\n");
  const out = [];
  let bullets = null;
  const flush = () => { if (bullets) { out.push(<ul key={"ul" + out.length}>{bullets}</ul>); bullets = null; } };
  lines.forEach((ln, i) => {
    if (ln.startsWith("- ")) {
      bullets = bullets || [];
      bullets.push(<li key={i}>{aiInline(ln.slice(2), "l" + i)}</li>);
      return;
    }
    flush();
    if (!ln.trim()) return;
    if (ln.startsWith("### ")) out.push(<div className="ai-h" key={i}>{ln.slice(4)}</div>);
    else if (ln.startsWith("> ")) out.push(<div className="ai-q" key={i}>{ln.slice(2)}</div>);
    else if (ln.startsWith("EDIT|")) {
      const [, from, to, why] = ln.split("|");
      out.push(
        <div className="ai-edit" key={i}>
          <div className="pair"><span className="from">{from}</span><span className="arrow">→</span><span className="to">{to}</span></div>
          {why && <div className="why">{why}</div>}
        </div>
      );
    } else if (ln.startsWith("NOTE|")) {
      out.push(<div className="ai-note" key={i}><Icon name="check" className="ic" />{ln.slice(5)}</div>);
    } else out.push(<p key={i}>{aiInline(ln, "p" + i)}</p>);
  });
  flush();
  return <div className="ai-msg-body">{out}{streaming && <span className="ai-cursor"></span>}</div>;
}

/* ---- Per-message context receipt --------------------------------------------- */

function AiReceipt({ ctx }) {
  const [open, setOpen] = React.useState(false);
  if (!ctx) return null;
  const chips = [];
  if (ctx.scene) chips.push({ cls: "ai-chip--scene", icon: "fileText", label: ctx.scene + (ctx.words ? " · " + ctx.words.toLocaleString() + " words" : "") });
  (ctx.extras || []).forEach((x) => chips.push({ icon: "book", label: x }));
  (ctx.entities || []).forEach((n) => chips.push({ icon: "user", label: n }));
  if (ctx.sel) chips.push({ cls: "ai-chip--sel", icon: "quote", label: "Selection · " + ctx.sel + " words" });
  if (ctx.about) chips.push({ icon: "info", label: "About this manuscript" });
  if (ctx.boundary) chips.push({ icon: "shield", label: "Read up to " + ctx.boundaryLabel });
  const n = chips.length;
  return (
    <div>
      <div className="ai-receipt" onClick={() => setOpen(o => !o)} title="What this message could see">
        {open ? "Saw" : "Saw " + (ctx.scene || "context") + (n > 1 ? " +" + (n - 1) : "")}
      </div>
      {open && (
        <div className="ai-receipt-chips">
          {chips.map((c, i) => (
            <span className={"ai-chip " + (c.cls || "")} key={i}><Icon name={c.icon} className="ic" /><span>{c.label}</span></span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Messages ------------------------------------------------------------------ */

function AiMessage({ msg, onCopy, onSaveNote }) {
  if (msg.role === "you") {
    return (
      <div className="ai-msg-you">
        <div className="bubble">{msg.text}</div>
        <AiReceipt ctx={msg.ctx} />
      </div>
    );
  }
  const verb = AI_VERBS[msg.verb] || AI_VERBS.brainstorm;
  return (
    <div className="ai-msg-ai">
      <div className="ai-msg-head">
        <Icon name="sparkle" className="ic" /> {verb.label}
        <span className="when">{msg.when}</span>
      </div>
      <AiBody text={msg.text} streaming={msg.streaming} />
      {!msg.streaming && (
        <div className="ai-msg-acts">
          <div className="ai-msg-act" role="button" onClick={() => onCopy(msg)}><Icon name="copy" className="ic" /> Copy</div>
          <div className="ai-msg-act" role="button" onClick={() => onSaveNote(msg)}><Icon name="inbox" className="ic" /> Save to notes</div>
        </div>
      )}
    </div>
  );
}

/* ---- Empty state: pick a verb, take a starter ------------------------------------ */

function AiEmptyState({ verb, setVerb, onStarter }) {
  const v = AI_VERBS[verb];
  return (
    <div className="ai-empty">
      <div className="mark"><Icon name="sparkle" className="ic" /></div>
      <h3>What would you like to talk through?</h3>
      <div className="sub">Grounded in the open scene and its Story Bible entities — nothing else.</div>
      <div className="ai-verbgrid">
        {AI_VERB_ORDER.map((k) => (
          <button className={"ai-verbcard" + (k === verb ? " on" : "")} key={k} onClick={() => setVerb(k)}>
            <span className="vc-top"><Icon name={AI_VERBS[k].icon} className="ic" />{AI_VERBS[k].label}</span>
            <span className="vc-blurb">{AI_VERBS[k].blurb}</span>
          </button>
        ))}
      </div>
      <div className="ai-starters">
        {v.starters.slice(0, 2).map((s, i) => (
          <button className="ai-starter" key={i} onClick={() => onStarter(s)}>“{s}”</button>
        ))}
      </div>
    </div>
  );
}

/* ---- Dormant (consent not yet given) ----------------------------------------------- */

function AiDormant({ onWake }) {
  return (
    <div className="ai-dormant">
      <div className="mark"><Icon name="sparkle" className="ic" /></div>
      <h3>The assistant is asleep</h3>
      <p>Brainstorm, critique, beta-read and proofread — grounded in your manuscript. Nothing leaves your machine until you turn it on.</p>
      <button className="btn btn-primary" onClick={onWake}><Icon name="sparkle" className="ic" /> See how it works</button>
    </div>
  );
}

/* ---- Conversation list (shared by list layout + drawer) ----------------------------- */

function AiConvoList({ convos, activeId, onOpen, onNew, onDelete }) {
  return (
    <div className="ai-convlist">
      {convos.map((c) => {
        const last = c.messages[c.messages.length - 1];
        return (
          <div className="ai-convrow" role="button" key={c.id} onClick={() => onOpen(c.id)}>
            <Icon name={(AI_VERBS[c.verb] || AI_VERBS.brainstorm).icon} className="ic" />
            <div className="meta">
              <div className="nm">{c.title}</div>
              <div className="snip">{last ? last.text.replace(/[#*>|-]/g, "").slice(0, 90) : "No messages yet"}</div>
            </div>
            <span className="when">{c.when}</span>
            <span className="del" role="button" title="Delete conversation"
              onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}><Icon name="x" className="ic" /></span>
          </div>
        );
      })}
      <button className="ai-newconv" onClick={onNew}><Icon name="plus" className="ic" /> New conversation</button>
    </div>
  );
}

/* ---- Credit meter --------------------------------------------------------------------- */

function AiMeter({ usedPct, plan }) {
  if (plan === "key") {
    return (
      <div className="ai-meter">
        <div className="ai-meter-row"><span>Assistant</span><span className="st">Using your own API key</span></div>
      </div>
    );
  }
  const st = aiMeterStatus(usedPct);
  return (
    <div className="ai-meter" title="Your monthly allowance. When it runs out, the assistant stops — it never runs up a bill.">
      <div className="ai-meter-row">
        <span className={"st " + st.cls}>{st.label}</span>
        <span>{st.sub}</span>
      </div>
      <div className="ai-meter-track">
        <div className={"ai-meter-fill " + st.cls} style={{ width: Math.max(2, 100 - Math.min(100, usedPct)) + "%" }}></div>
      </div>
    </div>
  );
}

/* ---- The panel ---------------------------------------------------------------------------- */

function AssistantPanel(props) {
  const { t, scene, tree, convos, setConvos, activeId, setActiveId, about, aiCtx,
    never, used, setUsed, sel, pendingAsk, clearPendingAsk,
    onOpenConsent, onOpenContext, onToast, onSaveNote } = props;

  const layout = t.aiLayout || "tabs";
  const plan = t.aiPlan || "active";
  const offline = !!t.aiOffline;
  const consented = t.aiConsented !== false;

  const [verb, setVerb] = React.useState("brainstorm");
  const [prompt, setPrompt] = React.useState("");
  const [verbPop, setVerbPop] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);
  const [attachedSel, setAttachedSel] = React.useState(null);
  const [streamingId, setStreamingId] = React.useState(null);
  const cancelRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const threadRef = React.useRef(null);

  const active = convos.find((c) => c.id === activeId) || null;

  /* ---- context assembly (the honest inventory) ---- */
  const offSet = new Set(aiCtx.offEntities || []);
  const neverSet = new Set(never || []);
  const linked = [...(scene.characters || []), ...(scene.locations || [])]
    .filter((n) => !offSet.has(n) && !neverSet.has(n));
  const allScenes = [];
  tree.chapters.forEach((ch) => ch.scenes.forEach((s) => allScenes.push({ ...s, chapterTitle: ch.title })));
  tree.shortPieces.forEach((s) => allScenes.push({ ...s, chapterTitle: "Short pieces" }));
  const extras = (aiCtx.extraSceneIds || []).filter((id) => id !== scene.id)
    .map((id) => allScenes.find((s) => s.id === id)).filter(Boolean);
  const extraWords = extras.reduce((a, s) => a + (s.words || 0), 0);
  const hasAbout = !!(about && about.synopsis);
  const turns = active ? Math.ceil(active.messages.length / 2) : 0;
  const est = aiEstimate({
    sceneWords: scene.words || 0, extraWords, selWords: attachedSel ? attachedSel.words : 0,
    entityCount: linked.length, about: aiCtx.about !== false && hasAbout, turns,
  });
  const usedPct = Math.min(100, (AI_CREDIT_BASE[t.aiCredits] ?? 26) + used);
  const boundaryLabel = aiCtx.boundary
    ? (tree.chapters.find((c) => c.id === aiCtx.boundary) || {}).title : null;

  /* ---- pending ask from the editor (pill / right-click) ---- */
  React.useEffect(() => {
    if (!pendingAsk) return;
    if (pendingAsk.verb) setVerb(pendingAsk.verb);
    if (pendingAsk.sel) setAttachedSel(pendingAsk.sel);
    clearPendingAsk();
    setTimeout(() => inputRef.current && inputRef.current.focus(), 60);
  }, [pendingAsk]);

  /* ---- autoscroll ---- */
  const msgCount = active ? active.messages.length : 0;
  const lastLen = active && msgCount ? active.messages[msgCount - 1].text.length : 0;
  React.useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [msgCount, lastLen, activeId]);

  React.useEffect(() => () => cancelRef.current && cancelRef.current(), []);

  /* ---- conversation ops ---- */
  const newConvo = () => {
    const c = { id: "cv-" + Date.now().toString(36), title: "New conversation", verb: null, when: "now", messages: [] };
    setConvos((cs) => [c, ...cs]);
    setActiveId(c.id);
    setDrawer(false);
    return c.id;
  };
  const deleteConvo = (id) => {
    setConvos((cs) => cs.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(layout === "list" ? null : (convos.find((c) => c.id !== id) || {}).id || null);
    onToast("Conversation deleted");
  };

  /* ---- send (mock stream) ---- */
  const canCompose = consented && !offline && plan !== "expired" && (plan === "key" || usedPct < 100);
  const send = () => {
    const q = prompt.trim();
    if (!q || streamingId || !canCompose) return;
    let cid = activeId;
    if (!active) cid = newConvo();
    const ctxSnap = {
      scene: scene.title, words: scene.words,
      entities: linked, extras: extras.map((s) => s.title),
      sel: attachedSel ? attachedSel.words : null,
      about: aiCtx.about !== false && hasAbout,
      boundary: aiCtx.boundary || null, boundaryLabel,
    };
    const youMsg = { id: aiMsgId(), role: "you", verb, when: "now", text: q, ctx: ctxSnap };
    const aiMsg = { id: aiMsgId(), role: "ai", verb, when: "now", text: "", streaming: true };
    const turn = turns + 1;
    setConvos((cs) => cs.map((c) => c.id !== cid ? c : {
      ...c,
      title: c.title === "New conversation" ? (q.length > 36 ? q.slice(0, 36).trimEnd() + "…" : q) : c.title,
      verb: verb, when: "now",
      messages: [...c.messages, youMsg, aiMsg],
    }));
    setPrompt(""); setAttachedSel(null); setStreamingId(aiMsg.id);
    const reply = aiFakeReply(verb, turn);
    const apply = (fn) => setConvos((cs) => cs.map((c) => c.id !== cid ? c : {
      ...c, messages: c.messages.map((m) => m.id === aiMsg.id ? fn(m) : m),
    }));
    const finish = () => {
      apply((m) => ({ ...m, streaming: false }));
      setStreamingId(null);
      setUsed((u) => u + est.pct);
    };
    if (verb === "proofread") {
      // edits arrive as a block, not a trickle
      const tm = setTimeout(() => { apply((m) => ({ ...m, text: reply })); finish(); }, 900);
      cancelRef.current = () => clearTimeout(tm);
    } else {
      cancelRef.current = aiStream(reply, (chunk) => apply((m) => ({ ...m, text: m.text + chunk })), finish);
    }
  };
  const stop = () => {
    if (cancelRef.current) cancelRef.current();
    setConvos((cs) => cs.map((c) => ({ ...c, messages: c.messages.map((m) => m.streaming ? { ...m, streaming: false } : m) })));
    setStreamingId(null);
  };

  const copyMsg = (m) => {
    try { navigator.clipboard.writeText(m.text.replace(/^(EDIT\||NOTE\|)/gm, "")); } catch (e) {}
    onToast("Copied");
  };
  const saveMsg = (m) => { onSaveNote(m.text.split("\n")[0].slice(0, 140)); onToast("Saved to quick notes"); };

  if (!consented) {
    return <div className="ai-panel"><AiDormant onWake={onOpenConsent} /></div>;
  }

  /* ---- nav per layout ---- */
  const listMode = layout === "list" && !active;
  const showThread = !listMode;
  const verbDef = AI_VERBS[verb];

  const nav = layout === "tabs" ? (
    <div className="ai-convtabs">
      {convos.map((c) => (
        <div key={c.id} className={"ai-convtab" + (c.id === activeId ? " on" : "")} role="button"
          onClick={() => setActiveId(c.id)} title={c.title}>
          <Icon name={(AI_VERBS[c.verb] || AI_VERBS.brainstorm).icon} className="ic" /><span>{c.title}</span>
        </div>
      ))}
      <div className="ai-convtab-new" role="button" title="New conversation" onClick={newConvo}><Icon name="plus" className="ic" /></div>
    </div>
  ) : layout === "list" ? (
    active && (
      <div className="ai-convhead">
        <button className="iconbtn" title="All conversations" onClick={() => setActiveId(null)}><Icon name="chevLeft" className="ic" /></button>
        <span className="ttl">{active.title}</span>
        <button className="iconbtn" title="New conversation" onClick={newConvo}><Icon name="plus" className="ic" /></button>
      </div>
    )
  ) : layout === "drawer" ? (
    <div className="ai-convhead">
      <span className="ttl">{active ? active.title : "Assistant"}</span>
      <button className="iconbtn" title="New conversation" onClick={newConvo}><Icon name="plus" className="ic" /></button>
      <button className="iconbtn" title="Conversation history" onClick={() => setDrawer(true)}><Icon name="clock" className="ic" /></button>
    </div>
  ) : null; /* stream: no nav */

  /* ---- thread content ---- */
  let threadBody = null;
  if (listMode) {
    threadBody = <AiConvoList convos={convos} activeId={activeId} onOpen={setActiveId} onNew={newConvo} onDelete={deleteConvo} />;
  } else if (!active || !active.messages.length) {
    threadBody = (
      <div className="ai-thread" ref={threadRef}>
        <AiEmptyState verb={verb} setVerb={setVerb}
          onStarter={(s) => { setPrompt(s); inputRef.current && inputRef.current.focus(); }} />
      </div>
    );
  } else {
    const msgs = active.messages;
    threadBody = (
      <div className="ai-thread" ref={threadRef}>
        {msgs.map((m, i) => (
          <React.Fragment key={m.id}>
            {layout === "stream" && m.role === "you" && i > 0 && <div className="ai-divider">{m.when}</div>}
            <AiMessage msg={m} onCopy={copyMsg} onSaveNote={saveMsg} />
          </React.Fragment>
        ))}
      </div>
    );
  }

  /* ---- footer: guardrails > composer ---- */
  let footer = null;
  if (plan === "expired") {
    footer = (
      <div className="ai-guard">
        <div className="gtitle"><Icon name="clock" className="ic" /> Your assistant plan has lapsed</div>
        <p>Old conversations stay readable. New asks need an active plan — or your own API key, in Settings.</p>
        <div className="gacts">
          <button className="btn btn-primary" onClick={() => onToast("Renew — wired to checkout in the real app")}>Renew · $14.99/mo</button>
          <button className="btn btn-ghost" onClick={() => onToast("Bring your own key — see Settings → Assistant")}>Use my own key</button>
        </div>
      </div>
    );
  } else if (plan !== "key" && usedPct >= 100) {
    footer = (
      <div className="ai-guard">
        <div className="gtitle"><Icon name="moon" className="ic" /> This month's allowance is used up</div>
        <p>{AI_RESET_LABEL}. The assistant stops here rather than running up a bill — top up only if you want more now.</p>
        <div className="gacts">
          <button className="btn btn-primary" onClick={() => onToast("Top up — wired to checkout in the real app")}>Top up</button>
          <button className="btn btn-ghost" onClick={() => onToast("It will quietly return on July 1")}>Wait for July</button>
        </div>
      </div>
    );
  } else {
    footer = (
      <div className="ai-composer">
        {est.pct >= 2 && (
          <div className="ai-costcue">
            <Icon name="info" className="ic" />
            <span>A bigger ask than usual — about <b>{est.pct}%</b> of your monthly allowance in one go.</span>
          </div>
        )}
        <textarea ref={inputRef} className="ai-input" rows={2}
          placeholder={offline ? "Offline — your writing is unaffected" : verbDef.placeholder}
          value={prompt} disabled={offline}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); send(); } }} />
        <div className="ai-composer-row" style={{ position: "relative" }}>
          <button className="ai-verbchip" onClick={() => setVerbPop(v => !v)} disabled={offline}>
            <Icon name={verbDef.icon} className="ic" /> {verbDef.label}
            <Icon name="chevDown" className="ic chev" />
          </button>
          {verbPop && (
            <div className="ai-verbpop">
              {AI_VERB_ORDER.map((k) => (
                <button key={k} onClick={() => { setVerb(k); setVerbPop(false); inputRef.current && inputRef.current.focus(); }}>
                  <Icon name={AI_VERBS[k].icon} className="ic" />
                  <span><span className="nm">{AI_VERBS[k].label}</span><br /><span className="bl">{AI_VERBS[k].blurb}</span></span>
                  {k === verb && <span className="tick"><Icon name="check" className="ic" /></span>}
                </button>
              ))}
            </div>
          )}
          <span className="ai-kbd">⌘↵</span>
          {streamingId
            ? <button className="ai-send ai-stop" title="Stop" onClick={stop}><Icon name="square" className="ic" /></button>
            : <button className="ai-send" title={verbDef.action} disabled={!prompt.trim() || offline} onClick={send}>
                <Icon name="send" className="ic" /></button>}
        </div>
      </div>
    );
  }

  /* ---- context strip ---- */
  const strip = !listMode && plan !== "expired" && (
    <>
      <div className="ai-ctx-label">
        <Icon name="shield" className="ic" /> What I can see
        <span className="adjust" role="button" onClick={onOpenContext}>Adjust</span>
      </div>
      <div className="ai-chips">
        <span className="ai-chip ai-chip--scene"><Icon name="fileText" className="ic" /><span>{scene.title}</span></span>
        {extras.length > 0 && (
          <span className="ai-chip ai-chip--more" role="button" onClick={onOpenContext}>
            <Icon name="book" className="ic" /><span>+{extras.length} scene{extras.length > 1 ? "s" : ""}</span>
          </span>
        )}
        {linked.map((n) => <span className="ai-chip" key={n}><Icon name="user" className="ic" /><span>{n}</span></span>)}
        {attachedSel && (
          <span className="ai-chip ai-chip--sel">
            <Icon name="quote" className="ic" /><span>Selection · {attachedSel.words} words</span>
            <span className="x" role="button" title="Drop the selection" onClick={() => setAttachedSel(null)}><Icon name="x" className="ic" /></span>
          </span>
        )}
        {!attachedSel && sel && (
          <span className="ai-chip ai-chip--ghost" role="button"
            onClick={() => setAttachedSel({ text: sel.text, words: sel.words })}>
            <Icon name="plus" className="ic" /><span>Use selection · {sel.words} words</span>
          </span>
        )}
        {aiCtx.about !== false && hasAbout
          ? <span className="ai-chip"><Icon name="info" className="ic" /><span>About this manuscript</span></span>
          : <span className="ai-chip ai-chip--ghost" role="button" onClick={onOpenContext}><Icon name="plus" className="ic" /><span>Add “About this manuscript”</span></span>}
        {boundaryLabel && <span className="ai-chip"><Icon name="shield" className="ic" /><span>Read up to {boundaryLabel}</span></span>}
      </div>
    </>
  );

  return (
    <div className="ai-panel">
      {offline && (
        <div className="ai-offline">
          <Icon name="cloudOff" className="ic" />
          <span>You're offline. The assistant will be here when you're back — your writing is never affected.</span>
        </div>
      )}
      {nav}
      {threadBody}
      {!listMode && (
        <div className="ai-foot">
          {strip}
          {footer}
          <AiMeter usedPct={usedPct} plan={plan} />
        </div>
      )}
      {drawer && layout === "drawer" && (
        <>
          <div className="ai-drawer-scrim" onClick={() => setDrawer(false)}></div>
          <div className="ai-drawer">
            <div className="ai-drawer-head">
              Conversations <span className="spacer"></span>
              <button className="iconbtn" onClick={() => setDrawer(false)}><Icon name="x" className="ic" style={{ width: 13, height: 13 }} /></button>
            </div>
            <AiConvoList convos={convos} activeId={activeId} onDelete={deleteConvo}
              onOpen={(id) => { setActiveId(id); setDrawer(false); }} onNew={newConvo} />
          </div>
        </>
      )}
    </div>
  );
}

Object.assign(window, { InspectorTabs, AssistantPanel, useProseSelection, AiAskPill });
