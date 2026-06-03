/* Full-center views: Corkboard and Story Bible — with context menus, rename, status */

function shortLabel(name) {
  return name.replace(/^The\s+/, "").split(" ")[0];
}

function CorkCard({ scene, chapterId, handlers, renaming, i }) {
  const meta = STATUS_META[scene.status];
  const tags = [
    ...scene.characters.slice(0, 2).map(n => ({ t: "character", n })),
    ...scene.locations.slice(0, 1).map(n => ({ t: "location", n })),
  ];
  return (
    <div className="card" style={{ animationDelay: (Math.min(i || 0, 9) * 45) + "ms" }}
      onClick={() => handlers.onOpenScene(scene.id)}
      onContextMenu={e => handlers.onMenu(e, "scene", { scene, chapterId })}>
      <div className="pin"></div>
      <div className="card-status">
        {meta.done
          ? <Icon name="check" className="scene-check" style={{ width: 12, height: 12 }} onClick={e => { e.stopPropagation(); handlers.onStatus(e, scene); }} />
          : <span className="dot" style={{ background: meta.dot }} onClick={e => { e.stopPropagation(); handlers.onStatus(e, scene); }}></span>}
        <span className="lbl">{meta.label}</span>
        <span className="w">{scene.words ? scene.words.toLocaleString() + "w" : "—"}</span>
      </div>
      {renaming
        ? <div onClick={e => e.stopPropagation()} style={{ marginBottom: 6 }}>
            <RenameInput value={scene.title} onCommit={t => handlers.onRename("scene", scene.id, t)} onCancel={() => handlers.setRenaming(null)} />
          </div>
        : <div className="card-title">{scene.title}</div>}
      <div className="card-syn">{scene.synopsis || <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>No synopsis yet.</span>}</div>
      <div className="card-foot">
        {tags.map((tag, i) => (
          <span key={i} className={"chip " + tag.t}>
            <Icon name={tag.t === "character" ? "user" : "mapPin"} style={{ width: 10, height: 10 }} />
            {shortLabel(tag.n)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Corkboard({ tree, handlers, renaming }) {
  return (
    <div className="corkboard">
      <div className="corkboard-inner">
        {tree.chapters.map(ch => (
          <div className="cork-chgroup" key={ch.id}>
            <div className="cork-chtitle">{ch.title} · {ch.scenes.length} scenes</div>
            <div className="cork-grid">
              {ch.scenes.map((s, i) => <CorkCard key={s.id} scene={s} chapterId={ch.id} handlers={handlers} renaming={renaming === s.id} i={i} />)}
              {ch.scenes.length === 0 && <div className="empty-hint">No scenes in this chapter.</div>}
            </div>
          </div>
        ))}
        <div className="cork-chgroup">
          <div className="cork-chtitle">Short pieces · {tree.shortPieces.length}</div>
          <div className="cork-grid">
            {tree.shortPieces.map((s, i) => <CorkCard key={s.id} scene={s} chapterId={null} handlers={handlers} renaming={renaming === s.id} i={i} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function BibleEntry({ entity, kind, handlers, renaming, i }) {
  return (
    <div className="bible-entry" style={{ animationDelay: (Math.min(i || 0, 9) * 45) + "ms" }}
      onContextMenu={e => handlers.onEntityMenu(e, entity, kind)}
      onDoubleClick={() => handlers.setRenaming(entity.id)}>
      <div className={"avatar " + entity.color}>{entity.initial}</div>
      <div className="be-body">
        {renaming
          ? <div style={{ marginBottom: 5 }}><RenameInput value={entity.name}
              onCommit={t => handlers.onRenameEntity(kind, entity.id, t)} onCancel={() => handlers.setRenaming(null)} /></div>
          : <div className="be-name">{entity.name}</div>}
        <div className="be-role">{entity.role || kind}</div>
        <div className="be-notes">{entity.notes}</div>
        <div className="be-foot">
          <Icon name="fileText" style={{ width: 11, height: 11 }} />
          {entity.scenes} scenes{entity.arc ? " · " + entity.arc : ""}
        </div>
      </div>
    </div>
  );
}

function StoryBible({ chars, locs, handlers, renaming }) {
  return (
    <div className="corkboard">
      <div className="corkboard-inner" style={{ maxWidth: 960 }}>
        <div className="bible-grid">
          <div>
            <div className="bible-col-title">
              <Icon name="users" style={{ width: 14, height: 14, color: "var(--character)" }} />
              Characters · {chars.length}
            </div>
            {chars.map((c, i) => <BibleEntry key={c.id} entity={c} kind="Character" handlers={handlers} renaming={renaming === c.id} i={i} />)}
            <button className="add-entity" style={{ justifyContent: "center", border: "1px dashed var(--parchment-edge)", padding: 9 }}
              onClick={() => handlers.onAddEntity("Character")}>
              <Icon name="plus" style={{ width: 13, height: 13 }} /> New character
            </button>
          </div>
          <div>
            <div className="bible-col-title">
              <Icon name="mapPin" style={{ width: 14, height: 14, color: "var(--location)" }} />
              Locations · {locs.length}
            </div>
            {locs.map((l, i) => <BibleEntry key={l.id} entity={l} kind="Location" handlers={handlers} renaming={renaming === l.id} i={i} />)}
            <button className="add-entity" style={{ justifyContent: "center", border: "1px dashed var(--parchment-edge)", padding: 9 }}
              onClick={() => handlers.onAddEntity("Location")}>
              <Icon name="plus" style={{ width: 13, height: 13 }} /> New location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Corkboard, StoryBible });
