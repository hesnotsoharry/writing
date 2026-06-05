/* ============================================================================
   Auto-linking — in-prose recognition of Story-Bible entities.
   When the manuscript names something the Bible tracks (characters · locations ·
   items · factions · lore — NOT themes), the word becomes a quiet link: a
   persistent underline tinted by the app accent (the theme colour from
   Settings), a hover peek card, click-to-open-entry, and a right-click menu.

   Pure presentation. Matching is case-aware + whole-word + possessive-tolerant,
   resolves first-names / "The"-stripped aliases to the full entry, and (per the
   "first per scene" setting) can link only a scene's first mention.

   Exposes (window): alBuildIndex, alLinkNodes, AutoLink, AutoLinkPeek, alKind.
   See AUTOLINK-SPEC.md.  Built from the "Auto-link - explorations.html" pick
   (Direction A · quiet persistent underline).
   ========================================================================== */

// type/kind of an entity (characters/locations carry it on `color`; the newer
// types carry an explicit `type`). Matches the Story-Bible `g.key` vocabulary.
function alKind(ent) { return ent.type || ent.color; }

const AL_STOP = new Set(["The", "A", "An", "And", "But", "She", "He", "They", "It", "Come", "Whatever", "From", "There", "You", "We", "I"]);

// Name + the aliases that should resolve to the same entry.
function alVariants(ent) {
  const out = new Set();
  const name = (ent.name || "").trim();
  if (name.length < 2) return [];
  out.add(name);
  const noThe = name.replace(/^The\s+/i, "");
  if (noThe.length >= 3) out.add(noThe);
  const toks = noThe.split(/\s+/);
  const kind = alKind(ent);
  if (kind === "character" && toks[0] && toks[0].length >= 3) out.add(toks[0]);          // first name
  else if (toks.length > 1 && toks[0] && toks[0].length >= 4) out.add(toks[0]);          // distinctive lead token for places/things
  return [...out].filter(v => v.length >= 3 && !AL_STOP.has(v));
}

const alEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Build a matcher over an entity pool, honouring the enabled `types`.
function alBuildIndex(pool, types) {
  const allow = types && types.length ? new Set(types) : null;
  const byVariant = new Map();
  const variants = [];
  (pool || []).forEach((ent) => {
    if (allow && !allow.has(alKind(ent))) return;
    alVariants(ent).forEach((v) => { if (!byVariant.has(v)) { byVariant.set(v, ent); variants.push(v); } });
  });
  if (!variants.length) return { re: null, byVariant };
  variants.sort((a, b) => b.length - a.length);                 // longest first → "Maren Vale" beats "Maren"
  // case-AWARE (no i flag); letter boundaries allow a trailing possessive 's.
  const re = new RegExp("(?<![A-Za-z])(" + variants.map(alEsc).join("|") + ")(?![A-Za-z])", "g");
  return { re, byVariant };
}

// Tokenise a paragraph into [strings + <AutoLink>] nodes.
function alLinkNodes(text, keyPre, ctx) {
  if (!ctx || !ctx.re) return [text];
  ctx.re.lastIndex = 0;
  const out = []; let last = 0, m, i = 0;
  while ((m = ctx.re.exec(text)) !== null) {
    const matched = m[0];
    const ent = ctx.byVariant.get(matched);
    if (!ent) continue;
    if (ctx.scope === "first" && ctx.seen.has(ent.id)) continue; // leave as plain text
    if (m.index > last) out.push(text.slice(last, m.index));
    if (ctx.scope === "first") ctx.seen.add(ent.id);
    out.push(<AutoLink key={keyPre + "-" + (i++)} ent={ent} text={matched} ctx={ctx} />);
    last = m.index + matched.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// A single in-prose link.
function AutoLink({ ent, text, ctx }) {
  const enterT = React.useRef(null);
  return (
    <span className="al-link"
      onClick={(e) => { e.stopPropagation(); ctx.onOpen && ctx.onOpen(ent); }}
      onContextMenu={(e) => { ctx.onMenu && ctx.onMenu(e, ent); }}
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        enterT.current = setTimeout(() => ctx.onHover && ctx.onHover(ent, r), 230);
      }}
      onMouseLeave={() => { clearTimeout(enterT.current); ctx.onLeave && ctx.onLeave(); }}>
      {text}
    </span>
  );
}

// The hover peek card. `anchor` = the link's viewport rect; positioned under it,
// clamped to the viewport. Hovering the card keeps it open (onEnter/onLeave).
function AutoLinkPeek({ ent, anchor, onEnter, onLeave, onOpen, onFind }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState({ left: anchor.left, top: anchor.bottom + 7, ready: false });
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight, pad = 10;
    let left = anchor.left, top = anchor.bottom + 7;
    if (left + w + pad > window.innerWidth) left = window.innerWidth - w - pad;
    if (top + h + pad > window.innerHeight) top = anchor.top - h - 7;   // flip above
    setPos({ left: Math.max(pad, left), top: Math.max(pad, top), ready: true });
  }, [ent, anchor.left, anchor.top]);

  const kind = alKind(ent);
  const typeLabel = kind ? kind[0].toUpperCase() + kind.slice(1) : "";
  return (
    <div className="al-peek" ref={ref}
      style={{ left: pos.left, top: pos.top, visibility: pos.ready ? "visible" : "hidden" }}
      onMouseEnter={onEnter} onMouseLeave={onLeave}
      onContextMenu={(e) => e.preventDefault()}>
      <div className="al-peek-head">
        <div className={"avatar " + ent.color}>{ent.initial}</div>
        <div style={{ minWidth: 0 }}>
          <div className="al-peek-name">{ent.name}</div>
          <div className="al-peek-type">{typeLabel}{ent.role ? " · " + ent.role : ""}</div>
        </div>
      </div>
      {ent.notes && <div className="al-peek-note">{ent.notes}</div>}
      <div className="al-peek-acts">
        <button className="al-pbtn" onClick={() => onOpen && onOpen(ent)}><Icon name="fileText" style={{ width: 14, height: 14 }} /> Open entry</button>
        <button className="al-pbtn" onClick={() => onFind && onFind(ent)}><Icon name="search" style={{ width: 14, height: 14 }} /> Find mentions{typeof ent.scenes === "number" ? <span className="al-count">{ent.scenes}</span> : null}</button>
      </div>
    </div>
  );
}

Object.assign(window, { alKind, alBuildIndex, alLinkNodes, AutoLink, AutoLinkPeek });
