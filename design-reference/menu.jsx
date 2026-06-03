/* Reusable right-click ContextMenu (with submenus) + Undo Toast */

function MenuItems({ items, onClose }) {
  const [openSub, setOpenSub] = React.useState(-1);
  return items.map((it, i) => {
    if (it.type === "sep") return <div key={i} className="cm-sep"></div>;
    if (it.type === "label") return <div key={i} className="cm-label">{it.text}</div>;
    const hasSub = !!it.submenu;
    return (
      <button key={i} className={"cm-item" + (it.danger ? " danger" : "")}
        onMouseEnter={() => setOpenSub(hasSub ? i : -1)}
        onClick={() => { if (hasSub) return; it.onClick && it.onClick(); onClose(); }}>
        {it.swatch ? <span className="swatch" style={{ background: it.swatch }}></span>
          : it.icon ? <Icon name={it.icon} className="ic" /> : <span style={{ width: 15 }}></span>}
        <span>{it.label}</span>
        {it.tick && <Icon name="check" className="tick" style={{ width: 15, height: 15 }} />}
        {it.right && <span className="right">{it.right}</span>}
        {hasSub && <Icon name="chevRight" className="chev" style={{ width: 14, height: 14 }} />}
        {hasSub && openSub === i && (
          <div className="cm cm-sub" onClick={e => e.stopPropagation()}>
            <MenuItems items={it.submenu} onClose={onClose} />
          </div>
        )}
      </button>
    );
  });
}

function ContextMenu({ menu, onClose }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState({ left: menu ? menu.x : 0, top: menu ? menu.y : 0 });

  React.useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const pad = 10;
    let left = menu.x, top = menu.y;
    if (left + r.width + pad > window.innerWidth) left = window.innerWidth - r.width - pad;
    if (top + r.height + pad > window.innerHeight) top = Math.max(pad, window.innerHeight - r.height - pad);
    setPos({ left, top });
  }, [menu]);

  React.useEffect(() => {
    if (!menu) return;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  if (!menu) return null;
  return (
    <>
      <div className="cm-backdrop" onMouseDown={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }}></div>
      <div className="cm" ref={ref} style={{ left: pos.left, top: pos.top }} onClick={e => e.stopPropagation()}>
        <MenuItems items={menu.items} onClose={onClose} />
      </div>
    </>
  );
}

function Toast({ toast, onUndo, onClose }) {
  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onClose, 5000);
    return () => clearTimeout(id);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className="toast-wrap">
      <div className="toast">
        <span>{toast.label}</span>
        {toast.undo && <button className="undo" onClick={onUndo}>Undo</button>}
        <button className="tx" onClick={onClose}><Icon name="x" style={{ width: 13, height: 13 }} /></button>
      </div>
    </div>
  );
}

function RenameInput({ value, onCommit, onCancel }) {
  const [v, setV] = React.useState(value);
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) { ref.current.focus(); ref.current.select(); } }, []);
  const commit = () => onCommit((v.trim() || value));
  return (
    <input ref={ref} className="rename-input" value={v}
      onChange={e => setV(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter") commit(); else if (e.key === "Escape") onCancel(); e.stopPropagation(); }}
      onBlur={commit}
      onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()} />
  );
}

Object.assign(window, { ContextMenu, Toast, RenameInput });
