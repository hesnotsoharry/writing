/**
 * Opt-in end-to-end integration: two real SyncEngines (real RelayProvider, real
 * crypto) against a LIVE relay worker. Skipped unless SYNC_LIVE_RELAY is set —
 * start the relay first:  cd relay-worker && npx wrangler dev --port 8788
 * then:  SYNC_LIVE_RELAY=ws://127.0.0.1:8788 npm run test -- liveRelay
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import type { BoardDocStore } from "../../db/boardDocStore";
import type { SceneDocStore } from "../../db/sceneDocStore";
import { SyncEngine } from "../../sync/engine";
import { generateMasterKey } from "../../sync/keys";
import { RelayProvider } from "../../sync/provider";
import { encodeDoc } from "../../yjs/serialize";

const RELAY_URL = process.env.SYNC_LIVE_RELAY;

class MemoryDocStore implements SceneDocStore, BoardDocStore {
  readonly rows = new Map<string, { stateBase64: string; updatedAt: string | null }>();

  async load(id: string): Promise<string | null> {
    return this.rows.get(id)?.stateBase64 ?? null;
  }
  async save(id: string, base64: string): Promise<void> {
    this.rows.set(id, { stateBase64: base64, updatedAt: new Date().toISOString() });
  }
  async loadProjection(): Promise<string | null> {
    return null;
  }
  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }
  async listAll(): Promise<Array<{ id: string; stateBase64: string; updatedAt: string | null }>> {
    return [...this.rows.entries()].map(([id, r]) => ({ id, ...r }));
  }
}

function sceneDocWithText(text: string): Y.Doc {
  const doc = new Y.Doc();
  const paragraph = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  paragraph.insert(0, [t]);
  doc.getXmlFragment("content").push([paragraph]);
  return doc;
}

function makeEngine(deviceId: string, masterKey: Uint8Array, sceneStore: MemoryDocStore) {
  return new SyncEngine({
    relayUrl: RELAY_URL as string,
    sceneStore,
    boardStore: new MemoryDocStore(),
    readMasterKey: async () => masterKey,
    getDeviceId: async () => deviceId,
    providerFactory: (url, room, device) => new RelayProvider(url, room, device),
    updateWordCount: async () => undefined,
    sweepMs: 2_000,
    saveDebounceMs: 100,
  });
}

async function until(check: () => boolean, ms = 15_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("condition not met in time");
}

describe.runIf(RELAY_URL)("live relay end-to-end", () => {
  it("converges a fresh peer and streams live edits", async () => {
    const masterKey = generateMasterKey();
    const storeA = new MemoryDocStore();
    const storeB = new MemoryDocStore();

    const docA = sceneDocWithText("hello from A");
    await storeA.save("s1", encodeDoc(docA));

    const engineA = makeEngine("device-A", masterKey, storeA);
    const engineB = makeEngine("device-B", masterKey, storeB);
    await engineA.start();
    await engineB.start();

    // Sweep: B (fresh) receives A's full state for s1.
    await until(() => storeB.rows.has("s1"));
    const received = new Y.Doc();
    Y.applyUpdate(received, Uint8Array.from(atob(storeB.rows.get("s1")!.stateBase64), (c) => c.charCodeAt(0)));
    expect(received.getXmlFragment("content").toString()).toContain("hello from A");

    // Live: A opens the scene and types; B's store follows.
    engineA.attachLiveDoc("s1", docA);
    (docA.getXmlFragment("content").get(0) as Y.XmlElement).push([new Y.XmlText(" and more")]);
    await until(() => {
      const row = storeB.rows.get("s1");
      if (!row) return false;
      const d = new Y.Doc();
      Y.applyUpdate(d, Uint8Array.from(atob(row.stateBase64), (c) => c.charCodeAt(0)));
      return d.getXmlFragment("content").toString().includes("and more");
    });

    engineA.stop();
    engineB.stop();
  }, 30_000);
});
