/* Binder — project dropdown, chapters → scenes, short pieces, context menus, inline rename */

function ProjectSwitch({ projects, activeProject, onSwitch, onNew }) {
  const [open, setOpen] = React.useState(false);
  const active = projects.find(p => p.id === activeProject) || projects[0];
  const sub = p => (p.type === "novel" ? "Novel · " : "Collection · ") + p.words.toLocaleString() + " words";
  return (
    <div className="project-switch" style={{ position: "relative" }}>
      <button className="proj-btn" onClick={() => setOpen(o => !o)}>
        <div className="proj-cover"></div>
        <div className="proj-meta">
          <div className="proj-title">{active.title}</div>
          <div className="proj-sub">{sub(active)}</div>
        </div>
        <Icon name="chevDown" className="proj-chev" style={{ width: 15, height: 15 }} />
      </button>
      {open && (
        <>
          <div className="cm-backdrop" style={{ zIndex: 49 }} onMouseDown={() => setOpen(false)}></div>
          <div className="proj-menu">
            {projects.map(p => (
              <button key={p.id} className={"proj-item" + (p.id === activeProject ? " on" : "")}
                onClick={() => { onSwitch(p.id); setOpen(false); }}>
                <div className="pc"></div>
                <div className="pm">
                  <div className="pt">{p.title}</div>
                  <div className="ps">{sub(p)}</div>
                </div>
                {p.id === activeProject && <Icon name="check" className="tick" style={{ width: 16, height: 16 }} />}
              </button>
            ))}
            <div className="cm-sep"></div>
            <button className="proj-new" onClick={() => { onNew(); setOpen(false); }}>
              <Icon name="plus" className="ic" /> New manuscript…
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SceneRow({ scene, active, renaming, onSelect, onRename, onMenu, onStatus, onDoubleRename }) {
  const meta = STATUS_META[scene.status];
  return (
    <div className={"scene-row" + (active ? " active" : "")} onClick={onSelect}
      onContextMenu={onMenu} onDoubleClick={onDoubleRename}>
      <StatusGlyph status={scene.status} size={13} className="scene-status"
        onClick={onStatus} title={meta.label + " · click to change"} />
      {renaming
        ? <RenameInput value={scene.title} onCommit={onRename} onCancel={() => onRename(scene.title)} />
        : <span className="scene-title">{scene.title}</span>}
      <span className="scene-words">{scene.words ? scene.words.toLocaleString() : "—"}</span>
    </div>
  );
}

function Chapter({ chapter, activeId, renaming, handlers }) {
  const [open, setOpen] = React.useState(true);
  const isRenaming = renaming === chapter.id;
  return (
    <div className="chapter">
      <div className={"chapter-row" + (open ? "" : " closed")}
        onClick={() => !isRenaming && setOpen(o => !o)}
        onContextMenu={e => handlers.onMenu(e, "chapter", { chapter })}
        onDoubleClick={e => { e.stopPropagation(); handlers.setRenaming(chapter.id); }}>
        <span className="twist"><Icon name="chevDown" style={{ width: 13, height: 13 }} /></span>
        {isRenaming
          ? <RenameInput value={chapter.title}
              onCommit={t => handlers.onRename("chapter", chapter.id, t)}
              onCancel={() => handlers.setRenaming(null)} />
          : <span className="ch-title">{chapter.title}</span>}
        <span className="ch-count">{chapter.scenes.length}</span>
      </div>
      {open && (
        <div className="scene-list">
          {chapter.scenes.map(s => (
            <SceneRow key={s.id} scene={s} active={s.id === activeId} renaming={renaming === s.id}
              onSelect={() => handlers.onSelect(s.id)}
              onRename={t => handlers.onRename("scene", s.id, t)}
              onDoubleRename={e => { e.stopPropagation(); handlers.setRenaming(s.id); }}
              onMenu={e => handlers.onMenu(e, "scene", { scene: s, chapterId: chapter.id })}
              onStatus={e => { e.stopPropagation(); handlers.onStatus(e, s); }} />
          ))}
          {chapter.scenes.length === 0 && (
            <div className="empty-hint" style={{ paddingLeft: 16 }}>No scenes yet —
              <button onClick={() => handlers.onAddScene(chapter.id)}
                style={{ color: "var(--accent-deep)", fontWeight: 600, marginLeft: 4 }}>add one</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Binder({ tree, activeId, renaming, projects, activeProject, handlers,
  quickCount, openInbox, archivedCount, openArchive }) {
  return (
    <div className="panel-binder">
      <ProjectSwitch projects={projects} activeProject={activeProject}
        onSwitch={handlers.onSwitchProject} onNew={handlers.onNewProject} />
      <div className="binder-scroll">
        <div className="bsection-head">
          <span>Manuscript</span>
          <span className="count">{tree.chapters.length} chapters</span>
          <button className="add" title="Add chapter" onClick={handlers.onAddChapter}>
            <Icon name="plus" style={{ width: 14, height: 14 }} />
          </button>
        </div>
        {tree.chapters.map(ch => (
          <Chapter key={ch.id} chapter={ch} activeId={activeId} renaming={renaming} handlers={handlers} />
        ))}
        <button className="add-chapter" onClick={handlers.onAddChapter}>
          <Icon name="plus" style={{ width: 13, height: 13 }} /> New chapter
        </button>

        <div className="bsection-head" style={{ marginTop: 14 }}>
          <span>Short pieces</span>
          <span className="count">{tree.shortPieces.length}</span>
          <button className="add" title="Add short piece" onClick={() => handlers.onAddScene(null)}>
            <Icon name="plus" style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <div className="scene-list" style={{ paddingLeft: 4 }}>
          {tree.shortPieces.map(s => (
            <SceneRow key={s.id} scene={s} active={s.id === activeId} renaming={renaming === s.id}
              onSelect={() => handlers.onSelect(s.id)}
              onRename={t => handlers.onRename("scene", s.id, t)}
              onDoubleRename={e => { e.stopPropagation(); handlers.setRenaming(s.id); }}
              onMenu={e => handlers.onMenu(e, "short", { scene: s })}
              onStatus={e => { e.stopPropagation(); handlers.onStatus(e, s); }} />
          ))}
          {tree.shortPieces.length === 0 && <div className="empty-hint" style={{ paddingLeft: 8 }}>Nothing here yet.</div>}
        </div>
      </div>
      <div className="binder-foot">
        <button className="foot-btn" onClick={openInbox}>
          <Icon name="inbox" className="ic" /> Quick notes
          {quickCount > 0 && <span className="badge">{quickCount}</span>}
        </button>
        {archivedCount > 0 && (
          <button className="foot-btn" onClick={openArchive}>
            <Icon name="square" className="ic" /> Archived
            <span className="badge" style={{ background: "var(--ink-4)" }}>{archivedCount}</span>
          </button>
        )}
      </div>
    </div>
  );
}

window.Binder = Binder;
