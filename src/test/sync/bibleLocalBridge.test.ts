import { toUint8Array } from "js-base64";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import type {
  ProjectDomainDoc, ProjectDomainDocStore,
} from "../../db/projectDomainDocStore";
import { buildBibleFromSql, readBibleDoc, setEntity } from "../../sync/bible/bibleDoc";
import { BibleLocalBridge } from "../../sync/bible/bibleLocalBridge";

class MemoryDomainStore implements ProjectDomainDocStore {
  value: string | null = null;
  events: string[] | null = null;
  async load(): Promise<string | null> { return this.value; }
  async save(_domain: string, _project: string, value: string): Promise<void> {
    this.value = value; this.events?.push("doc");
  }
  async listAll(): Promise<ProjectDomainDoc[]> { return []; }
}

describe("Bible explicit local-write bridge", () => {
  it("writes SQL first, persists the doc, and notifies with full content", async () => {
    const store = new MemoryDomainStore(); const bridge = new BibleLocalBridge(store);
    store.value = btoa(String.fromCharCode(...Y.encodeStateAsUpdate(buildBibleFromSql({
      entities: [], entityTypes: [], fields: [], sceneLinks: [], entityLinks: [], relations: [],
    }))));
    const order: string[] = []; store.events = order; let pushed = "";
    bridge.subscribe((_projectId, content) => { order.push("push"); pushed = content; });
    await bridge.mutate("p1", async () => { order.push("sql"); }, (doc) => setEntity(doc, {
      id: "c1", projectId: "p1", storage: "character", entityType: "character",
      name: "Alice", notes: "Shared prose", aliases: null, excludeFromAi: false,
    }));
    const pushedDoc = new Y.Doc(); Y.applyUpdate(pushedDoc, toUint8Array(pushed));
    expect(order).toEqual(["sql", "doc", "push"]);
    expect(readBibleDoc(pushedDoc).entities[0]?.notes).toBe("Shared prose");
  });

  it("stays inert for an unpaired project after preserving the SQL write", async () => {
    const store = new MemoryDomainStore(); const bridge = new BibleLocalBridge(store);
    let sqlWrites = 0; let pushes = 0; bridge.subscribe(() => { pushes += 1; });
    await bridge.mutate("local-only", async () => { sqlWrites += 1; }, () => undefined);
    expect({ sqlWrites, pushes, doc: store.value }).toEqual({ sqlWrites: 1, pushes: 0, doc: null });
  });
});
