/* Canvas — the calm serif writing surface. Auto-linked Story-Bible names +
   selection format bubble. */

// Each scene gets a distinct rotation of the prose so a page-turn visibly reveals new text.
function proseFor(scene) {
  const id = (scene && scene.id) ? scene.id : "";
  const k = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % SCENE_PROSE.length;
  return SCENE_PROSE.slice(k).concat(SCENE_PROSE.slice(0, k));
}

function FormatBubble({ text }) {
  // A static demonstration of the rich-text controls, anchored over a selection.
  const btns = [
    { ic: "bold" }, { ic: "italic" }, { sep: true },
    { ic: "heading" }, { ic: "quote" }, { ic: "list" },
  ];
  return (
    <span style={{ position: "relative" }}>
      <span style={{ background: "var(--selection)", borderRadius: 2, padding: "0 1px" }}>{text}</span>
      <span style={{
        position: "absolute", bottom: "1.7em", left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 2, padding: 4,
        background: "var(--ink)", borderRadius: 8, boxShadow: "var(--shadow-md)",
        fontFamily: "var(--font-ui)", whiteSpace: "nowrap", zIndex: 6,
      }}>
        {btns.map((b, i) => b.sep
          ? <span key={i} style={{ width: 1, height: 16, background: "rgba(255,255,255,0.18)", margin: "0 2px" }}></span>
          : <button key={i} style={{
              width: 26, height: 26, borderRadius: 5, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.85)",
            }}><Icon name={b.ic} style={{ width: 14, height: 14 }} /></button>
        )}
        <span style={{
          position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
          width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
          borderTop: "5px solid var(--ink)",
        }}></span>
      </span>
    </span>
  );
}

function FocusHud({ scene, goals, showTimer }) {
  const g = goals && goals.find((x) => (window.GOAL_META[x.type] || {}).family === "amount");
  const p = g ? window.goalProgress(g) : null;
  const streak = goals && goals.find((x) => x.type === "streak");
  const r = 9, c = 2 * Math.PI * r, off = p ? c * (1 - p.pct / 100) : c;
  return (
    <div className="canvas-hud">
      <div className="stat"><b>{scene.words.toLocaleString()}</b> words</div>
      {p && (
        <>
          <div className="sep"></div>
          <div className="stat" style={{ gap: 7 }}>
            <span className="comp-ring" style={{ width: 24, height: 24 }}>
              <svg width="24" height="24" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r={r} fill="none" stroke="var(--parchment-deep)" strokeWidth="2.5" />
                <circle cx="12" cy="12" r={r} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 12 12)" />
              </svg>
            </span>
            <span>{p.current.toLocaleString()} / {p.target.toLocaleString()}</span>
          </div>
        </>
      )}
      {streak && (
        <>
          <div className="sep"></div>
          <div className="stat"><Icon name="flame" style={{ width: 14, height: 14, color: "var(--accent)" }} /> <b>{streak.streakDays || 0}</b></div>
        </>
      )}
      <div className="sep"></div>
      {showTimer && <div className="stat"><Icon name="clock" style={{ width: 14, height: 14, color: "var(--ink-3)" }} /> 00:48:12</div>}
    </div>
  );
}

function Canvas({ scene, onStatus, focus, goals, focusOpts, entities, autolink, onOpenEntity, onLinkMenu, onFindMentions }) {
  const meta = STATUS_META[scene.status];
  const fo = focusOpts || { dim: true, hud: true, timer: true };
  const al = autolink || { on: false };
  const [peek, setPeek] = React.useState(null);          // { ent, anchor } | null
  const hideT = React.useRef(null);

  // Matcher rebuilt only when the pool / enabled types change.
  const index = React.useMemo(
    () => (al.on ? alBuildIndex(entities || [], al.types) : { re: null, byVariant: new Map() }),
    [entities, al.on, (al.types || []).join(",")]
  );
  React.useEffect(() => () => clearTimeout(hideT.current), []);
  React.useEffect(() => { setPeek(null); }, [scene.id]);  // drop peek when the scene changes

  const showPeek = (ent, rect) => { clearTimeout(hideT.current); setPeek({ ent, anchor: rect }); };
  const queueHide = () => { clearTimeout(hideT.current); hideT.current = setTimeout(() => setPeek(null), 150); };
  const keepPeek = () => clearTimeout(hideT.current);

  // Fresh per render so "first per scene" scope counts from the top each pass.
  const ctx = {
    re: index.re, byVariant: index.byVariant, scope: al.scope, seen: new Set(),
    onHover: showPeek, onLeave: queueHide,
    onOpen: (ent) => { setPeek(null); onOpenEntity && onOpenEntity(ent); },
    onMenu: (e, ent) => { setPeek(null); onLinkMenu && onLinkMenu(e, ent); },
  };
  const renderPara = (text, key) => (al.on ? alLinkNodes(text, key, ctx) : [text]);

  return (
    <div className="canvas-scroll">
      <div className={"canvas-wrap" + (focus && fo.dim ? " focus-mode" : "")}>
        <div className="scene-eyebrow">
          <span>{scene.chapterTitle}</span>
          <span className="sep"></span>
          <button onClick={e => onStatus(e, scene)} title="Click to change status"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "inherit", letterSpacing: "inherit", textTransform: "inherit", color: meta.dot === "var(--ink-4)" ? "var(--ink-3)" : meta.dot, cursor: "pointer" }}>
            <StatusGlyph status={scene.status} size={14} />
            {meta.label}
          </button>
        </div>
        <h1 className="scene-h1">{scene.title}</h1>
        <div className="scene-byline">
          <span>{scene.words.toLocaleString()} words</span>
          <span className="dotsep"></span>
          <span>{scene.characters.length} characters · {scene.locations.length} locations present</span>
        </div>

        <div className={"prose" + (al.on && al.style === "hover" ? " al-hideunder" : "")}>
          {proseFor(scene).map((para, i) => {
            const isLast = i === SCENE_PROSE.length - 1;
            if (i === 1) {
              // a mid-page paragraph carries the demo selection + format toolbar
              const sel = para.slice(0, 44);
              return (
                <p key={i}><FormatBubble text={sel} />{renderPara(para.slice(44), "r" + i)}</p>
              );
            }
            return (
              <p key={i}>
                {renderPara(para, "p" + i)}
                {isLast && <span className="caret"></span>}
              </p>
            );
          })}
        </div>
      </div>
      {al.on && peek && (
        <AutoLinkPeek ent={peek.ent} anchor={peek.anchor}
          onEnter={keepPeek} onLeave={queueHide}
          onOpen={(ent) => { setPeek(null); onOpenEntity && onOpenEntity(ent); }}
          onFind={(ent) => { setPeek(null); onFindMentions && onFindMentions(ent); }} />
      )}
      {focus && fo.hud && <FocusHud scene={scene} goals={goals} showTimer={fo.timer} />}
    </div>
  );
}

window.Canvas = Canvas;
window.proseFor = proseFor;
