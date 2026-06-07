/**
 * manuscriptSearchStore — project-wide full-text search across scene prose.
 *
 * Reads scene_docs (base64 Yjs state) via the existing DB; decodes to plaintext
 * using the same extractPlainText helper the editor uses. No new tables.
 *
 * Replace operates via in-place Y.XmlText surgery: each text node's delete+insert
 * at the match offset preserves all surrounding marks (bold/italic/links/autolink).
 * No full-doc rebuild from plain text (the old buildDocFromText approach destroyed
 * all marks — replaced by replaceInDoc).
 *
 * Replace-all auto-snapshots each touched scene before mutation (Undo guarantee).
 */
import * as Y from "yjs";

import { applyEncoded, encodeDoc, extractPlainText, xmlTextToPlain } from "../yjs/serialize";
import { getDb } from "./schema";
import type { SnapshotStore } from "./snapshotStore";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchMatch {
  sceneId: string;
  sceneTitle: string;
  chapterTitle: string;
  chapterId: string;
  /** Character positions of each match in the plaintext. */
  offsets: number[];
  plaintext: string;
}

export interface FindOpts {
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

interface SceneRow {
  id: string;
  title: string;
  folder_id: string | null;
  state_base64: string | null;
}

interface FolderRow {
  id: string;
  title: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type DeltaOp = { insert?: unknown; attributes?: Record<string, unknown> };

function loadDoc(stateBase64: string | null): Y.Doc {
  const doc = new Y.Doc();
  if (stateBase64) applyEncoded(doc, stateBase64);
  return doc;
}

function collectOffsets(text: string, query: string, opts?: FindOpts): number[] {
  const { caseSensitive = false, wholeWord = false } = opts ?? {};
  const flags = caseSensitive ? "gu" : "giu";
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = wholeWord
    ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`
    : escaped;
  try {
    const re = new RegExp(pattern, flags);
    const offsets: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) offsets.push(m.index);
    return offsets;
  } catch {
    return [];
  }
}

/** Return the attributes of the delta run that covers `offset` in the node's plaintext. */
function attrsAt(node: Y.XmlText, offset: number): Record<string, unknown> | undefined {
  let pos = 0;
  for (const op of node.toDelta() as DeltaOp[]) {
    if (typeof op.insert !== "string") continue;
    if (pos + op.insert.length > offset) return op.attributes;
    pos += op.insert.length;
  }
  return undefined;
}

// ── Mark-preserving in-place replace ─────────────────────────────────────────

/**
 * Replace all occurrences of `find` in a single Y.XmlText node without touching
 * surrounding mark attributes. Processes matches in reverse so earlier offsets
 * remain valid after each delete+insert pair.
 */
function replaceInXmlText(node: Y.XmlText, find: string, replace: string, opts?: FindOpts): number {
  // Use toDelta()-based plain text — node.toString() includes XML markup for attributed text.
  const offsets = collectOffsets(xmlTextToPlain(node), find, opts);
  if (offsets.length === 0) return 0;
  for (let i = offsets.length - 1; i >= 0; i--) {
    const attrs = attrsAt(node, offsets[i]);
    node.delete(offsets[i], find.length);
    node.insert(offsets[i], replace, attrs);
  }
  return offsets.length;
}

/**
 * Recursively walk every Y.XmlText leaf in an element (mirrors collectText
 * from serialize.ts), replacing all occurrences of `find` in each text node.
 * Handles arbitrary nesting: paragraph, bulletList > listItem > paragraph, etc.
 */
function replaceInElement(el: Y.XmlElement, find: string, replace: string, opts?: FindOpts): number {
  let count = 0;
  for (let i = 0; i < el.length; i++) {
    const child = el.get(i);
    if (child instanceof Y.XmlText) {
      count += replaceInXmlText(child, find, replace, opts);
    } else if (child instanceof Y.XmlElement) {
      count += replaceInElement(child, find, replace, opts);
    }
  }
  return count;
}

/**
 * Walk every Y.XmlText leaf in the doc's "content" fragment and replace all
 * occurrences of `find` in-place, preserving surrounding marks.
 * All mutations run inside a single Yjs transaction for atomicity.
 */
function replaceInDoc(doc: Y.Doc, find: string, replace: string, opts?: FindOpts): number {
  const frag = doc.getXmlFragment("content");
  let total = 0;
  doc.transact(() => {
    for (let i = 0; i < frag.length; i++) {
      const block = frag.get(i);
      if (block instanceof Y.XmlElement) total += replaceInElement(block, find, replace, opts);
    }
  });
  return total;
}

async function persistDoc(
  db: Awaited<ReturnType<typeof getDb>>,
  sceneId: string,
  doc: Y.Doc,
  plaintext: string,
): Promise<void> {
  const wordCount = plaintext.trim() ? plaintext.trim().split(/\s+/).filter(Boolean).length : 0;
  await db.execute(
    `INSERT INTO scene_docs (scene_id, state_base64, plaintext_projection)
     VALUES ($1, $2, $3)
     ON CONFLICT(scene_id) DO UPDATE SET
       state_base64 = excluded.state_base64,
       plaintext_projection = excluded.plaintext_projection`,
    [sceneId, encodeDoc(doc), plaintext],
  );
  await db.execute("UPDATE scenes SET word_count = $1 WHERE id = $2", [wordCount, sceneId]);
}

// ── Exported functions ────────────────────────────────────────────────────────

/**
 * Search every scene in a project for `query`.
 * Returns grouped results — one SearchMatch per matching scene.
 */
export async function searchManuscript(
  projectId: string,
  query: string,
  opts?: FindOpts,
): Promise<SearchMatch[]> {
  if (!query || query.length < 2) return [];
  const db = await getDb();
  const folders = await db.select<FolderRow[]>(
    "SELECT id, title FROM folders WHERE project_id = $1 ORDER BY sort_order ASC",
    [projectId],
  );
  const scenes = await db.select<SceneRow[]>(
    `SELECT s.id, s.title, s.folder_id, sd.state_base64
     FROM scenes s
     LEFT JOIN scene_docs sd ON sd.scene_id = s.id
     WHERE s.project_id = $1
     ORDER BY s.sort_order ASC`,
    [projectId],
  );
  const folderMap = new Map<string, FolderRow>(folders.map((f) => [f.id, f]));
  const results: SearchMatch[] = [];
  for (const scene of scenes) {
    const plaintext = extractPlainText(loadDoc(scene.state_base64));
    const offsets = collectOffsets(plaintext, query, opts);
    if (offsets.length === 0) continue;
    const folder = scene.folder_id ? folderMap.get(scene.folder_id) : null;
    results.push({
      sceneId: scene.id, sceneTitle: scene.title,
      chapterTitle: folder?.title ?? "Short pieces",
      chapterId: folder?.id ?? "", offsets, plaintext,
    });
  }
  return results;
}

/**
 * Replace all occurrences of `find` in a scene's Yjs doc, preserving inline
 * marks (bold/italic/links). Auto-snapshots the scene before mutating for the
 * Undo guarantee. Returns the number of replacements made.
 *
 * max-params disabled: the acceptance-test contract fixes 4 positional args
 * (sceneId, find, replace, snapshotStore); opts is a genuine 5th concern that
 * cannot be merged without breaking that immutable external contract.
 */
// eslint-disable-next-line max-params
export async function replaceInScene(
  sceneId: string,
  find: string,
  replace: string,
  snapshotStore: SnapshotStore,
  opts?: FindOpts,
): Promise<{ replacedCount: number }> {
  if (!find) return { replacedCount: 0 };
  const db = await getDb();
  const rows = await db.select<{ state_base64: string | null }[]>(
    "SELECT state_base64 FROM scene_docs WHERE scene_id = $1",
    [sceneId],
  );
  const existingBase64 = rows[0]?.state_base64 ?? null;
  const currentDoc = loadDoc(existingBase64);
  const plaintext = extractPlainText(currentDoc);
  const currentWords = plaintext.trim() ? plaintext.trim().split(/\s+/).filter(Boolean).length : 0;
  const count = replaceInDoc(currentDoc, find, replace, opts);
  if (count === 0) return { replacedCount: 0 };
  await snapshotStore.takeSnapshot({
    sceneId, label: null, stateBase64: existingBase64 ?? "", wordCount: currentWords, kind: "auto",
  });
  await persistDoc(db, sceneId, currentDoc, extractPlainText(currentDoc));
  return { replacedCount: count };
}
