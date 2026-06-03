/* Pure, immutable tree operations for the binder. */

function findScene(tree, id) {
  for (const c of tree.chapters) {
    const s = c.scenes.find(x => x.id === id);
    if (s) return { scene: s, chapterTitle: c.title };
  }
  const s = tree.shortPieces.find(x => x.id === id);
  return s ? { scene: s, chapterTitle: "Short pieces" } : null;
}

function mapScene(tree, id, fn) {
  return {
    chapters: tree.chapters.map(c => ({ ...c, scenes: c.scenes.map(s => s.id === id ? fn(s) : s) })),
    shortPieces: tree.shortPieces.map(s => s.id === id ? fn(s) : s),
  };
}

function removeScene(tree, id) {
  let removed = null, from = null;
  const chapters = tree.chapters.map(c => ({
    ...c, scenes: c.scenes.filter(s => { if (s.id === id) { removed = s; from = c.id; return false; } return true; }),
  }));
  const shortPieces = tree.shortPieces.filter(s => { if (s.id === id) { removed = s; from = "short"; return false; } return true; });
  return { tree: { chapters, shortPieces }, removed, from };
}

function duplicateScene(tree, id) {
  const nid = "s-" + Date.now();
  let copy = null;
  const chapters = tree.chapters.map(c => {
    const idx = c.scenes.findIndex(s => s.id === id);
    if (idx < 0) return c;
    copy = { ...c.scenes[idx], id: nid, title: c.scenes[idx].title + " copy" };
    const scenes = [...c.scenes]; scenes.splice(idx + 1, 0, copy);
    return { ...c, scenes };
  });
  let shortPieces = tree.shortPieces;
  if (!copy) {
    const idx = tree.shortPieces.findIndex(s => s.id === id);
    if (idx >= 0) {
      copy = { ...tree.shortPieces[idx], id: nid, title: tree.shortPieces[idx].title + " copy" };
      shortPieces = [...tree.shortPieces]; shortPieces.splice(idx + 1, 0, copy);
    }
  }
  return { tree: { chapters, shortPieces }, id: nid };
}

function addScene(tree, chapterId) {
  const id = "s-" + Date.now();
  const scene = { id, title: "Untitled scene", words: 0, status: "blank", synopsis: "", characters: [], locations: [] };
  if (chapterId) {
    return { tree: { ...tree, chapters: tree.chapters.map(c => c.id === chapterId ? { ...c, scenes: [...c.scenes, scene] } : c) }, id };
  }
  return { tree: { ...tree, shortPieces: [...tree.shortPieces, scene] }, id };
}

function addChapter(tree) {
  const id = "ch-" + Date.now();
  return { tree: { ...tree, chapters: [...tree.chapters, { id, title: "New chapter", words: 0, scenes: [] }] }, id };
}

function mapChapter(tree, id, fn) {
  return { ...tree, chapters: tree.chapters.map(c => c.id === id ? fn(c) : c) };
}

/** Delete a chapter — never lose prose: its scenes move to Short pieces. */
function deleteChapter(tree, id) {
  const ch = tree.chapters.find(c => c.id === id);
  if (!ch) return { tree, moved: 0 };
  return {
    tree: { chapters: tree.chapters.filter(c => c.id !== id), shortPieces: [...tree.shortPieces, ...ch.scenes] },
    moved: ch.scenes.length,
  };
}

/** Archive a chapter — removes it (and scenes) entirely; returns them for the archive bin. */
function archiveChapter(tree, id) {
  const ch = tree.chapters.find(c => c.id === id);
  return { tree: { ...tree, chapters: tree.chapters.filter(c => c.id !== id) }, chapter: ch };
}

Object.assign(window, {
  findScene, mapScene, removeScene, duplicateScene, addScene, addChapter,
  mapChapter, deleteChapter, archiveChapter,
});
