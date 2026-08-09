import { describe, expect, it, vi } from "vitest";

import { CatchUpFlow } from "./catchUpFlow";

describe("CatchUpFlow", () => {
  it("returns one snapshot id per scene and blocks replacement before preparation", async () => {
    const engine = {
      prepareCatchUp: vi.fn(async (ids: readonly string[]) => ({ snapshots: ids.map((sceneId) => ({ sceneId, snapshotId: `snap-${sceneId}` })) })),
      catchUpNow: vi.fn(async () => ({ replaced: [], waitingForOwner: [] })),
    };
    const flow = new CatchUpFlow(engine);
    await expect(flow.catchUpNow(["a", "b"])).rejects.toThrow("safety snapshot");
    expect(engine.catchUpNow).not.toHaveBeenCalled();
    await expect(flow.prepare(["a", "b"])).resolves.toEqual([
      { sceneId: "a", snapshotId: "snap-a" }, { sceneId: "b", snapshotId: "snap-b" },
    ]);
    await flow.catchUpNow(["a", "b"]);
    expect(engine.catchUpNow).toHaveBeenCalledWith(["a", "b"]);
  });
});
