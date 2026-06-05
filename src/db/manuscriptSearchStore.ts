/**
 * manuscriptSearchStore — project-wide full-text search across scene prose.
 *
 * Reads scene_docs (base64 Yjs state) via the existing DB; decodes to plaintext
 * using the same extractPlainText helper the editor uses. No new tables.
 *
 * Plaintext extraction uses Y.Doc + getXmlFragment("content") — the same key
 * TipTap Collaboration writes to (confirmed in src/yjs/serialize.ts).
 *
 * Replace-all auto-snapshots each touched scene before mutation (Undo guarantee).
 */
import * as Y from "yjs";

import { applyEncoded, encodeDoc, extractPlainText } from "../yjs/serialize";
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

function collectOffsets(text: string, query: string): number[] {
  const needle = query.toLowerCase();
  const haystack = text.toLowerCase();
  const offsets: number[] = [];
  let pos = 0;
  while (pos < haystack.length) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) break;
    offsets.push(idx);
    pos = idx + needle.length;
  }
  return offsets;
}

function loadDoc(stateBase64: string | null): Y.Doc {
  const doc = new Y.Doc();
  if (stateBase64) applyEncoded(doc, stateBase64);
  return doc;
}

// ── Replace helpers ───────────────────────────────────────────────────────────

interface ReplaceResult { text: string; count: number }

function applyReplacements(plaintext: string, find: string, replace: string): ReplaceResult {
  const needle = find.toLowerCase();
  const haystack = plaintext.toLowerCase();
  let count = 0;
  let result = "";
  let pos = 0;
  while (pos < haystack.length) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) { result += plaintext.slice(pos); break; }
    result += plaintext.slice(pos, idx) + replace;
    count++;
    pos = idx + find.length;
  }
  return { text: result, count };
}

function buildDocFromText(replacedText: string): Y.Doc {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("content");
  const lines = replacedText.split("\n");
  for (const line of lines) {
    const para = new Y.XmlElement("paragraph");
    if (line.length > 0) {
      const txt = new Y.XmlText();
      txt.insert(0, line);
      para.insert(0, [txt]);
    }
    frag.push([para]);
  }
  return doc;
}

async function persistMutatedDoc(
  db: Awaited<ReturnType<typeof getDb>>,
  sceneId: string,
  newText: string,
): Promise<void> {
  const newDoc = buildDocFromText(newText);
  const newBase64 = encodeDoc(newDoc);
  const wordCount = newText.trim() ? newText.trim().split(/\s+/).filter(Boolean).length : 0;
  await db.execute(
    `INSERT INTO scene_docs (scene_id, state_base64, plaintext_projection)
     VALUES ($1, $2, $3)
     ON CONFLICT(scene_id) DO UPDATE SET
       state_base64 = excluded.state_base64,
       plaintext_projection = excluded.plaintext_projection`,
    [sceneId, newBase64, newText],
  );
  await db.execute("UPDATE scenes SET word_count = $1 WHERE id = $2", [wordCount, sceneId]);
}

// ── Exported functions ────────────────────────────────────────────────────────

/**
 * Search every scene in a project for `query` (case-insensitive).
 * Returns grouped results — one SearchMatch per matching scene.
 */
export async function searchManuscript(
  projectId: string,
  query: string,
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
    const doc = loadDoc(scene.state_base64);
    const plaintext = extractPlainText(doc);
    const offsets = collectOffsets(plaintext, query);
    if (offsets.length === 0) continue;

    const folder = scene.folder_id ? folderMap.get(scene.folder_id) : null;
    results.push({
      sceneId: scene.id,
      sceneTitle: scene.title,
      chapterTitle: folder?.title ?? "Short pieces",
      chapterId: folder?.id ?? "",
      offsets,
      plaintext,
    });
  }

  return results;
}

/**
 * Replace all occurrences of `find` in a scene's Yjs doc (case-insensitive).
 * Auto-snapshots the scene before mutating (Undo guarantee).
 * Returns the number of replacements made.
 */
export async function replaceInScene(
  sceneId: string,
  find: string,
  replace: string,
  snapshotStore: SnapshotStore,
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
  const currentWords = plaintext.trim().split(/\s+/).filter(Boolean).length;

  const { text: mutated, count } = applyReplacements(plaintext, find, replace);
  if (count === 0) return { replacedCount: 0 };

  // Auto-snapshot current state before mutating (Undo guarantee).
  await snapshotStore.takeSnapshot({ sceneId, label: null, stateBase64: existingBase64 ?? "", wordCount: currentWords, kind: "auto" });

  await persistMutatedDoc(db, sceneId, mutated);
  return { replacedCount: count };
}
