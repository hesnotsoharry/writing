/* App — state, tree mutations, context menus, toasts, overlays, Tweaks. */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": ["#b25a38", "#99492b", "#f1e2d8"],
  "proseFont": "Literata",
  "proseSize": 19,
  "goalsOn": true,
  "motion": true,
  "lineSpacing": "normal",
  "editorWidth": "normal",
  "spellcheck": true,
  "smartQuotes": true,
  "typewriter": false,
  "defaultStatus": "blank",
  "confirmDelete": true,
  "reopenLast": true,
  "backupDest": "Cloudflare R2",
  "backupFreq": "save"
}/*EDITMODE-END*/;

const LINE_SPACING = { cozy: "1.55", normal: "1.75", relaxed: "2.05" };
const EDITOR_WIDTH = { narrow: "32rem", normal: "38rem", wide: "46rem" };

const PROSE_FONTS = {
  "Literata": '"Literata", Georgia, serif',
  "Newsreader": '"Newsreader", Georgia, serif',
  "Source Serif": '"Source Serif 4", Georgia, serif',
  "iA Mono": '"IBM Plex Mono", ui-monospace, monospace',
};

function rgbOf(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(",");
}

function flattenScenes(tree) {
  const map = {};
  tree.chapters.forEach(ch => ch.scenes.forEach(s => { map[s.id] = { ...s, chapterTitle: ch.title }; }));
  tree.shortPieces.forEach(s => { map[s.id] = { ...s, chapterTitle: "Short pieces" }; });
  return map;
}

