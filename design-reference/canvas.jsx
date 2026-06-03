/* Canvas — the calm serif writing surface. Entity highlights + selection format bubble. */

const ENTITY_RE = /\b(Maren|Edda|Tomas|Lia)\b|\b(Thornwick|lighthouse|Lighthouse|causeway|Causeway)\b/g;

// Each scene gets a distinct rotation of the prose so a page-turn visibly reveals new text.
function proseFor(scene) {
  const id = (scene && scene.id) ? scene.id : "";
  const k = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % SCENE_PROSE.length;
  return SCENE_PROSE.slice(k).concat(SCENE_PROSE.slice(0, k));
}

function highlightProse(text, key) {
  const out = [];
  let last = 0, m, i = 0;
  while ((m = ENTITY_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const isLoc = !!m[2];
    out.push(
      <span key={key + "-" + (i++)} className={"entity" + (isLoc ? " loc" : "")}>{m[0]}</span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
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

function Canvas({ scene, onStatus }) {
  const meta = STATUS_META[scene.status];
  return (
    <div className="canvas-scroll">
      <div className="canvas-wrap">
        <div className="scene-eyebrow">
          <span>{scene.chapterTitle}</span>
          <span className="sep"></span>
          <button onClick={e => onStatus(e, scene)} title="Click to change status"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "inherit", letterSpacing: "inherit", textTransform: "inherit", color: meta.dot === "var(--ink-4)" ? "var(--ink-3)" : meta.dot, cursor: "pointer" }}>
            {meta.done
              ? <Icon name="check" style={{ width: 13, height: 13 }} />
              : <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta.dot }}></span>}
            {meta.label}
          </button>
        </div>
        <h1 className="scene-h1">{scene.title}</h1>
        <div className="scene-byline">
          <span>{scene.words.toLocaleString()} words</span>
          <span className="dotsep"></span>
          <span>{scene.characters.length} characters · {scene.locations.length} locations present</span>
        </div>

        <div className="prose">
          {proseFor(scene).map((para, i) => {
            const isLast = i === SCENE_PROSE.length - 1;
            if (i === 1) {
              // a mid-page paragraph carries the demo selection + format toolbar
              const sel = para.slice(0, 44);
              return (
                <p key={i}><FormatBubble text={sel} />{highlightProse(para.slice(44), "r" + i)}</p>
              );
            }
            return (
              <p key={i}>
                {highlightProse(para, "p" + i)}
                {isLast && <span className="caret"></span>}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.Canvas = Canvas;
window.proseFor = proseFor;
