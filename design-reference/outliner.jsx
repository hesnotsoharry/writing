/* ============================================================================
   Outliner — canon. A sortable, inline-editable table sibling to the corkboard,
   fed by the same binder tree. Plus curated color labels (assignment popover +
   manager overlay). Reuses: Icon, RenameInput, ContextMenu, outliner.css.
   State lives in app.jsx; this is presentation + local popover UI.
   See FEATURE-WAVE-PLAN.md / OUTLINER-SPEC.md.
   ========================================================================== */

const OTL_CVAR = (c) => "var(--label-" + c + ")";
const OTL_TINT = (c) => "color-mix(in srgb, var(--label-" + c + ") 16%, transparent)";

function OtlLabelPill({ label }) {
  return (
    <span className="lbl-pill" style={{ background: OTL_TINT(label.color), color: OTL_CVAR(label.color) }}>
      <span className="lbl-dot" style={{ background: OTL_CVAR(label.color) }}></span>{label.name}
    </span>
  );
}

function OtlLabelMenu({ labels, active, at, onToggle, onClose, onManage }) {
  React.useEffect(() => {
    const h = () => onClose();
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="lbl-menu" style={{ left: at.x, top: at.y }} onMouseDown={e => e.stopPropagation()}>
      {labels.map(l => (
        <button key={l.id} className={"lbl-menu-opt" + (active.includes(l.id) ? " on" : "")} onClick={() => onToggle(l.id)}>
          <span className="lbl-dot" style={{ background: OTL_CVAR(l.color), width: 9, height: 9 }}></span>
          {l.name}
          <Icon name="check" className="check" style={{ width: 15, height: 15 }} />
        </button>
      ))}
      <div className="lbl-menu-sep"></div>
      <button className="lbl-menu-manage" onClick={onManage}><Icon name="cog" style={{ width: 14, height: 14 }} /> Manage labels…</button>
    </div>
  );
}

function OutlinerRow({ scene, chapterId, labels, sceneLabels, h, renaming, onOpenLabelMenu }) {
  const meta = STATUS_META[scene.status];
  const ids = sceneLabels[scene.id] || [];
  const byId = id => labels.find(l => l.id === id);
  return (
    <div className="otl-row otl-grid" onContextMenu={e => h.onMenu(e, "scene", { scene, chapterId })}>
      <div className="otl-cell otl-handle"><Icon name="grid" style={{ width: 12, height: 12 }} /></div>
      <button className="otl-cell otl-statusbtn" title={meta.label} onClick={e => h.onStatus(e, scene)}>
        <StatusGlyph status={scene.status} size={14} />
      </button>
      <div className="otl-cell">
        {renaming === scene.id
          ? <RenameInput value={scene.title} onCommit={t => h.onRename("scene", scene.id, t)} onCancel={() => h.setRenaming(null)} />
          : <span className="otl-title" style={{ display: "block", cursor: "pointer" }}
              onClick={() => h.onOpenScene(scene.id)} onDoubleClick={() => h.setRenaming(scene.id)} title="Click to open · double-click to rename">{scene.title}</span>}
      </div>
      <div className="otl-cell otl-syn" contentEditable suppressContentEditableWarning
        onBlur={e => h.onSetSynopsis(scene.id, e.currentTarget.textContent.trim())}>{scene.synopsis}</div>
      <div className="otl-cell otl-words">{scene.words ? scene.words.toLocaleString() : "—"}</div>
      <div className="otl-cell otl-labels">
        {ids.map(id => { const l = byId(id); return l ? <OtlLabelPill key={id} label={l} /> : null; })}
        <button className="lbl-add" title="Add label" onClick={e => { e.stopPropagation(); onOpenLabelMenu(scene.id, e.clientX, e.clientY); }}>
          <Icon name="plus" style={{ width: 12, height: 12 }} />
        </button>
      </div>
    </div>
  );
}

function Outliner({ tree, labels, sceneLabels, sort, setSort, renaming, h, onManageLabels }) {
  const [menu, setMenu] = React.useState(null); // {sceneId, x, y}
  function setSortCol(col) {
    // asc → desc → back to manual (chapter) order, so grouping is always reachable
    setSort(s => {
      if (s.col !== col) return { col, dir: "asc" };
      if (s.dir === "asc") return { col, dir: "desc" };
      return { col: "manual", dir: "asc" };
    });
  }
  // Flatten with chapter context (used only for the label-menu lookup)
  const flat = [
    ...tree.chapters.flatMap(c => c.scenes.map(s => ({ s, chapterId: c.id, chapter: c.title }))),
    ...tree.shortPieces.map(s => ({ s, chapterId: null, chapter: "Short pieces" })),
  ];
  // Chapter grouping is ALWAYS preserved; sorting reorders scenes *within* each
  // chapter. (A global flat sort would scramble chapter order, which a
  // manuscript outline must never do.)
  const dir = sort.dir === "asc" ? 1 : -1;
  const firstLabel = id => { const ls = sceneLabels[id] || []; return ls.length ? (labels.find(l => l.id === ls[0]) || {}).name || "" : "~"; };
  const cmp = (a, b) => {
    if (sort.col === "words") return ((a.s.words || 0) - (b.s.words || 0)) * dir;
    if (sort.col === "status") return (STATUS_ORDER.indexOf(a.s.status) - STATUS_ORDER.indexOf(b.s.status)) * dir;
    if (sort.col === "label") return firstLabel(a.s.id).localeCompare(firstLabel(b.s.id)) * dir;
    return a.s.title.localeCompare(b.s.title) * dir;
  };
  const display = [
    ...tree.chapters.map(c => ({ chapter: c.title, rows: c.scenes.map(s => ({ s, chapterId: c.id })) })),
    { chapter: "Short pieces", rows: tree.shortPieces.map(s => ({ s, chapterId: null })) },
  ].filter(g => g.rows.length)
   .map(g => sort.col === "manual" ? g : { ...g, rows: [...g.rows].sort(cmp) });
  const Caret = ({ col }) => sort.col === col
    ? <Icon name="chevDown" className="sortcaret" style={{ width: 12, height: 12, transform: sort.dir === "asc" ? "none" : "rotate(180deg)" }} />
    : null;
  const menuScene = menu && flat.find(x => x.s.id === menu.sceneId);

  return (
    <div className="otl-table">
      <div className="otl-head otl-grid">
        <span className="hcell"></span>
        <button className="hcell" onClick={() => setSortCol("status")}>● <Caret col="status" /></button>
        <button className="hcell" onClick={() => setSortCol("title")}>Title <Caret col="title" /></button>
        <span className="hcell">Synopsis</span>
        <button className="hcell" onClick={() => setSortCol("words")}>Words <Caret col="words" /></button>
        <button className="hcell" onClick={() => setSortCol("label")}>Labels <Caret col="label" /></button>
      </div>
      {display.map((g, gi) => (
        <React.Fragment key={gi}>
          {g.chapter && <div className="otl-chrow">{g.chapter}</div>}
          {g.rows.map(({ s, chapterId }) => (
            <OutlinerRow key={s.id} scene={s} chapterId={chapterId} labels={labels} sceneLabels={sceneLabels}
              h={h} renaming={renaming} onOpenLabelMenu={(sceneId, x, y) => setMenu({ sceneId, x, y })} />
          ))}
        </React.Fragment>
      ))}
      {menuScene && (
        <OtlLabelMenu labels={labels} active={sceneLabels[menu.sceneId] || []} at={menu}
          onToggle={(lid) => h.onToggleLabel(menu.sceneId, lid)} onClose={() => setMenu(null)}
          onManage={() => { setMenu(null); onManageLabels(); }} />
      )}
    </div>
  );
}

const OTL_PALETTE = ["clay", "sea", "moss", "plum", "gold", "slate", "rose", "ink"];
function LabelManager({ labels, onClose, onRename, onColor, onAdd }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="palette" className="ic" /> Labels</div>
            <div className="sheet-sub">A small, curated set — rename and recolour to keep the manuscript cohesive.</div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        <div className="sheet-body">
          {labels.map(l => (
            <div className="lblmgr-row" key={l.id}>
              <span className="lbl-dot" style={{ background: OTL_CVAR(l.color), width: 11, height: 11 }}></span>
              <div className="lblmgr-name" contentEditable suppressContentEditableWarning
                onBlur={e => onRename(l.id, e.currentTarget.textContent.trim() || l.name)}>{l.name}</div>
              <div className="lblmgr-swatches">
                {OTL_PALETTE.map(c => (
                  <button key={c} className={"sw-btn" + (l.color === c ? " on" : "")} title={c}
                    style={{ background: OTL_CVAR(c) }} onClick={() => onColor(l.id, c)}></button>
                ))}
              </div>
            </div>
          ))}
          <button className="add-entity" style={{ justifyContent: "center", border: "1px dashed var(--parchment-edge)", padding: 10, marginTop: 8 }} onClick={onAdd}>
            <Icon name="plus" style={{ width: 13, height: 13 }} /> New label
          </button>
        </div>
        <div className="sheet-foot">
          <span className="lblmgr-foot-hint"><Icon name="palette" style={{ width: 13, height: 13 }} /> Colours come from the app palette — labels always feel on-brand.</span>
          <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Outliner, LabelManager });
