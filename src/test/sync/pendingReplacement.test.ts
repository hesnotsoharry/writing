import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { InMemorySnapshotStore } from "../../db/inMemorySnapshotStore";
import { runMigrations } from "../../db/migrations";
import { InMemoryProjectMetaDocStore } from "../../db/projectMetaDocStore";
import type { SceneDocStore } from "../../db/sceneDocStore";
import type { TakeSnapshotInput } from "../../db/snapshotStore";
import { SqlitePendingReplacementStore } from "../../db/sqlitePendingReplacementStore";
import type { AppliedEpochStore } from "../../db/syncEpochStore";
import { EpochManager } from "../../sync/epochManager";
import { bumpEpoch, type EpochStamp } from "../../sync/meta/metaDoc";
import { encodeDoc, extractPlainText } from "../../yjs/serialize";
import { makeSqlJsDb } from "../support/sqljsDb";

interface DocRow { id: string; stateBase64: string; updatedAt: string | null }
class MemorySceneStore implements SceneDocStore {
  readonly rows = new Map<string, DocRow>();
  constructor(private readonly events: string[]) {}
  async listAll(): Promise<DocRow[]> { return [...this.rows.values()]; }
  async load(id: string): Promise<string | null> { return this.rows.get(id)?.stateBase64 ?? null; }
  async save(id: string, stateBase64: string): Promise<void> {
    this.events.push("apply"); this.rows.set(id, { id, stateBase64, updatedAt: null });
  }
  async loadProjection(): Promise<string | null> { return null; }
  async delete(id: string): Promise<void> { this.rows.delete(id); }
}
class MemoryEpochStore implements AppliedEpochStore {
  value: Record<string, EpochStamp> = {};
  async load() { return { ...this.value }; }
  async save(value: Record<string, EpochStamp>) { this.value = { ...value }; }
}
class EventSnapshots extends InMemorySnapshotStore {
  constructor(private readonly events: string[]) { super(); }
  override async takeSnapshot(input: TakeSnapshotInput) {
    this.events.push("snapshot"); return super.takeSnapshot(input);
  }
}

function textDoc(text: string): Y.Doc {
  const doc = new Y.Doc(); const paragraph = new Y.XmlElement("paragraph");
  const value = new Y.XmlText(); value.insert(0, text); paragraph.push([value]);
  doc.getXmlFragment("content").push([paragraph]); return doc;
}
function decodedText(stateBase64: string): string {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Uint8Array.from(atob(stateBase64), (char) => char.charCodeAt(0)));
  return extractPlainText(doc);
}

describe("manual pending epoch replacements", () => {
  it("stages durably, snapshots first, and applies after restart", async () => {
    const db = await makeSqlJsDb(); await runMigrations(db);
    const events: string[] = []; const scenes = new MemorySceneStore(events);
    const snapshots = new EventSnapshots(events); const epochs = new MemoryEpochStore();
    const pending = new SqlitePendingReplacementStore(db);
    const metas = new InMemoryProjectMetaDocStore(); const meta = new Y.Doc();
    bumpEpoch(meta, "s1", "owner"); await metas.save("p1", encodeDoc(meta));
    scenes.rows.set("s1", { id: "s1", stateBase64: encodeDoc(textDoc("local divergence")),
      updatedAt: null });
    const options = { sceneStore: scenes, snapshotStore: snapshots, epochStore: epochs,
      pendingReplacementStore: pending, epochAcceptance: "manual" as const,
      updateWordCount: async () => undefined };
    try {
      const first = new EpochManager(options); await first.initialize("mobile", metas);
      const replacement = encodeDoc(textDoc("owner replacement"));
      expect(await first.handleBehindFrame("s1", {
        t: "diff", c: "scene:s1", e: 1, u: replacement,
      }, null)).toBe("staged");
      expect(decodedText((await scenes.load("s1"))!)).toBe("local divergence");

      const restarted = new EpochManager(options); await restarted.initialize("mobile", metas);
      expect(restarted.listBehind()[0]).toMatchObject({ replacementReady: true });
      await expect(restarted.applyPending()).rejects.toThrow("must be snapshotted first");
      const refs = await restarted.snapshotPending();
      expect(refs).toHaveLength(1);
      expect(await restarted.applyPending()).toEqual(["s1"]);
      expect(events.slice(-2)).toEqual(["snapshot", "apply"]);
      expect(decodedText((await scenes.load("s1"))!)).toBe("owner replacement");
      expect(epochs.value.s1).toEqual({ n: 1, d: "owner" });
      expect(await pending.list()).toHaveLength(0);
    } finally { db.close(); }
  });
});
