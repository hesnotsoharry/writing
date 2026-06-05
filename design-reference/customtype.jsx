/* ============================================================================
   Custom entity-type creator — canon. Name + icon + palette accent → registers
   a new type that appears as a column in the (Custom) tier of the Story Bible.
   Reuses entity-types.css (.et-*). onCreate(def) is supplied by app.jsx.
   ========================================================================== */

const CT_PALETTE = ["clay", "sea", "moss", "plum", "gold", "slate", "rose", "ink"];
const CT_ICONS = ["box", "flag", "globe", "sparkle", "book", "zap", "command", "feather"];
const ctVar = (c) => "var(--label-" + c + ")";
const ctTint = (c) => "color-mix(in srgb, var(--label-" + c + ") 16%, transparent)";

function CustomTypeCreator({ onClose, onCreate }) {
  const [name, setName] = React.useState("");
  const [icon, setIcon] = React.useState("zap");
  const [color, setColor] = React.useState("plum");
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  const label = name.trim() || "Untitled";
  const singular = label.replace(/s$/, "");
  function create() {
    if (!name.trim()) return;
    onCreate({ key: "custom-" + Date.now().toString(36), label: label, icon, color, tier: "Custom" });
    onClose();
  }
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="plus" className="ic" /> New entity type</div>
            <div className="sheet-sub">Make your own — Spells, Ships, Timelines. It behaves like the built-ins.</div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        <div className="sheet-body">
          <label className="field-label">Name</label>
          <div className="fr-field" style={{ marginBottom: 16 }}>
            <input ref={ref} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spells"
              style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }} onKeyDown={(e) => { if (e.key === "Enter") create(); }} />
          </div>
          <div className="et-row" style={{ marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">Icon</label>
              <div className="et-iconpick">
                {CT_ICONS.map((ic) => (
                  <button key={ic} className={"et-icon-btn" + (icon === ic ? " on" : "")} onClick={() => setIcon(ic)}><Icon name={ic} style={{ width: 17, height: 17 }} /></button>
                ))}
              </div>
            </div>
            <div>
              <label className="field-label">Accent</label>
              <div style={{ display: "flex", gap: 6 }}>
                {CT_PALETTE.map((c) => (
                  <button key={c} className={"et-sw" + (color === c ? " on" : "")} style={{ background: ctVar(c) }} onClick={() => setColor(c)}></button>
                ))}
              </div>
            </div>
          </div>
          <div className="et-preview">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 9 }}>Preview</div>
            <div className="bib-row" style={{ cursor: "default" }}>
              <div className="bib-badge sq" style={{ width: 28, height: 28, background: ctTint(color), color: ctVar(color) }}><Icon name={icon} style={{ width: 15, height: 15 }} /></div>
              <div><div className="nm">A new {singular}</div><div className="role">{label}</div></div>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 8 }}>Default fields: Type · Status · First appears. Default sections: Description · Notes.</div>
          </div>
        </div>
        <div className="sheet-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={!name.trim()} onClick={create}><Icon name="check" className="ic" /> Create type</button>
        </div>
      </div>
    </div>
  );
}

window.CustomTypeCreator = CustomTypeCreator;
