import { fromUint8Array } from "js-base64";
import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import type { BoardDocStore } from "../../db/boardDocStore";
import type { ProjectDomainDoc, ProjectDomainDocStore } from "../../db/projectDomainDocStore";
import type { SceneDocStore } from "../../db/sceneDocStore";
import type { BibleApplyTarget } from "../../sync/bible/bibleApplyExec";
import type { BibleProjectionSnapshot } from "../../sync/bible/bibleApplyPlan";
import { buildBibleFromSql } from "../../sync/bible/bibleDoc";
import { SyncEngine, type SyncProvider } from "../../sync/engine";
import { sealMessage } from "../../sync/frameCodec";
import { deriveKeys } from "../../sync/keys";
import type { MetaApplyTarget } from "../../sync/meta/applyExec";
import type { SqlProjectionSnapshot } from "../../sync/meta/applyPlan";
import { buildFromSql } from "../../sync/meta/metaDoc";
import type { ConnectionState } from "../../sync/provider";

const MASTER_KEY = new Uint8Array(32).fill(13);
type Stored = { id: string; stateBase64: string; updatedAt: string | null };

class EmptyDocStore implements SceneDocStore, BoardDocStore {
  async listAll(): Promise<Stored[]> { return []; }
  async load(): Promise<string | null> { return null; }
  async save(): Promise<void> { return; }
  async loadProjection(): Promise<string | null> { return null; }
  async delete(): Promise<void> { return; }
}

class MemoryDomainStore implements ProjectDomainDocStore {
  readonly rows = new Map<string, ProjectDomainDoc>();
  async load(domain: string, projectId: string): Promise<string | null> {
    return this.rows.get(`${domain}:${projectId}`)?.stateBase64 ?? null;
  }
  async save(domain: string, projectId: string, stateBase64: string): Promise<void> {
    this.rows.set(`${domain}:${projectId}`, {
      domain, projectId, stateBase64, updatedAt: new Date().toISOString(),
    });
  }
  async listAll(): Promise<ProjectDomainDoc[]> { return [...this.rows.values()]; }
}

class FakeProvider implements SyncProvider {
  private connection: ((state: ConnectionState) => void) | null = null;
  private frames: ((blob: Uint8Array) => void) | null = null;
  connect(): void { this.connection?.("connected"); }
  destroy(): void { return; }
  send(): void { return; }
  subscribeConnection(cb: (state: ConnectionState) => void): () => void {
    this.connection = cb; cb("disconnected"); return () => undefined;
  }
  subscribeFrames(cb: (blob: Uint8Array) => void): () => void {
    this.frames = cb; return () => undefined;
  }
  receive(blob: Uint8Array): void { this.frames?.(blob); }
}

class OrderedBibleTarget implements BibleApplyTarget {
  constructor(private readonly events: string[]) {}
  async load(): Promise<BibleProjectionSnapshot> {
    return { entities: [], entityTypes: [], fields: [], sceneLinks: [], entityLinks: [], relations: [] };
  }
  async upsertEntity(): Promise<void> { this.events.push("bible-applied"); }
  async upsertEntityType(): Promise<void> { return; }
  async upsertField(): Promise<void> { return; }
  async upsertSceneLink(): Promise<void> { return; }
  async upsertEntityLink(): Promise<void> { return; }
  async upsertRelations(): Promise<void> { return; }
  async delete(): Promise<void> { return; }
}

class OrderedMetaTarget implements MetaApplyTarget {
  constructor(private readonly events: string[]) {}
  async ensureProject(): Promise<void> { this.events.push("meta-start"); }
  async load(): Promise<SqlProjectionSnapshot> {
    await new Promise((resolve) => setTimeout(resolve, 80));
    this.events.push("meta-finish");
    return { folders: [], scenes: [], labels: [], sceneLabels: [] };
  }
  async upsertFolder(): Promise<void> { return; }
  async upsertScene(): Promise<void> { return; }
  async applyLabel(): Promise<void> { return; }
  async delete(): Promise<void> { return; }
  async rewriteSort(): Promise<void> { return; }
}

describe("Bible and meta receive ordering", () => {
  it("finishes a slow meta projection before applying the next-arriving Bible frame", async () => {
    const events: string[] = []; const provider = new FakeProvider();
    const engine = new SyncEngine({
      relayUrl: "wss://relay.test", sceneStore: new EmptyDocStore(),
      boardStore: new EmptyDocStore(), domainDocStore: new MemoryDomainStore(),
      bibleApplyTarget: new OrderedBibleTarget(events), metaApplyTarget: new OrderedMetaTarget(events),
      metaStore: { listAll: async () => [], load: async () => null, save: async () => undefined },
      readMasterKey: async () => MASTER_KEY, getDeviceId: async () => "ordering-device",
      providerFactory: () => provider, updateWordCount: async () => undefined,
    });
    await engine.start();
    const bible = buildBibleFromSql({
      entities: [{ id: "c1", projectId: "p1", storage: "character", entityType: "character",
        name: "Ada", notes: null, aliases: null, excludeFromAi: false }],
      entityTypes: [], fields: [], sceneLinks: [], entityLinks: [], relations: [],
    });
    const meta = buildFromSql({
      project: { id: "p1", title: "Ordered", type: "novel" },
      folders: [], scenes: [], labels: [], sceneLabels: [],
    });
    const key = (await deriveKeys(MASTER_KEY)).encKey;
    provider.receive(await sealMessage(key, {
      t: "diff", c: "meta:p1", u: fromUint8Array(Y.encodeStateAsUpdate(meta)),
    }));
    provider.receive(await sealMessage(key, {
      t: "diff", c: "bible:p1", u: fromUint8Array(Y.encodeStateAsUpdate(bible)),
    }));

    await vi.waitFor(() => expect(events).toContain("bible-applied"));
    expect(events).toEqual(["meta-start", "meta-finish", "bible-applied"]);
    engine.stop();
  });
});
