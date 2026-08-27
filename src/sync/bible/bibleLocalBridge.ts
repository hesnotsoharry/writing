import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import type { DbClient } from "../../db/dbClient";
import type { ProjectDomainDocStore } from "../../db/projectDomainDocStore";
import { exclusiveDomainDoc } from "../exclusiveLock";
import { applyBibleSqlDelta, type SqlBibleRows } from "./bibleDoc";
import { loadBibleProjection } from "./dbBibleApplyTarget";

/**
 * THIS MODULE MUST STAY FREE OF PLATFORM IMPORTS.
 *
 * React Native imports `BibleLocalBridge` from here through the portable
 * boundary. It previously also held the desktop convenience wrappers, which
 * imported `../../db/schema` — the Tauri SQL plugin — at module scope. That one
 * import made the whole mobile bundle unresolvable:
 *
 *   Unable to resolve "@tauri-apps/plugin-sql" from "src/db/schema.ts"
 *   mobileBibleLocalBridge -> bibleLocalBridge -> db/schema
 *
 * Nothing caught it. TypeScript resolves the import because the types exist,
 * vitest runs in Node where the package is installed, and lint has no opinion.
 * Only bundling for a device failed — the app could not launch at all.
 *
 * The desktop-bound helpers now live in `desktopBibleBridge.ts`. Anything added
 * here must take its `DbClient` and store by argument.
 */

export type BibleContentListener = (projectId: string, stateBase64: string) => void;
export type BibleDocMutation<T = void> = (doc: Y.Doc, result: T) => void | Promise<void>;

/**
 * Explicit local-write boundary. Remote SQL projection never enters this class,
 * so applying a peer update cannot notify the engine and ping-pong it back.
 */
export class BibleLocalBridge {
  private readonly listeners = new Set<BibleContentListener>();
  constructor(private readonly store: ProjectDomainDocStore) {}

  subscribe(listener: BibleContentListener): () => void {
    this.listeners.add(listener); return () => this.listeners.delete(listener);
  }

  /** Announce content written outside `mutate` (e.g. bootstrap) to subscribers. */
  notify(projectId: string, stateBase64: string): void {
    this.listeners.forEach((listener) => listener(projectId, stateBase64));
  }

  mutate<T>(
    projectId: string, sqlWrite: () => Promise<T>, mutateDoc: BibleDocMutation<T>,
  ): Promise<T> {
    return exclusiveDomainDoc("bible", projectId, async () => {
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
}

export interface BibleLocalWriteDependencies {
  bridge: BibleLocalBridge;
  db: DbClient;
}

/**
 * Platform-neutral local write. Both the bridge and the DbClient are required —
 * there is deliberately no ambient default, because supplying one is what
 * dragged the Tauri singleton into this module. Desktop callers get their
 * defaults from `desktopBibleBridge.ts`.
 */
export function bridgeBibleLocalWriteWith<T>(
  projectId: string, sqlWrite: () => Promise<T>, dependencies: BibleLocalWriteDependencies,
): Promise<T> {
  const { bridge, db } = dependencies;
  let before: SqlBibleRows;
  return bridge.mutate(projectId, async () => {
    before = await loadBibleProjection(db, projectId);
    return sqlWrite();
  }, async (doc) => {
    applyBibleSqlDelta(doc, before, await loadBibleProjection(db, projectId));
  });
}
