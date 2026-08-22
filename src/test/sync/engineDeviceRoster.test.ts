import { describe, expect, it, vi } from "vitest";

import type { BoardDocStore } from "../../db/boardDocStore";
import type { SceneDocStore } from "../../db/sceneDocStore";
import { parseRoster } from "../../sync/deviceRoster";
import { SyncEngine, type SyncProvider } from "../../sync/engine";
import { openMessage, sealMessage } from "../../sync/frameCodec";
import { deriveKeys } from "../../sync/keys";
import type { HelloMessage, InnerMessage } from "../../sync/messages";
import type { ConnectionState } from "../../sync/provider";

const MASTER_KEY = new Uint8Array(32).fill(7);

class EmptyStore implements SceneDocStore, BoardDocStore {
  async listAll() { return []; }
  async load(): Promise<string | null> { return null; }
  async save(): Promise<void> { /* nothing to keep */ }
  async loadProjection(): Promise<string | null> { return null; }
  async delete(): Promise<void> { /* nothing to keep */ }
}

class FakeProvider implements SyncProvider {
  readonly sent: Uint8Array[] = [];
  private connection: ((state: ConnectionState) => void) | null = null;
  private frames: ((blob: Uint8Array) => void) | null = null;
  connect(): void { this.connection?.("connected"); }
  destroy(): void { this.connection?.("disconnected"); }
  send(blob: Uint8Array): void { this.sent.push(blob); }
  subscribeConnection(cb: (state: ConnectionState) => void): () => void {
    this.connection = cb; cb("disconnected"); return () => { this.connection = null; };
  }
  subscribeFrames(cb: (blob: Uint8Array) => void): () => void {
    this.frames = cb; return () => { this.frames = null; };
  }
  receive(blob: Uint8Array): void { this.frames?.(blob); }
}

function makeEngine(stored: string | null = null) {
  const provider = new FakeProvider();
  const saved: string[] = [];
  const store = new EmptyStore();
  const engine = new SyncEngine({
    relayUrl: "wss://relay.test", sceneStore: store, boardStore: store,
    readMasterKey: () => Promise.resolve(MASTER_KEY),
    getDeviceId: () => Promise.resolve("device-a"),
    providerFactory: () => provider,
    updateWordCount: vi.fn().mockResolvedValue(undefined),
    deviceRoster: {
      load: () => Promise.resolve(stored),
      save: (value) => { saved.push(value); return Promise.resolve(); },
      identity: () => Promise.resolve({ name: "Cole's PC", platform: "Windows" }),
    },
  });
  return { engine, provider, saved };
}

/** Delivers a frame and waits for the engine to have recorded its sender.
 *  Microtask flushing is not enough here: the inbound chain awaits WebCrypto,
 *  which resolves off the microtask queue, so a synchronous assertion after
 *  `receive` reads the roster from before the frame was even decrypted. */
async function deliver(
  engine: SyncEngine, provider: FakeProvider, message: InnerMessage & { device: string },
): Promise<void> {
  const key = (await deriveKeys(MASTER_KEY)).encKey;
  provider.receive(await sealMessage(key, message));
  await vi.waitFor(() => expect(
    (engine.status().devices ?? []).some((entry) => entry.id === message.device),
  ).toBe(true));
}

async function sentMessages(provider: FakeProvider): Promise<InnerMessage[]> {
  const key = (await deriveKeys(MASTER_KEY)).encKey;
  const values = await Promise.all(provider.sent.map((blob) => openMessage(key, blob)));
  return values.filter((value): value is InnerMessage => value !== null);
}

describe("SyncEngine device roster", () => {
  it("lists this device as soon as sync starts", async () => {
    const { engine } = makeEngine();
    await engine.start();
    const devices = engine.status().devices ?? [];
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ id: "device-a", name: "Cole's PC", self: true });
    engine.stop();
  });

  it("announces its own name and platform in hello", async () => {
    const { engine, provider } = makeEngine();
    await engine.start();
    await vi.waitFor(() => expect(provider.sent.length).toBeGreaterThan(0));
    const hello = (await sentMessages(provider)).find(
      (message): message is HelloMessage => message.t === "hello",
    );
    expect(hello).toMatchObject({ name: "Cole's PC", platform: "Windows" });
    engine.stop();
  });

  it("records each peer separately instead of collapsing them into peerSeen", async () => {
    // The bug this closes: two peers online read identically to one, so an
    // unpaired phone was indistinguishable from a sleeping one.
    const { engine, provider } = makeEngine();
    await engine.start();
    await deliver(engine, provider, { t: "hello", device: "phone", name: "Pixel 3 XL",
      platform: "Android", docs: [] });
    await deliver(engine, provider, { t: "hello", device: "emulator",
      name: "sdk_gphone64_x86_64", platform: "Android", docs: [] });

    const devices = engine.status().devices ?? [];
    expect(devices.map((entry) => entry.name).sort()).toEqual(
      ["Cole's PC", "Pixel 3 XL", "sdk_gphone64_x86_64"],
    );
    expect(engine.status().peerSeen).toBe(true);
    engine.stop();
  });

  it("persists the roster so a device seen last week still lists while offline", async () => {
    const { engine, provider, saved } = makeEngine();
    await engine.start();
    await deliver(engine, provider, { t: "hello", device: "phone", name: "Pixel 3 XL", docs: [] });
    const persisted = parseRoster(saved[saved.length - 1]);
    expect(persisted.map((entry) => entry.id).sort()).toEqual(["device-a", "phone"]);
    engine.stop();
  });

  it("keeps a peer that sends no name \u2014 older builds send none", async () => {
    const { engine, provider } = makeEngine();
    await engine.start();
    await deliver(engine, provider, { t: "hello", device: "legacy-peer", docs: [] });
    const legacy = (engine.status().devices ?? []).find((entry) => entry.id === "legacy-peer");
    expect(legacy).toMatchObject({ name: null, platform: null });
    engine.stop();
  });

  it("forgets a peer locally without touching this device", async () => {
    const { engine, provider } = makeEngine();
    await engine.start();
    await deliver(engine, provider, { t: "hello", device: "phone", name: "Pixel 3 XL", docs: [] });
    await engine.forgetDevice("phone");
    expect((engine.status().devices ?? []).map((entry) => entry.id)).toEqual(["device-a"]);
    engine.stop();
  });
});
