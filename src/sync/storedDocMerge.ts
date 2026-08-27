import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import type { BoardDocStore } from "../db/boardDocStore";
import type { ProjectMetaDocStore } from "../db/projectMetaDocStore";
import type { SceneDocStore } from "../db/sceneDocStore";
import { extractPlainText } from "../yjs/serialize";

function mergedUpdate(stored: string | null, incoming: Uint8Array): Uint8Array {
  return stored ? Y.mergeUpdates([toUint8Array(stored), incoming]) : incoming;
}

export async function mergeStoredBoard(
  store: BoardDocStore, id: string, incoming: Uint8Array,
): Promise<void> {
  const merged = mergedUpdate(await store.load(id), incoming);
  await store.save(id, fromUint8Array(merged));
}

export async function mergeStoredMeta(
  store: ProjectMetaDocStore, id: string, incoming: Uint8Array,
): Promise<Uint8Array> {
  const merged = mergedUpdate(await store.load(id), incoming);
  await store.save(id, fromUint8Array(merged));
  return merged;
}

export async function mergeStoredScene(
  store: SceneDocStore,
  updateWordCount: (sceneId: string, count: number) => Promise<void>,
  id: string,
  incoming: Uint8Array,
): Promise<void> {
  const merged = mergedUpdate(await store.load(id), incoming);
  const doc = new Y.Doc();
  Y.applyUpdate(doc, merged);
  const plaintext = extractPlainText(doc);
  await store.save(id, fromUint8Array(merged), plaintext || null);
  await updateWordCount(id, countWords(plaintext));
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}
