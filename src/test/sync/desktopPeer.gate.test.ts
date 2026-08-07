/**
 * S4 emulator-gate serving peer — NOT part of any suite. Runs only when
 * DESKTOP_PEER_KEY (a pairing string) and SYNC_LIVE_RELAY are set. Acts as the
 * "desktop" side for ~2 minutes so a freshly paired phone can clone from it:
 * serves one project (folder + two scenes), then streams a live edit midway.
 *   SYNC_LIVE_RELAY=ws://127.0.0.1:8788 DESKTOP_PEER_KEY=<43-chars> \
 *     npx vitest run desktopPeer.gate
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import type { BoardDocStore } from "../../db/boardDocStore";
import { InMemoryProjectMetaDocStore } from "../../db/projectMetaDocStore";
import type { SceneDocStore } from "../../db/sceneDocStore";
import { SyncEngine } from "../../sync/engine";
import { decodeMasterKey } from "../../sync/keys";
import { buildFromSql } from "../../sync/meta/metaDoc";
import { RelayProvider } from "../../sync/provider";
import { encodeDoc } from "../../yjs/serialize";

const RELAY_URL = process.env.SYNC_LIVE_RELAY;
const PEER_KEY = process.env.DESKTOP_PEER_KEY;

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

function sceneDoc(text: string): Y.Doc {
  const doc = new Y.Doc();
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  doc.getXmlFragment("content").push([p]);
  return doc;
}

describe.runIf(RELAY_URL && PEER_KEY)("S4 gate desktop peer", () => {
  it("serves a project for the emulator to clone", async () => {
    const masterKey = decodeMasterKey(PEER_KEY as string);
    const sceneStore = new MemoryDocStore();
    const metaStore = new InMemoryProjectMetaDocStore();

    const opening = sceneDoc(
      "The gate test begins at dusk. A phone, an emulator, and a relay walk into a room."
    );
    const river = sceneDoc("The river scene holds steady while the clone completes.");
    await sceneStore.save("gate-s1", encodeDoc(opening));
    await sceneStore.save("gate-s2", encodeDoc(river));

    const meta = buildFromSql({
      project: { id: "gate-p1", title: "Salt Road (Gate)", type: "novel" },
      folders: [{ id: "gate-f1", project_id: "gate-p1", title: "Chapter One", sort_order: 1000 }],
      scenes: [
        { id: "gate-s1", project_id: "gate-p1", folder_id: "gate-f1", title: "Opening",
          synopsis: "Dusk, and a test begins.", status: "draft", sort_order: 1000 },
        { id: "gate-s2", project_id: "gate-p1", folder_id: "gate-f1", title: "The River",
          synopsis: null, status: "blank", sort_order: 2000 },
      ],
      labels: [], sceneLabels: [],
    });
    await metaStore.save("gate-p1", encodeDoc(meta));

    const engine = new SyncEngine({
      relayUrl: RELAY_URL as string,
      sceneStore,
      boardStore: new MemoryDocStore(),
      metaStore,
      readMasterKey: async () => masterKey,
      getDeviceId: async () => "gate-desktop-peer",
      providerFactory: (url, room, device) => new RelayProvider(url, room, device),
      updateWordCount: async () => undefined,
      sweepMs: 5_000,
      saveDebounceMs: 200,
    });
    await engine.start();

    // Serve for 60s, stream a live edit, serve another 60s.
    await new Promise((r) => setTimeout(r, 60_000));
    engine.attachLiveDoc("gate-s1", opening);
    (opening.getXmlFragment("content").get(0) as Y.XmlElement).push([
      new Y.XmlText(" LIVE UPDATE LANDED."),
    ]);
    await sceneStore.save("gate-s1", encodeDoc(opening));
    await new Promise((r) => setTimeout(r, 60_000));

    engine.stop();
    expect(true).toBe(true);
  }, 180_000);
});
