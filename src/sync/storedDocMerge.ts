import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import type { BoardDocStore } from "../db/boardDocStore";
import type { SceneDocStore } from "../db/sceneDocStore";
import { extractPlainText } from "../yjs/serialize";

export async function mergeStoredBoard(
  store: BoardDocStore, id: string, incoming: Uint8Array,
): Promise<void> {
  const stored = await store.load(id);
  const merged = stored ? Y.mergeUpdates([toUint8Array(stored), incoming]) : incoming;
  await store.save(id, fromUint8Array(merged));
}

export async function mergeStoredScene(
  store: SceneDocStore,
  updateWordCount: (sceneId: string, count: number) => Promise<void>,
  id: string,
  incoming: Uint8Array,
): Promise<void> {
  const stored = await store.load(id);
  const merged = stored ? Y.mergeUpdates([toUint8Array(stored), incoming]) : incoming;
  const doc = new Y.Doc();
  Y.applyUpdate(doc, merged);
  const plaintext = extractPlainText(doc);
  await store.save(id, fromUint8Array(merged), plaintext || null);
  await updateWordCount(id, countWords(plaintext));
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}
