import * as Y from "yjs";

import type { BinderStore } from "../../db/binderStore";
import type { SceneDocStore } from "../../db/sceneDocStore";
import { encodeDoc } from "../../yjs/serialize";
import type { QuickNote } from "./SqliteQuickNoteStore";

function deriveTitle(body: string): string {
  const first = body.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  if (!first) return "Untitled note";
  return first.length > 60 ? `${first.slice(0, 60)}…` : first;
}

export function noteBodyToSceneDoc(body: string): string {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("content");
  const lines = body.split("\n");
  for (const line of lines) {
    const para = new Y.XmlElement("paragraph");
    const text = new Y.XmlText();
    text.insert(0, line);
    para.insert(0, [text]);
    frag.push([para]);
  }
  return encodeDoc(doc);
}

/**
 * Promote a quick note into a new binder scene (Short pieces), seeded with the
 * note's text, then file the note. Steps run in order createScene → save doc →
 * markFiled so the note is filed LAST: if `save` throws, the worst case is an
 * empty orphan scene the user can delete (the note stays in the inbox); if
 * `markFiled` throws, the scene is intact and the note simply remains unfiled
 * (a re-promote would create a duplicate scene). tauri-plugin-sql exposes no
 * transaction API (plugins-workspace#886), so there is no atomic wrapper — this
 * matches every other multi-store write in the codebase; for a single-user
 * local app the deletable-orphan failure mode is acceptable.
 */
export async function promoteNoteToScene(
  deps: {
    binderStore: BinderStore;
    sceneDocStore: SceneDocStore;
    quickNoteStore: { markFiled(id: string): Promise<void> };
  },
  args: { note: QuickNote; projectId: string }
): Promise<string> {
  const sceneId = await deps.binderStore.createScene({
    projectId: args.projectId,
    folderId: null,
    title: deriveTitle(args.note.body),
  });
  await deps.sceneDocStore.save(
    sceneId,
    noteBodyToSceneDoc(args.note.body),
    args.note.body
  );
  await deps.quickNoteStore.markFiled(args.note.id);
  return sceneId;
}
