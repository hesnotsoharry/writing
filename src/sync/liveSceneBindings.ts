import * as Y from "yjs";

import { SYNC_ORIGIN } from "../yjs/bindPersistence";

export type LiveSceneFlushResult =
  | { status: "flushed" }
  | { status: "timed-out"; pendingLocal: boolean }
  | { status: "unavailable"; pendingLocal: boolean };

export interface EngineLiveScenePort {
  applyRemoteUpdate(update: Uint8Array): Promise<void>;
  flushLocal(): Promise<LiveSceneFlushResult>;
  replaceFromState(stateBase64: string): Promise<void>;
  /** Optional: the engine is about to replace this scene's stored doc wholesale
   *  (epoch catch-up). The port must stop merging editor updates into the store
   *  until its next hydrate — an update built against the stale doc and merged
   *  into the replacement silently drops prose (pending structs) or resurrects
   *  the restored-away content and re-publishes it at the new epoch. */
  noteReplacementPending?(): void;
}

interface LiveDocBinding {
  id: string;
  doc: Y.Doc;
  listener: (update: Uint8Array, origin: unknown) => void;
}

interface LivePortBinding {
  id: string;
  port: EngineLiveScenePort;
}

export class LiveSceneBindings {
  private liveDoc: LiveDocBinding | null = null;
  private livePort: LivePortBinding | null = null;

  attachDoc(sceneId: string, doc: Y.Doc, publish: (update: Uint8Array) => void): void {
    this.clear();
    const listener = (update: Uint8Array, origin: unknown) => {
      if (origin !== SYNC_ORIGIN) publish(update);
    };
    doc.on("update", listener);
    this.liveDoc = { id: sceneId, doc, listener };
  }

  detachDoc(): void {
    if (!this.liveDoc) return;
    this.liveDoc.doc.off("update", this.liveDoc.listener);
    this.liveDoc = null;
  }

  attachPort(sceneId: string, port: EngineLiveScenePort): void {
    this.clear();
    this.livePort = { id: sceneId, port };
  }

  detachPort(port: EngineLiveScenePort): void {
    if (this.livePort?.port === port) this.livePort = null;
  }

  docFor(sceneId: string): Y.Doc | null {
    return this.liveDoc?.id === sceneId ? this.liveDoc.doc : null;
  }

  portFor(sceneId: string): EngineLiveScenePort | null {
    return this.livePort?.id === sceneId ? this.livePort.port : null;
  }

  activeSceneId(): string | null {
    return this.liveDoc?.id ?? this.livePort?.id ?? null;
  }

  async flushAndClose(sceneIds: readonly string[]): Promise<void> {
    const selected = new Set(sceneIds);
    if (this.livePort && selected.has(this.livePort.id)) {
      try { await this.livePort.port.flushLocal(); } catch { /* SQLite remains the boundary. */ }
      // Gate BEFORE the store is replaced: without this, an editor update that
      // arrives between the flush and the epoch replacement merges the stale
      // doc into the replacement (audit P0.1).
      this.livePort.port.noteReplacementPending?.();
      this.livePort = null;
    }
    if (this.liveDoc && selected.has(this.liveDoc.id)) this.detachDoc();
  }

  clear(): void {
    this.detachDoc();
    this.livePort = null;
  }
}
