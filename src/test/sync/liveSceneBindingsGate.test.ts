import { describe, expect, it, vi } from "vitest";

import type { EngineLiveScenePort } from "../../sync/liveSceneBindings";
import { LiveSceneBindings } from "../../sync/liveSceneBindings";

// Audit P0.1: flushAndClose must gate the port (noteReplacementPending) after
// draining it and BEFORE the epoch replacement rewrites the store — otherwise
// an editor update in that window merges the stale doc into the replacement.
describe("LiveSceneBindings.flushAndClose replacement gate", () => {
  function makePort(calls: string[], flushBehavior: "ok" | "throw" = "ok"): EngineLiveScenePort {
    return {
      applyRemoteUpdate: vi.fn(async () => undefined),
      flushLocal: vi.fn(async () => {
        calls.push("flush");
        if (flushBehavior === "throw") throw new Error("webview gone");
        return { status: "flushed" as const };
      }),
      replaceFromState: vi.fn(async () => undefined),
      noteReplacementPending: vi.fn(() => calls.push("gate")),
    };
  }

  it("flushes, then gates, then drops the binding", async () => {
    const bindings = new LiveSceneBindings();
    const calls: string[] = [];
    const port = makePort(calls);
    bindings.attachPort("scene-1", port);
    await bindings.flushAndClose(["scene-1"]);
    expect(calls).toEqual(["flush", "gate"]);
    expect(bindings.portFor("scene-1")).toBeNull();
    expect(bindings.activeSceneId()).toBeNull();
  });

  it("still gates and drops the binding when the flush throws", async () => {
    const bindings = new LiveSceneBindings();
    const calls: string[] = [];
    const port = makePort(calls, "throw");
    bindings.attachPort("scene-1", port);
    await bindings.flushAndClose(["scene-1"]);
    expect(calls).toEqual(["flush", "gate"]);
    expect(bindings.portFor("scene-1")).toBeNull();
  });

  it("does not touch a port whose scene is not selected", async () => {
    const bindings = new LiveSceneBindings();
    const calls: string[] = [];
    const port = makePort(calls);
    bindings.attachPort("scene-1", port);
    await bindings.flushAndClose(["other-scene"]);
    expect(calls).toEqual([]);
    expect(bindings.portFor("scene-1")).toBe(port);
  });

  it("tolerates a port without the optional gate method", async () => {
    const bindings = new LiveSceneBindings();
    const port: EngineLiveScenePort = {
      applyRemoteUpdate: vi.fn(async () => undefined),
      flushLocal: vi.fn(async () => ({ status: "flushed" as const })),
      replaceFromState: vi.fn(async () => undefined),
    };
    bindings.attachPort("scene-1", port);
    await expect(bindings.flushAndClose(["scene-1"])).resolves.toBeUndefined();
    expect(bindings.portFor("scene-1")).toBeNull();
  });
});
