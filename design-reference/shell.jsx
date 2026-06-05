/* AppShell — layout + context-menu construction + overlays. */

function LeafPage({ scene }) {
  const meta = STATUS_META[scene.status];
  return (
    <div className="leaf-page">
      <div className="scene-eyebrow">
        <span>{scene.chapterTitle}</span>
        <span className="sep"></span>
        <span style={{ color: meta.dot === "var(--ink-4)" ? "var(--ink-3)" : meta.dot }}>{meta.label}</span>
      </div>
      <h1 className="scene-h1">{scene.title}</h1>
      <div className="scene-byline"><span>{(scene.words || 0).toLocaleString()} words</span></div>
      <div className="prose">{proseFor(scene).slice(0, 6).map((para, i) => <p key={i}>{para}</p>)}</div>
    </div>
  );
}

function AppShell(p) {
  const { t, setTweak, view, setView, tree, scene, activeId, setActiveId, focus, setFocus,
    overlay, setOverlay, goalsOn, setGoalsOn, goals, snapshots, labels, sceneLabels, quickNotes, chars, locs, items, factions, lore, themes, menu, setMenu, toast, setToast,
    renaming, setRenaming, archived, projMeta, actions } = p;

  const at = (e) => ({ x: e.clientX, y: e.clientY });
  // All bible entities (for entry lookup) + tier groups (for the Story Bible).
  const entityPool = [...chars, ...locs, ...items, ...factions, ...lore, ...themes];
  const bibleGroups = [
    { key: "character", entities: chars }, { key: "location", entities: locs },
    { key: "item", entities: items }, { key: "faction", entities: factions },
    { key: "lore", entities: lore }, { key: "theme", entities: themes },
    ...((actions.customTypes || []).map((ct) => ({ key: ct.key, entities: [] }))),
  ];
  const bibleTiers = (actions.customTypes && actions.customTypes.length) ? [...ENTITY_TIERS, "Custom"] : ENTITY_TIERS;
  const [goalsInit, setGoalsInit] = React.useState("list");
  const openGoals = (init) => { setGoalsInit(init || "list"); setOverlay("goals"); };
  const [histScene, setHistScene] = React.useState(null);
  const openHistory = (sceneId) => { setHistScene(sceneId); setOverlay("history"); };
  const snapToast = (sceneId) => { actions.captureSnapshot(sceneId); setToast({ label: "Snapshot taken" }); };
  const [planMode, setPlanMode] = React.useState("board"); // board | table (corkboard ⇄ outliner)
  const [otlSort, setOtlSort] = React.useState({ col: "manual", dir: "asc" });
  const [focusOpts, setFocusOpts] = React.useState({ typewriter: true, dim: true, hud: true, timer: true });
  const [focusSet, setFocusSet] = React.useState(false);

  function openGoalMenu(e, goal) {
    e.preventDefault(); e.stopPropagation();
    setMenu({ ...at(e), items: [
      { icon: "edit", label: "Edit goal", onClick: () => openGoals(goal.id) },
      { icon: "target", label: "Manage all goals", onClick: () => openGoals("list") },
      { type: "sep" },
      { icon: "trash", label: "Delete goal", danger: true, onClick: () => actions.deleteGoal(goal.id) },
    ] });
  }

  function openStatus(e, sc) {
    setMenu({ ...at(e), items: [
      { type: "label", text: "Set status" },
      ...STATUS_ORDER.map(k => ({ swatch: STATUS_META[k].dot, label: STATUS_META[k].label, tick: sc.status === k, onClick: () => actions.setStatus(sc.id, k) })),
    ] });
  }

  function openMenu(e, kind, payload) {
    e.preventDefault(); e.stopPropagation();
    if (kind === "chapter") {
      const ch = payload.chapter;
      setMenu({ ...at(e), items: [
        { icon: "edit", label: "Rename chapter", onClick: () => setRenaming(ch.id) },
        { icon: "plus", label: "New scene", onClick: () => actions.addSceneTo(ch.id) },
        { type: "sep" },
        { icon: "download", label: "Export chapter…", onClick: () => setOverlay("export") },
        { icon: "archive", label: "Archive chapter", onClick: () => actions.archiveChap(ch.id) },
        { type: "sep" },
        { icon: "trash", label: "Delete chapter", danger: true, onClick: () => actions.deleteChap(ch.id) },
      ] });
      return;
    }
    const sc = payload.scene;
    setMenu({ ...at(e), items: [
      { icon: "edit", label: "Rename", onClick: () => setRenaming(sc.id) },
      { icon: "target", label: "Set status", submenu: STATUS_ORDER.map(k => ({ swatch: STATUS_META[k].dot, label: STATUS_META[k].label, tick: sc.status === k, onClick: () => actions.setStatus(sc.id, k) })) },
      { icon: "copy", label: "Duplicate", onClick: () => actions.dupScene(sc.id) },
      { type: "sep" },
      { icon: "rotate", label: "Version history…", onClick: () => openHistory(sc.id) },
      { icon: "camera", label: "Take snapshot", onClick: () => snapToast(sc.id) },
      { type: "sep" },
      { icon: "download", label: "Export scene…", onClick: () => setOverlay("export") },
      { type: "sep" },
      { icon: "archive", label: "Archive", onClick: () => actions.archiveScene(sc.id) },
      { icon: "trash", label: "Delete", danger: true, onClick: () => actions.deleteScene(sc.id) },
    ] });
  }

  function openEntityMenu(e, entity, kind) {
    e.preventDefault(); e.stopPropagation();
    setMenu({ ...at(e), items: [
      { icon: "edit", label: "Edit name", onClick: () => setRenaming(entity.id) },
      { icon: "fileText", label: "Open full entry", onClick: () => actions.openEntry(entity, kind) },
      { type: "sep" },
      { icon: "trash", label: "Delete " + kind.toLowerCase(), danger: true, onClick: () => actions.deleteEntity(kind, entity.id) },
    ] });
  }

  // Auto-link: the linkable Story-Bible pool (everything except Themes — they're
  // never named in prose) + a right-click menu for an in-prose link.
  const linkPool = [...chars, ...locs, ...items, ...factions, ...lore];
  const alSettings = {
    on: t.autolink !== false,
    style: t.autolinkStyle || "underline",       // underline | hover
    scope: t.autolinkScope || "all",             // all | first
    types: t.autolinkTypes || ["character", "location", "item", "faction", "lore"],
  };
  const openLinkMenu = (e, ent) => {
    e.preventDefault(); e.stopPropagation();
    const kind = window.alKind(ent);
    const typeLabel = kind ? kind[0].toUpperCase() + kind.slice(1) : "";
    setMenu({ ...at(e), items: [
      { type: "label", text: ent.name + " · " + typeLabel },
      { icon: "fileText", label: "Open full entry", onClick: () => actions.openEntry(ent, kind) },
      { icon: "search", label: "Find mentions", onClick: () => setOverlay("findreplace") },
      { type: "sep" },
      { icon: "minus", label: "Unlink here", onClick: () => setToast({ label: "Unlinked this mention" }) },
      { icon: "x", label: "Never link “" + ent.name + "”", onClick: () => setToast({ label: "“" + ent.name + "” won’t auto-link" }) },
      { type: "sep" },
      { icon: "users", label: "Manage aliases…", onClick: () => setToast({ label: "Aliases — wired in the real app" }) },
    ] });
  };

  const binderHandlers = {
    onSelect: setActiveId, onRename: actions.rename, setRenaming, onMenu: openMenu, onStatus: openStatus,
    onAddChapter: actions.addChap, onAddScene: actions.addSceneTo,
    onSwitchProject: actions.switchProject, onNewProject: actions.newProject,
  };
  const corkHandlers = {
    onOpenScene: id => { setActiveId(id); setView("write"); }, onMenu: openMenu, onStatus: openStatus,
    onRename: actions.rename, setRenaming,
  };
  const bibleHandlers = {
    onEntityMenu: openEntityMenu, onRenameEntity: actions.renameEntity, setRenaming,
    onOpenEntity: (entity, key) => actions.openEntry(entity, key),
    onAddEntity: (key) => {
      if (key === "character") actions.addEntity("Character");
      else if (key === "location") actions.addEntity("Location");
      else setToast({ label: "New " + key + " — wired in the real app" });
    },
    onNewType: () => setOverlay("newtype"),
    onOpenMap: () => setView("map"),
  };

  // Page-flip: when the open scene changes (and motion is on), turn a paper leaf.
  const prevSceneRef = React.useRef(activeId);
  const flipNum = React.useRef(0);
  const [flip, setFlip] = React.useState(null); // { key, dir } | null
  React.useEffect(() => {
    if (prevSceneRef.current === activeId) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const order = Object.keys(p.scenes);
    const dir = order.indexOf(activeId) < order.indexOf(prevSceneRef.current) ? "back" : "fwd";
    const outgoing = p.scenes[prevSceneRef.current];
    prevSceneRef.current = activeId;
    if (t.motion && !reduce && view === "write") {
      const key = ++flipNum.current;
      setFlip({ key, dir, scene: outgoing });
      const id = setTimeout(() => setFlip(f => (f && f.key === key ? null : f)), 1250);
      return () => clearTimeout(id);
    }
  }, [activeId]);

  return (
    <div className={"win" + (t.motion ? " anim" : "")}>
      {!focus && (
        <TitleBar view={view} setView={setView} projectTitle={projMeta.title}
          openQuick={() => setOverlay("quick")} openExport={() => setOverlay("export")}
          enterFocus={() => setFocus(true)} toggleGoals={() => openGoals("list")}
          openHistory={() => openHistory(activeId)} openFind={() => setOverlay("findreplace")}
          openSettings={() => setOverlay("settings")}
          goalsOn={goalsOn} quickCount={quickNotes.length} />
      )}

      <div className="body">
        {!focus && view === "write" && (
          <Binder tree={tree} activeId={activeId} renaming={renaming} projects={PROJECTS}
            activeProject={projMeta.id} handlers={binderHandlers}
            quickCount={quickNotes.length} openInbox={() => setOverlay("inbox")}
            archivedCount={archived.length} openArchive={() => setOverlay("archive")} />
        )}

        <div className="center">
          {focus && (
            <div className="focus-exit" style={focusSet ? { opacity: 1 } : null}>
              <span className="kbd">⌘.</span>
              <button className="iconbtn" title="Focus settings" style={{ background: "var(--parchment)" }} onClick={() => setFocusSet(s => !s)}>
                <Icon name="cog" className="ic" />
              </button>
              <button className="btn btn-ghost" style={{ background: "var(--parchment)" }} onClick={() => setFocus(false)}>
                <Icon name="focus" className="ic" /> Exit focus
              </button>
              {focusSet && (
                <div className="fs-pop" style={{ position: "absolute", top: 46, right: 0 }}>
                  <div className="fs-title">Focus mode</div>
                  {[["typewriter", "Typewriter scrolling"], ["dim", "Dim other paragraphs"], ["hud", "Word-count & goal HUD"], ["timer", "Session timer"]].map(([k, l]) => (
                    <div className="fs-opt" key={k} onClick={() => setFocusOpts(o => ({ ...o, [k]: !o[k] }))}>
                      <span className="lbl">{l}</span><div className={"toggle" + (focusOpts[k] ? " on" : "")}></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="view-stage" key={view}>
            {view === "write" && scene && <Canvas key={activeId} scene={{ ...scene, ...(p.scenes[activeId] || {}) }} onStatus={openStatus} focus={focus} goals={goals} focusOpts={focusOpts}
              entities={linkPool} autolink={alSettings}
              onOpenEntity={(ent) => actions.openEntry(ent, window.alKind(ent))}
              onLinkMenu={openLinkMenu}
              onFindMentions={() => setOverlay("findreplace")} />}
            {view === "write" && !scene && <div style={{ margin: "auto", color: "var(--ink-4)", fontFamily: "var(--font-prose)", fontStyle: "italic" }}>Select a scene to start writing.</div>}
            {view === "cork" && (
              <div className="plan-wrap">
                <div className="otl-top">
                  <div className="exp-seg">
                    <button className={planMode === "board" ? "on" : ""} onClick={() => setPlanMode("board")}>Corkboard</button>
                    <button className={planMode === "table" ? "on" : ""} onClick={() => setPlanMode("table")}>Outliner</button>
                  </div>
                  <span className="spacer" style={{ flex: 1 }}></span>
                  <button className="btn btn-ghost" onClick={() => setOverlay("labels")}><Icon name="palette" className="ic" /> Labels</button>
                </div>
                {planMode === "board"
                  ? <Corkboard tree={tree} handlers={corkHandlers} renaming={renaming} />
                  : <div className="plan-body"><Outliner tree={tree} labels={labels} sceneLabels={sceneLabels} sort={otlSort} setSort={setOtlSort}
                      renaming={renaming} onManageLabels={() => setOverlay("labels")}
                      h={{ onOpenScene: id => { setActiveId(id); setView("write"); }, onMenu: openMenu, onStatus: openStatus,
                        onRename: actions.rename, setRenaming, onSetSynopsis: actions.setSynopsis, onToggleLabel: actions.toggleSceneLabel }} /></div>}
              </div>
            )}
            {view === "bible" && <StoryBible groups={bibleGroups} tiers={bibleTiers} handlers={bibleHandlers} renaming={renaming} />}
            {view === "map" && <RelationshipMap entities={entityPool} edits={p.entryEdits || {}}
              onOpen={(e) => actions.openEntry(e, e.type || e.color)} onBack={() => setView("bible")} />}
            {view === "entry" && p.entry && (() => {
              const ent = entityPool.find((x) => x.id === p.entry.id);
              if (!ent) return null;
              return <FullEntry entity={ent} kind={p.entry.kind} origin={p.entryOrigin} stackDepth={(p.entry && p.entryStack ? p.entryStack.length : 1)}
                scenes={p.scenes} chars={chars} locs={locs}
                edit={(p.entryEdits || {})[ent.id]} renaming={renaming} setRenaming={setRenaming}
                onBack={actions.entryBack}
                onExit={actions.exitEntry}
                onOpenScene={(id) => { setActiveId(id); setView("write"); }}
                onOpenEntity={(e2, k2) => actions.pushEntry(e2, k2)}
                onAddRelated={(fromId, people) => actions.addRelatedEntity(fromId, people)}
                onPatch={actions.patchEntry}
                onReciprocal={actions.relateReciprocal}
                onRename={actions.renameEntity}
                onDelete={(k2, id) => { actions.deleteEntity(k2, id); actions.exitEntry(); }}
                onToast={(label) => setToast({ label })} />;
            })()}
          </div>
          {view === "write" && flip && (
            <div className={"page-turn-layer " + flip.dir} key={flip.key}
              onAnimationEnd={() => setFlip(f => (f && f.key === flip.key ? null : f))}>
              <div className="page-turn-cast"></div>
              <div className="page-leaf">
                <div className="face front">
                  {flip.scene && <LeafPage scene={flip.scene} />}
                  <div className="leaf-shade"></div>
                </div>
                <div className="face back"></div>
              </div>
            </div>
          )}
        </div>

        {!focus && view === "write" && scene && (
          <Inspector scene={p.scenes[activeId] || scene} allChars={chars} allLocs={locs}
            goalsOn={goalsOn} goals={goals}
            onGoalMenu={openGoalMenu} onManageGoals={() => openGoals(goals.length ? "list" : "new")}
            snapshots={snapshots[activeId] || []} snapCurrentWords={(p.scenes[activeId] || scene).words}
            onOpenHistory={() => openHistory(activeId)} onCaptureSnap={() => snapToast(activeId)}
            onOpenEntity={(entity, kind) => actions.openEntry(entity, kind)}
            onLinkScene={(kind, entity) => actions.linkSceneEntity(kind, entity)}
            onAddEntity={(kind) => actions.addSceneEntity(kind)} />
        )}
      </div>

      {!focus && (
        <StatusBar sceneWords={scene ? scene.words : 0} projectWords={projMeta.words} target={projMeta.target || 80000}
          goalsOn={goalsOn} goals={goals} onOpenGoals={() => openGoals("list")} />
      )}

      {overlay === "quick" && <QuickCapture onClose={() => setOverlay(null)} onSave={actions.saveNote} />}
      {overlay === "inbox" && <Inbox notes={quickNotes} onClose={() => setOverlay(null)} onEdit={actions.editNote} onPromote={actions.promoteNote} onDelete={actions.deleteNote} />}
      {overlay === "archive" && <Archive items={archived} onClose={() => setOverlay(null)} onRestore={actions.restoreItem} onPurge={actions.purgeItem} />}
      {overlay === "export" && <Export onClose={() => setOverlay(null)} />}
      {overlay === "goals" && <GoalsManager enabled={goalsOn} goals={goals} initial={goalsInit}
        projectWords={projMeta.words}
        onToggle={() => { const v = !goalsOn; setGoalsOn(v); setTweak("goalsOn", v); }}
        onSave={actions.saveGoal} onDelete={actions.deleteGoal} onClose={() => setOverlay(null)} />}
      {overlay === "history" && (() => {
        const sid = histScene || activeId;
        const hsc = p.scenes[sid] || scene;
        return <VersionHistory scene={hsc} snapshots={snapshots[sid] || []}
          currentText={SCENE_CURRENT_TEXT[sid] || hsc.synopsis || ""} currentWords={hsc.words}
          onCapture={() => actions.captureSnapshot(sid)}
          onRename={(id, label) => actions.renameSnapshot(sid, id, label)}
          onRestore={(id) => actions.restoreSnapshot(sid, id)}
          onDelete={(id) => actions.deleteSnapshot(sid, id)}
          onClose={() => setOverlay(null)} />;
      })()}
      {overlay === "settings" && <Settings t={t} setTweak={setTweak} onClose={() => setOverlay(null)}
        onOpenGoals={() => openGoals("list")} onToast={(label) => setToast({ label })} />}

      {overlay === "labels" && <LabelManager labels={labels} onClose={() => setOverlay(null)}
        onRename={actions.renameLabel} onColor={actions.setLabelColor} onAdd={actions.addLabel} />}
      {overlay === "findreplace" && <FindReplace tree={tree}
        onJump={(id) => { setActiveId(id); setView("write"); setOverlay(null); }}
        onReplaceAll={actions.replaceAll} onClose={() => setOverlay(null)} />}

      {overlay === "newtype" && <CustomTypeCreator onClose={() => setOverlay(null)} onCreate={actions.createType} />}

      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
      <Toast toast={toast} onUndo={() => { toast._restore && toast._restore(); setToast(null); }} onClose={() => setToast(null)} />

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={t.theme} options={["light", "dark"]} onChange={v => setTweak("theme", v)} />
        <TweakColor label="Accent" value={t.accent}
          options={[["#b25a38","#99492b","#f1e2d8"], ["#3f6f9e","#315e89","#dde7f1"], ["#4e7c6b","#3c6354","#dfe9e3"], ["#7a5c8e","#634a74","#e8e0ee"]]}
          onChange={v => setTweak("accent", v)} />
        <TweakSection label="Writing canvas" />
        <TweakSelect label="Prose font" value={t.proseFont} options={["Literata", "Newsreader", "Source Serif", "iA Mono"]} onChange={v => setTweak("proseFont", v)} />
        <TweakSlider label="Prose size" value={t.proseSize} min={16} max={24} unit="px" onChange={v => setTweak("proseSize", v)} />
        <TweakSection label="Features" />
        <TweakToggle label="Goals enabled" value={goalsOn} onChange={v => { setGoalsOn(v); setTweak("goalsOn", v); }} />
        <TweakToggle label="Auto-link names" value={t.autolink !== false} onChange={v => setTweak("autolink", v)} />
        <TweakToggle label="Page animations" value={t.motion} onChange={v => setTweak("motion", v)} />
      </TweaksPanel>
    </div>
  );
}

window.AppShell = AppShell;
