import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import type { DbClient } from "../shared/dbClient";
import { getMobileDb } from "./database";
import { MobileProjectDomainDocStore } from "./syncStores/mobileProjectDomainDocStore";

type Listener = (projectId: string, stateBase64: string) => void;
type BibleDocMutation<T> = (doc: Y.Doc, result: T) => void;
const listeners = new Set<Listener>();
const tails = new Map<string, Promise<void>>();
const deferredDb: DbClient = {
  async select<T>(sql: string, params?: unknown[]): Promise<T> {
    return (await getMobileDb()).select<T>(sql, params);
  },
  async execute(sql: string, params?: unknown[]) {
    return (await getMobileDb()).execute(sql, params);
  },
};
const store = new MobileProjectDomainDocStore(deferredDb);

function exclusive<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
  const prior = tails.get(projectId) ?? Promise.resolve();
  const current = prior.catch(() => undefined).then(operation);
  const tail = current.then(() => undefined, () => undefined);
  tails.set(projectId, tail);
  const clear = (): void => { if (tails.get(projectId) === tail) tails.delete(projectId); };
  void tail.then(clear);
  return current;
}

/** Explicit local boundary: remote mobile projection never calls this, preventing ping-pong. */
export function bridgeMobileBibleLocalWrite<T>(
  projectId: string, sqlWrite: () => Promise<T>, mutateDoc: BibleDocMutation<T>,
): Promise<T> {
  return exclusive(projectId, async () => {
    const result = await sqlWrite();
    const encoded = await store.load("bible", projectId);
    if (encoded === null) return result;
    const doc = new Y.Doc(); Y.applyUpdate(doc, toUint8Array(encoded));
    doc.transact(() => mutateDoc(doc, result), "local-bible-write");
    const content = fromUint8Array(Y.encodeStateAsUpdate(doc));
    await store.save("bible", projectId, content);
    listeners.forEach((listener) => listener(projectId, content));
    return result;
  });
}

/** Supplies full encoded content for immediate engine delivery, never merely a state vector. */
export function subscribeMobileBibleSaves(listener: Listener): () => void {
  listeners.add(listener); return () => listeners.delete(listener);
}
