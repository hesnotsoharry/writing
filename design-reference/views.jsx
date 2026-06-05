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
        <StatusGlyph status={scene.status} size={13}
          onClick={e => { e.stopPropagation(); handlers.onStatus(e, scene); }} />
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

const bibColor = (c) => (c === "character" || c === "location") ? ("var(--" + c + ")") : ("var(--label-" + c + ")");

function StoryBible({ groups, tiers, handlers, renaming }) {
  const byTier = {};
  groups.forEach((g) => {
    const tier = (window.ENTITY_TYPE_DEFS[g.key] || {}).tier || "Other";
    (byTier[tier] = byTier[tier] || []).push(g);
  });
  return (
    <div className="corkboard">
      <div className="corkboard-inner" style={{ maxWidth: 1100 }}>
        {tiers.filter((t) => byTier[t]).map((tier) => (
          <div className="bib-tier" key={tier}>
            <div className="bib-tier-label">{tier}</div>
            <div className="bib-cols">
              {byTier[tier].map((g) => {
                const def = window.ENTITY_TYPE_DEFS[g.key];
                return (
                  <div className="tcol" key={g.key}>
                    <div className="tcol-head" style={{ color: bibColor(def.color) }}>
                      <Icon name={def.icon} className="ic" />
                      <span className="nm">{def.label}</span>
                      <span className="ct">{g.entities.length}</span>
                    </div>
                    {g.entities.map((e) => (
                      <div className="bib-row" key={e.id} onClick={() => handlers.onOpenEntity(e, g.key)}
                        onContextMenu={(ev) => handlers.onEntityMenu(ev, e, g.key)}>
                        <div className="bib-badge round" style={{ background: "color-mix(in srgb, " + bibColor(e.color) + " 16%, transparent)", color: bibColor(e.color) }}>{e.initial}</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="nm">{e.name}</div>
                          <div className="role">{e.role || def.label}</div>
                        </div>
                      </div>
                    ))}
                    <button className="tcol-add" onClick={() => handlers.onAddEntity(g.key)}>
                      <Icon name="plus" style={{ width: 12, height: 12 }} /> New {def.label.replace(/s$/, "").toLowerCase()}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button className="bib-newtype" onClick={() => handlers.onNewType()}><Icon name="plus" style={{ width: 14, height: 14 }} /> New type…</button>
          <button className="bib-newtype" onClick={() => handlers.onOpenMap()}><Icon name="users" style={{ width: 14, height: 14 }} /> Relationship map</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Corkboard, StoryBible });
