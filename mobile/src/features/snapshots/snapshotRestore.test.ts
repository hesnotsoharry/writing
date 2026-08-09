import { describe, expect, it } from "vitest";

import { restoreSnapshotSafely } from "./snapshotRestore";

describe("snapshot restore orchestration", () => {
  it("flushes the live editor, then snapshots its durable state before replacement", async () => {
    const order: string[] = [];
    const restored = await restoreSnapshotSafely({
      getSnapshot: async () => ({
        meta: { id: "v", sceneId: "s", label: null, wordCount: 2, createdAt: 1, kind: "manual" },
        stateBase64: "version-bytes",
      }),
      readCurrentScene: async () => ({ stateBase64: "current-bytes", wordCount: 5 }),
      takeSafetySnapshot: async (input) => { order.push(`safety:${input.stateBase64}`); return "safety"; },
      publishSnapshot: async (id) => { order.push(`publish:${id}`); },
      replaceThroughEpoch: async (input) => { order.push(`epoch:${input.stateBase64}`); },
      replaceActiveScene: async (input, persist) => {
        order.push(`guard:${input.stateBase64}`);
        await persist();
        order.push("live-replaced");
      },
    }, { projectId: "p", sceneId: "s", snapshotId: "v" });

    expect(restored).toBe(true);
    expect(order).toEqual([
      "guard:version-bytes", "safety:current-bytes", "publish:safety",
      "epoch:version-bytes", "live-replaced",
    ]);
  });

  it("never applies a snapshot belonging to another scene", async () => {
    let replaced = false;
    const restored = await restoreSnapshotSafely({
      getSnapshot: async () => ({
        meta: { id: "v", sceneId: "other", label: null, wordCount: 2, createdAt: 1, kind: "manual" },
        stateBase64: "bytes",
      }),
      readCurrentScene: async () => ({ stateBase64: "", wordCount: 0 }),
      takeSafetySnapshot: async () => "safety",
      publishSnapshot: async () => undefined,
      replaceThroughEpoch: async () => { replaced = true; },
      replaceActiveScene: async (_input, persist) => { await persist(); },
    }, { projectId: "p", sceneId: "s", snapshotId: "v" });
    expect(restored).toBe(false); expect(replaced).toBe(false);
  });
});
