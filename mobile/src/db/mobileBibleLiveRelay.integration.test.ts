/// <reference types="node" />
import type { BoardDocStore } from "@writersnook/db/boardDocStore";
import { runMigrations } from "@writersnook/db/migrations";
import { DbProjectDomainDocStore } from "@writersnook/db/projectDomainDocStore";
import type { SceneDocStore } from "@writersnook/db/sceneDocStore";
import { SqliteStoryBibleStore } from "@writersnook/db/sqliteStoryBibleStore";
import { buildBibleFromSql } from "@writersnook/sync/bible/bibleDoc";
import { BibleLocalBridge } from "@writersnook/sync/bible/bibleLocalBridge";
import { DbBibleApplyTarget } from "@writersnook/sync/bible/dbBibleApplyTarget";
import { SyncEngine } from "@writersnook/sync/engine";
import { generateMasterKey } from "@writersnook/sync/keys";
import { RelayProvider } from "@writersnook/sync/provider";
import { makeSqlJsDb } from "@writersnook/test/support/sqljsDb";
import { encodeDoc } from "@writersnook/yjs/serialize";
import { describe, expect, it, vi } from "vitest";

import { MobileStoryBibleStore } from "./mobileStoryBibleStore";

const RELAY_URL = process.env.SYNC_LIVE_RELAY;
let activeMobileDb: Awaited<ReturnType<typeof makeSqlJsDb>>;
vi.mock("./database", () => ({ getMobileDb: () => Promise.resolve(activeMobileDb) }));

class MemoryDocStore implements SceneDocStore, BoardDocStore {
  private readonly rows = new Map<string, string>();
  async load(id: string): Promise<string | null> { return this.rows.get(id) ?? null; }
  async save(id: string, stateBase64: string): Promise<void> { this.rows.set(id, stateBase64); }
  async loadProjection(): Promise<string | null> { return null; }
  async delete(id: string): Promise<void> { this.rows.delete(id); }
  async listAll(): Promise<Array<{ id: string; stateBase64: string; updatedAt: string | null }>> {
    return [...this.rows].map(([id, stateBase64]) => ({ id, stateBase64, updatedAt: null }));
  }
}

async function seed(db: Awaited<ReturnType<typeof makeSqlJsDb>>): Promise<void> {
  await runMigrations(db);
  await db.execute(
    "INSERT INTO projects (id,title,type,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?)",
    ["p1", "Relay", "novel", 1000, "now", "now"],
  );
}

async function until(check: () => boolean | Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("condition not met in time");
}

describe.runIf(RELAY_URL)("live Bible store relay", () => {
  it("pushes mobile and desktop store edits both ways with a 60 second sweep", async () => {
    const desktopDb = await makeSqlJsDb(); const mobileDb = await makeSqlJsDb();
    activeMobileDb = mobileDb;
    await seed(desktopDb); await seed(mobileDb);
    const desktopDocs = new DbProjectDomainDocStore(desktopDb);
    const mobileDocs = new DbProjectDomainDocStore(mobileDb);
    const empty = encodeDoc(buildBibleFromSql({
      entities: [], entityTypes: [], fields: [], sceneLinks: [], entityLinks: [], relations: [],
    }));
    await desktopDocs.save("bible", "p1", empty); await mobileDocs.save("bible", "p1", empty);
    const desktopBridge = new BibleLocalBridge(desktopDocs);
    const mobileBridge = new BibleLocalBridge(mobileDocs);
    const masterKey = generateMasterKey();
    const makeEngine = (deviceId: string, docs: DbProjectDomainDocStore,
      db: Awaited<ReturnType<typeof makeSqlJsDb>>, bridge: BibleLocalBridge) => new SyncEngine({
      relayUrl: RELAY_URL as string, sceneStore: new MemoryDocStore(), boardStore: new MemoryDocStore(),
      domainDocStore: docs, bibleApplyTarget: new DbBibleApplyTarget(db),
      subscribeBibleSaves: (listener) => bridge.subscribe(listener),
      readMasterKey: async () => masterKey, getDeviceId: async () => deviceId,
      providerFactory: (url, room, device) => new RelayProvider(url, room, device),
      updateWordCount: async () => undefined, sweepMs: 60_000, saveDebounceMs: 100,
    });
    const desktopEngine = makeEngine("store-desktop", desktopDocs, desktopDb, desktopBridge);
    const mobileEngine = makeEngine("store-mobile", mobileDocs, mobileDb, mobileBridge);
    const desktop = new SqliteStoryBibleStore({ bridge: desktopBridge, db: desktopDb });
    const mobile = new MobileStoryBibleStore(mobileDb, mobileBridge);
    try {
      await desktopEngine.start(); await mobileEngine.start();
      await until(() => desktopEngine.status().state === "connected"
        && mobileEngine.status().state === "connected");
      const mobileStart = Date.now(); const character = await mobile.createCharacter("p1", "Mobile Ada", null);
      await until(async () => (await desktopDb.select<Array<{ name: string }>>(
        "SELECT name FROM characters WHERE id = ?", [character.id],
      ))[0]?.name === "Mobile Ada");
      const mobileToDesktopMs = Date.now() - mobileStart;
      const desktopStart = Date.now(); await desktop.renameEntity("character", character.id, "Desktop Ada");
      await until(async () => (await mobileDb.select<Array<{ name: string }>>(
        "SELECT name FROM characters WHERE id = ?", [character.id],
      ))[0]?.name === "Desktop Ada");
      const desktopToMobileMs = Date.now() - desktopStart;
      process.stdout.write(
        `Bible store sweep-proof: mobile->desktop=${mobileToDesktopMs}ms desktop->mobile=${desktopToMobileMs}ms\n`,
      );
      expect(mobileToDesktopMs).toBeLessThan(10_000); expect(desktopToMobileMs).toBeLessThan(10_000);
    } finally {
      desktopEngine.stop(); mobileEngine.stop(); desktopDb.close(); mobileDb.close();
    }
  }, 50_000);
});