function statusSubmenu(scene, setStatus) {
  return STATUS_ORDER.map(key => ({
    swatch: STATUS_META[key].dot, label: STATUS_META[key].label,
    tick: scene.status === key, onClick: () => setStatus(scene.id, key),
  }));
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = React.useState("write");
  const [trees, setTrees] = React.useState(TREES);
  const [activeProject, setActiveProject] = React.useState("p-salt");
  const [activeId, setActiveId] = React.useState("s-1");
  const [focus, setFocus] = React.useState(false);
  const [overlay, setOverlay] = React.useState(null);
  const [goalsOn, setGoalsOn] = React.useState(t.goalsOn);
  const [quickNotes, setQuickNotes] = React.useState(QUICK_NOTES);
  const [chars, setChars] = React.useState(CHARACTERS);
  const [locs, setLocs] = React.useState(LOCATIONS);
  const [menu, setMenu] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [renaming, setRenaming] = React.useState(null);
  const [archived, setArchived] = React.useState([]);
  const [entryStack, setEntryStack] = React.useState([]);   // [{ id, kind }] — full-entry nav stack
  const [entryOrigin, setEntryOrigin] = React.useState("bible"); // "bible" | "write" — where the journey began
  const [entryEdits, setEntryEdits] = React.useState({});   // per-entity field overrides

  const tree = trees[activeProject];
  const scenes = flattenScenes(tree);
  const scene = scenes[activeId] || Object.values(scenes)[0];
  const accentHex = Array.isArray(t.accent) ? t.accent[0] : t.accent;
  const sessionWords = 320, sessionTarget = 500;
  const projMeta = PROJECTS.find(p => p.id === activeProject) || PROJECTS[0];

  // ---- theme + tokens
  React.useEffect(() => {
    const root = document.documentElement;
    const resolved = t.theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : t.theme;
    root.setAttribute("data-theme", resolved);
    const pal = Array.isArray(t.accent) ? t.accent : [accentHex, accentHex];
    const rgb = rgbOf(accentHex);
    root.style.setProperty("--accent", accentHex);
    root.style.setProperty("--accent-deep", pal[1] || accentHex);
    root.style.setProperty("--accent-tint", `rgba(${rgb},0.15)`);
    root.style.setProperty("--accent-wash", `rgba(${rgb},0.10)`);
    root.style.setProperty("--accent-ring", `rgba(${rgb},0.30)`);
    root.style.setProperty("--selection", `rgba(${rgb},0.16)`);
    root.style.setProperty("--character", accentHex);
    root.style.setProperty("--character-tint", `rgba(${rgb},0.15)`);
    root.style.setProperty("--font-prose", PROSE_FONTS[t.proseFont] || PROSE_FONTS.Literata);
    root.style.setProperty("--prose-size", t.proseSize + "px");
    root.style.setProperty("--prose-leading", LINE_SPACING[t.lineSpacing] || "1.75");
    root.style.setProperty("--prose-measure", EDITOR_WIDTH[t.editorWidth] || "38rem");
  }, [t.theme, accentHex, t.proseFont, t.proseSize, t.lineSpacing, t.editorWidth]);

  React.useEffect(() => { setGoalsOn(t.goalsOn); }, [t.goalsOn]);

  React.useEffect(() => {
    function onKey(e) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setOverlay(o => o === "quick" ? null : "quick"); }
      else if (mod && e.key === ".") { e.preventDefault(); setFocus(f => !f); }
      else if (mod && e.key.toLowerCase() === "e") { e.preventDefault(); setOverlay("export"); }
      else if (mod && e.key === ",") { e.preventDefault(); setOverlay("settings"); }
      else if (e.key === "Escape") { setOverlay(null); setFocus(false); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- tree mutation helpers
  const setTree = fn => setTrees(prev => ({ ...prev, [activeProject]: fn(prev[activeProject]) }));
  const snapshot = () => trees[activeProject];
  function withUndo(label, prevTree, nextTree, extraRestore) {
    setTrees(prev => ({ ...prev, [activeProject]: nextTree }));
    setToast({ label, undo: true, _restore: () => { setTrees(prev => ({ ...prev, [activeProject]: prevTree })); extraRestore && extraRestore(); } });
  }

  const rename = (kind, id, title) => {
    setTree(tr => kind === "chapter" ? mapChapter(tr, id, c => ({ ...c, title })) : mapScene(tr, id, s => ({ ...s, title })));
    setRenaming(null);
  };
  const setStatus = (id, status) => setTree(tr => mapScene(tr, id, s => ({ ...s, status })));

  function deleteScene(id) {
    const prev = snapshot();
    const { tree: nt, removed } = removeScene(prev, id);
    if (activeId === id) { const first = nt.chapters[0]?.scenes[0] || nt.shortPieces[0]; setActiveId(first ? first.id : null); }
    withUndo(`Deleted “${removed.title}”`, prev, nt);
  }
  function archiveScene(id) {
    const prev = snapshot();
    const { tree: nt, removed } = removeScene(prev, id);
    setArchived(a => [{ id, kind: "scene", title: removed.title, sub: removed.words ? removed.words.toLocaleString() + " words" : "empty", _data: removed }, ...a]);
    if (activeId === id) { const first = nt.chapters[0]?.scenes[0] || nt.shortPieces[0]; setActiveId(first ? first.id : null); }
    withUndo(`Archived “${removed.title}”`, prev, nt, () => setArchived(a => a.filter(x => x.id !== id)));
  }
  function deleteChap(id) {
    const prev = snapshot();
    const { tree: nt, moved } = deleteChapter(prev, id);
    withUndo(moved ? `Chapter deleted · ${moved} scene${moved > 1 ? "s" : ""} → Short pieces` : "Chapter deleted", prev, nt);
  }
  function archiveChap(id) {
    const prev = snapshot();
    const { tree: nt, chapter } = archiveChapter(prev, id);
    setArchived(a => [{ id, kind: "chapter", title: chapter.title, sub: chapter.scenes.length + " scenes", _data: chapter }, ...a]);
    withUndo(`Archived “${chapter.title}”`, prev, nt, () => setArchived(a => a.filter(x => x.id !== id)));
  }
  function dupScene(id) { const { tree: nt, id: nid } = duplicateScene(snapshot(), id); setTree(() => nt); setActiveId(nid); }
  function addSceneTo(chapterId) { const { tree: nt, id } = addScene(snapshot(), chapterId); setTree(() => nt); setActiveId(id); setRenaming(id); }
  function addChap() { const { tree: nt, id } = addChapter(snapshot()); setTree(() => nt); setRenaming(id); }

  // ---- archive bin actions
  function restoreItem(id) {
    const it = archived.find(x => x.id === id); if (!it) return;
    setArchived(a => a.filter(x => x.id !== id));
    if (it.kind === "chapter") setTree(tr => ({ ...tr, chapters: [...tr.chapters, it._data] }));
    else setTree(tr => ({ ...tr, shortPieces: [...tr.shortPieces, it._data] }));
    setToast({ label: `Restored “${it.title}”` });
  }
  const purgeItem = id => setArchived(a => a.filter(x => x.id !== id));

  // ---- quick notes
  function saveNote(body) { if (body.trim()) setQuickNotes(n => [{ id: "qn-" + Date.now(), body: body.trim(), when: "just now" }, ...n]); setOverlay(null); }
  const editNote = (id, body) => setQuickNotes(n => n.map(x => x.id === id ? { ...x, body } : x));
  const deleteNote = id => { setQuickNotes(n => n.filter(x => x.id !== id)); setToast({ label: "Note deleted" }); };
  function promoteNote(id) {
    const note = quickNotes.find(x => x.id === id); if (!note) return;
    const { tree: nt, id: sid } = addScene(snapshot(), null);
    setTree(() => mapScene(nt, sid, s => ({ ...s, title: note.body.slice(0, 40), synopsis: note.body })));
    setQuickNotes(n => n.filter(x => x.id !== id));
    setOverlay(null); setView("write"); setActiveId(sid);
    setToast({ label: "Promoted to a short piece" });
  }

  // ---- entities
  function createEntity(kind) {
    const id = "e-" + Date.now();
    const base = { id, name: kind === "Character" ? "New character" : "New location", initial: "•", scenes: 0, notes: "" };
    const ent = kind === "Character" ? { ...base, role: "", color: "character" } : { ...base, color: "location" };
    (kind === "Character" ? setChars : setLocs)(a => [...a, ent]);
    return ent;
  }
  // Rename the entity AND every scene link that referenced it by name (links are
  // name-based in this prototype), and refresh the monogram initial.
  const renameEntity = (kind, id, name) => {
    const list = kind === "Character" ? chars : locs;
    const cur = list.find(e => e.id === id);
    const oldName = cur ? cur.name : null;
    const initial = (name.trim()[0] || (cur && cur.initial) || "•").toUpperCase();
    (kind === "Character" ? setChars : setLocs)(arr => arr.map(e => e.id === id ? { ...e, name, initial } : e));
    if (oldName && oldName !== name) {
      const field = kind === "Character" ? "characters" : "locations";
      const fix = s => ({ ...s, [field]: (s[field] || []).map(n => n === oldName ? name : n) });
      setTrees(prev => {
        const out = {};
        for (const pid in prev) out[pid] = { ...prev[pid], chapters: prev[pid].chapters.map(c => ({ ...c, scenes: c.scenes.map(fix) })), shortPieces: prev[pid].shortPieces.map(fix) };
        return out;
      });
    }
    setRenaming(null);
  };
  const deleteEntity = (kind, id) => { (kind === "Character" ? setChars : setLocs)(arr => arr.filter(e => e.id !== id)); setToast({ label: "Entity removed" }); };
  function addEntity(kind) { const ent = createEntity(kind); setView("bible"); setRenaming(ent.id); }

  // ---- full entry
  function openEntry(entity, kind) {           // fresh journey from a top-level view
    setEntryOrigin(view === "write" ? "write" : "bible");
    setEntryStack([{ id: entity.id, kind }]);
    setView("entry");
  }
  function pushEntry(entity, kind) { setEntryStack(prev => [...prev, { id: entity.id, kind }]); } // drill deeper
  function entryBack() {
    if (entryStack.length > 1) setEntryStack(prev => prev.slice(0, -1));
    else setView(entryOrigin);
  }
  function exitEntry() { setView(entryOrigin); setEntryStack([]); }
  function linkSceneEntity(kind, entity) {     // link an existing entity to the open scene
    const field = kind === "Character" ? "characters" : "locations";
    setTree(tr => mapScene(tr, activeId, s => ({ ...s, [field]: (s[field] || []).includes(entity.name) ? s[field] : [...(s[field] || []), entity.name] })));
  }
  function addSceneEntity(kind) {              // create a NEW entity, link to scene, open its full entry
    const ent = createEntity(kind);
    const field = kind === "Character" ? "characters" : "locations";
    setTree(tr => mapScene(tr, activeId, s => ({ ...s, [field]: [...(s[field] || []), ent.name] })));
    setEntryOrigin("write"); setEntryStack([{ id: ent.id, kind }]); setView("entry"); setRenaming(ent.id);
  }
  function addRelatedEntity(fromId, currentPeople) { // create a NEW character, link to current entry, drill in
    const ent = createEntity("Character");
    patchEntry(fromId, { people: [...currentPeople, { id: ent.id, relation: "" }] });
    setEntryStack(prev => [...prev, { id: ent.id, kind: "Character" }]); setRenaming(ent.id);
  }
  function patchEntry(id, patch) {
    setEntryEdits(prev => {
      const cur = prev[id] || {};
      const next = { ...cur };
      if (patch.facts) next.facts = { ...(cur.facts || {}), ...patch.facts };
      if (patch.sections) next.sections = { ...(cur.sections || {}), ...patch.sections };
      if (patch.people) next.people = patch.people;
      return { ...prev, [id]: next };
    });
  }

  // ---- render
  const entry = entryStack[entryStack.length - 1] || null;
  return <AppShell {...{
    t, setTweak, view, setView, tree, scenes, scene, activeId, setActiveId, focus, setFocus,
    overlay, setOverlay, goalsOn, setGoalsOn, quickNotes, chars, locs, menu, setMenu, toast, setToast,
    renaming, setRenaming, archived, projMeta, accentHex, sessionWords, sessionTarget,
    entry, entryOrigin, entryEdits,
    actions: { rename, setStatus, deleteScene, archiveScene, deleteChap, archiveChap, dupScene, addSceneTo,
      addChap, restoreItem, purgeItem, saveNote, editNote, deleteNote, promoteNote, renameEntity, deleteEntity, addEntity,
      openEntry, pushEntry, entryBack, exitEntry, patchEntry, linkSceneEntity, addSceneEntity, addRelatedEntity,
      switchProject: id => { setActiveProject(id); const ft = flattenScenes(trees[id]); const f = trees[id].chapters[0]?.scenes[0] || trees[id].shortPieces[0]; setActiveId(f ? f.id : null); setView("write"); },
      newProject: () => setToast({ label: "New manuscript — wired in the real app" }) },
  }} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
