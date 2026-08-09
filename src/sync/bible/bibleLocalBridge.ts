import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import type { DbClient } from "../../db/dbClient";
import type { ProjectDomainDocStore } from "../../db/projectDomainDocStore";
import { getDb } from "../../db/schema";
import { SqliteProjectDomainDocStore } from "../../db/sqliteProjectDomainDocStore";
import { getSyncRole } from "../syncRole";
import { applyBibleSqlDelta, buildBibleFromSql, type SqlBibleRows } from "./bibleDoc";
import { loadBibleProjection } from "./dbBibleApplyTarget";

export type BibleContentListener = (projectId: string, stateBase64: string) => void;
export type BibleDocMutation<T = void> = (doc: Y.Doc, result: T) => void | Promise<void>;

/**
 * Explicit local-write boundary. Remote SQL projection never enters this class,
 * so applying a peer update cannot notify the engine and ping-pong it back.
 */
export class BibleLocalBridge {
  private readonly tails = new Map<string, Promise<void>>();
  private readonly listeners = new Set<BibleContentListener>();
  constructor(private readonly store: ProjectDomainDocStore) {}

  subscribe(listener: BibleContentListener): () => void {
    this.listeners.add(listener); return () => this.listeners.delete(listener);
  }

  mutate<T>(
    projectId: string, sqlWrite: () => Promise<T>, mutateDoc: BibleDocMutation<T>,
  ): Promise<T> {
    return this.exclusive(projectId, async () => {
      const result = await sqlWrite();
      const encoded = await this.store.load("bible", projectId);
      if (encoded === null) return result; // Unpaired projects remain SQL-only and behavior-identical.
      const doc = new Y.Doc(); Y.applyUpdate(doc, toUint8Array(encoded));
      await mutateDoc(doc, result);
      const stateBase64 = fromUint8Array(Y.encodeStateAsUpdate(doc));
      await this.store.save("bible", projectId, stateBase64);
      // The callback carries CONTENT, not a state vector. The engine must send it immediately.
      this.listeners.forEach((listener) => listener(projectId, stateBase64));
      return result;
    });
  }

  private exclusive<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
    const prior = this.tails.get(projectId) ?? Promise.resolve();
    const current = prior.catch(() => undefined).then(operation);
    const tail = current.then(() => undefined, () => undefined);
    this.tails.set(projectId, tail);
    const clear = (): void => { if (this.tails.get(projectId) === tail) this.tails.delete(projectId); };
    void tail.then(clear);
    return current;
  }
}

const desktopBridge = new BibleLocalBridge(new SqliteProjectDomainDocStore());

export interface BibleLocalWriteDependencies {
  bridge: BibleLocalBridge;
  db: DbClient;
}

export function subscribeBibleSaves(listener: BibleContentListener): () => void {
  return desktopBridge.subscribe(listener);
}

export function bridgeBibleLocalWrite<T>(
  projectId: string, sqlWrite: () => Promise<T>, dependencies?: BibleLocalWriteDependencies,
): Promise<T> {
  const bridge = dependencies?.bridge ?? desktopBridge;
  const dbPromise = dependencies?.db ? Promise.resolve(dependencies.db) : getDb();
  let before: SqlBibleRows;
  return bridge.mutate(projectId, async () => {
    const db = await dbPromise; before = await loadBibleProjection(db, projectId);
    return sqlWrite();
  }, async (doc) => {
    applyBibleSqlDelta(doc, before, await loadBibleProjection(await dbPromise, projectId));
  });
}

export async function bootstrapProjectBible(projectId: string): Promise<void> {
  const store = new SqliteProjectDomainDocStore();
  if (await store.load("bible", projectId)) return;
  const doc = buildBibleFromSql(await loadBibleProjection(await getDb(), projectId));
  await store.save("bible", projectId, fromUint8Array(Y.encodeStateAsUpdate(doc)));
}

/** Bootstrap only the origin's local projects; joined devices learn docs from their peer. */
export async function ensureAllProjectBibles(): Promise<void> {
  if (await getSyncRole() === "joined") return;
  const db = await getDb();
  const projects = await db.select<Array<{ id: string }>>("SELECT id FROM projects");
  await Promise.all(projects.map(({ id }) => bootstrapProjectBible(id)));
}
