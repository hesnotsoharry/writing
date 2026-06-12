/* Assistant overlays — first-run consent walkthrough + the context picker
   ("What I can see": scenes, entities w/ never-share flags, About-this-manuscript,
   spoiler boundary, live size estimate). Uses the canon .scrim/.sheet shell. */

/* ---- First-run consent walkthrough (3 steps, plain language) ----------------- */

function AiConsent({ onClose, onEnable }) {
  const [step, setStep] = React.useState(0);
  const steps = [
    {
      icon: "sparkle",
      title: "A collaborator in the margins",
      copy: (<>Brainstorm, critique, beta-read and proofread — grounded in your scenes and Story Bible. <b>It suggests; you write.</b> It never touches the page, and the whole feature disappears if you turn it off.</>),
      demo: null,
    },
    {
      icon: "shield",
      title: "You can always see what it sees",
      copy: (<>Each request sends <b>only what's in the chips</b> — the open scene, the entities linked to it, and your About note. Nothing is stored, logged, or used for training. Ever.</>),
      demo: (
        <div className="ai-chips">
          <span className="ai-chip ai-chip--scene"><Icon name="fileText" className="ic" /><span>The Causeway</span></span>
          <span className="ai-chip"><Icon name="user" className="ic" /><span>Maren Vale</span></span>
          <span className="ai-chip"><Icon name="user" className="ic" /><span>Tomas Roe</span></span>
          <span className="ai-chip"><Icon name="info" className="ic" /><span>About this manuscript</span></span>
        </div>
      ),
    },
    {
      icon: "check",
      title: "A meter, not a bill",
      copy: (<>Your plan includes a monthly allowance. When it runs out, the assistant <b>stops</b> — it never runs up a bill behind your back. Top up only if you choose to.</>),
      demo: (
        <div className="ai-meter">
          <div className="ai-meter-row"><span className="st">Plenty left this month</span><span>{AI_RESET_LABEL}</span></div>
          <div className="ai-meter-track"><div className="ai-meter-fill" style={{ width: "74%" }}></div></div>
        </div>
      ),
    },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet ai-consent" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div><div className="sheet-title"><Icon name="sparkle" className="ic" />Meet the assistant</div></div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        <div className="sheet-body">
          <div className="step">
            <div className="mark"><Icon name={s.icon} className="ic" /></div>
            <h3>{s.title}</h3>
            <div className="copy">{s.copy}</div>
            {s.demo && <div className="demo">{s.demo}</div>}
            <div className="dots">{steps.map((_, i) => <span key={i} className={"dot" + (i === step ? " on" : "")}></span>)}</div>
            <div className="acts">
              {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>Back</button>}
              {!last
                ? <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Continue</button>
                : <button className="btn btn-primary" onClick={onEnable}><Icon name="sparkle" className="ic" /> Turn on the assistant</button>}
            </div>
            {last && <div className="fine">$14.99/month, or bring your own API key. Cancel any time — your writing never depends on it.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- About this manuscript (inline editor used by the picker) ------------------ */

function AiAboutCard({ about, onSave }) {
  const [editing, setEditing] = React.useState(!about.synopsis);
  const [draft, setDraft] = React.useState(about);
  React.useEffect(() => setDraft(about), [about]);
  const field = (key, label, textarea, full) => (
    <div className={"ai-field" + (full ? " full" : "")}>
      <label>{label}</label>
      {textarea
        ? <textarea value={draft[key] || ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
        : <input value={draft[key] || ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />}
    </div>
  );
  return (
    <div className="ai-about-card">
      {!editing ? (
        <>
          <div className="ai-about-line">
            {about.synopsis
              ? (<><b>{about.genre || "Untyped"}</b> · {about.pov || "POV unset"} — {about.synopsis}</>)
              : "Nothing here yet. A synopsis, genre and tone ride along with every request, so the assistant knows what book it's helping with."}
          </div>
          <div className="ai-about-foot">
            <button className="btn btn-ghost" onClick={() => setEditing(true)}><Icon name="edit" className="ic" /> {about.synopsis ? "Edit" : "Write it"}</button>
          </div>
        </>
      ) : (
        <>
          <div className="ai-about-edit">
            {field("synopsis", "Synopsis", true, true)}
            {field("genre", "Genre")}
            {field("tone", "Tone")}
            {field("pov", "POV & tense")}
            {field("notes", "Things the assistant should know", true, true)}
          </div>
          <div className="ai-about-foot">
            <button className="btn btn-ghost" onClick={() => { setDraft(about); setEditing(false); }}>Cancel</button>
            <button className="btn btn-primary" onClick={() => { onSave(draft); setEditing(false); }}>Save</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Context picker -------------------------------------------------------------- */

function AiContextPicker(props) {
  const { tree, scene, chars, locs, aiCtx, setAiCtx, never, toggleNever,
    about, setAbout, onClose } = props;

  const extraSet = new Set(aiCtx.extraSceneIds || []);
  const offSet = new Set(aiCtx.offEntities || []);
  const neverSet = new Set(never || []);

  const toggleScene = (id) => {
    if (id === scene.id) return;
    const next = new Set(extraSet);
    next.has(id) ? next.delete(id) : next.add(id);
    setAiCtx({ ...aiCtx, extraSceneIds: [...next] });
  };
  const toggleEntity = (name) => {
    if (neverSet.has(name)) return;
    const next = new Set(offSet);
    next.has(name) ? next.delete(name) : next.add(name);
    setAiCtx({ ...aiCtx, offEntities: [...next] });
  };

  const linkedNames = new Set([...(scene.characters || []), ...(scene.locations || [])]);
  const pool = [...chars, ...locs].filter((e) => linkedNames.has(e.name));

  // live estimate
  const allScenes = [];
  tree.chapters.forEach((ch) => ch.scenes.forEach((s) => allScenes.push(s)));
  tree.shortPieces.forEach((s) => allScenes.push(s));
  const extraWords = [...extraSet].map((id) => (allScenes.find((s) => s.id === id) || {}).words || 0).reduce((a, b) => a + b, 0);
  const included = pool.filter((e) => !offSet.has(e.name) && !neverSet.has(e.name)).length;
  const hasAbout = !!about.synopsis;
  const est = aiEstimate({ sceneWords: scene.words || 0, extraWords, entityCount: included, about: aiCtx.about !== false && hasAbout });

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet ai-picker" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="shield" className="ic" />What the assistant can see</div>
            <div className="sheet-sub">An honest inventory — every request sends exactly this, and nothing else.</div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        <div className="sheet-body">

          <div>
            <div className="ai-sec-label"><Icon name="info" className="ic" /> About this manuscript
              <span className="hint">rides along with every request</span></div>
            <AiAboutCard about={about} onSave={setAbout} />
          </div>

          <div>
            <div className="ai-sec-label"><Icon name="fileText" className="ic" /> Scenes
              <span className="hint">the open scene is always included</span></div>
            <div className="ai-scenetree">
              {tree.chapters.map((ch) => (
                <React.Fragment key={ch.id}>
                  <div className="ai-chaprow">{ch.title}</div>
                  {ch.scenes.map((s) => {
                    const isCur = s.id === scene.id;
                    const on = isCur || extraSet.has(s.id);
                    return (
                      <div key={s.id} className={"ai-scenerow" + (isCur ? " current" : "")} role="button" onClick={() => toggleScene(s.id)}>
                        <span className={"ai-check" + (isCur ? " lock" : on ? " on" : "")}>{on && <Icon name="check" className="ic" />}</span>
                        <span className="nm">{s.title}</span>
                        <span className="wc">{(s.words || 0).toLocaleString()}</span>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div>
            <div className="ai-sec-label"><Icon name="users" className="ic" /> Story Bible
              <span className="hint">linked to the open scene · shield = never share</span></div>
            <div className="ai-entgrid">
              {pool.map((e) => {
                const isNever = neverSet.has(e.name);
                const on = !isNever && !offSet.has(e.name);
                return (
                  <div key={e.id} className={"ai-entrow" + (isNever ? " never" : "")} role="button" onClick={() => toggleEntity(e.name)}>
                    <span className={"ai-check" + (on ? " on" : "")}>{on && <Icon name="check" className="ic" />}</span>
                    <span className="nm">{e.name}</span>
                    <span className={"shield" + (isNever ? " on" : "")} role="button"
                      title={isNever ? "Shared with the assistant again" : "Never share this entity with the assistant"}
                      onClick={(ev) => { ev.stopPropagation(); toggleNever(e.name); }}>
                      <Icon name={isNever ? "shieldOff" : "shield"} className="ic" />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="ai-sec-label"><Icon name="book" className="ic" /> Spoiler boundary</div>
            <div className="ai-boundary">
              <select value={aiCtx.boundary || ""} onChange={(e) => setAiCtx({ ...aiCtx, boundary: e.target.value || null })}>
                <option value="">No boundary</option>
                {tree.chapters.map((ch) => <option key={ch.id} value={ch.id}>Read up to {ch.title}</option>)}
              </select>
              <span className="note">The assistant is told to behave as if it hasn't read past this point — useful for beta reads.</span>
            </div>
          </div>

          <div className="ai-picker-foot">
            <div className="ai-meter">
              <div className="ai-meter-row"><span className="st">Size of this context</span>
                <span className="ai-est">≈ <b>{est.pct}%</b> of your monthly allowance per ask</span></div>
              <div className="ai-meter-track"><div className="ai-meter-fill" style={{ width: Math.min(100, est.pct * 8) + "%" }}></div></div>
            </div>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>

        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AiConsent, AiContextPicker });
