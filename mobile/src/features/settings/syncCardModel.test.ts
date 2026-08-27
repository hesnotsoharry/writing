import { describe, expect, it, vi } from "vitest";

import type { SyncStatus } from "../../shared/engine";
import { executeUnpair, guardUnpairedEngine, pendingChangeCount, pendingChangeLabel } from "./syncCardModel";

const EMPTY = { scenes: 0, notes: 0, boards: 0, rows: 0 };

describe("pendingChangeCount", () => {
  it("is zero before the outbox has reported", () => {
    expect(pendingChangeCount(null)).toBe(0);
    expect(pendingChangeCount(undefined)).toBe(0);
  });

  it("sums every bucket, not just scenes", () => {
    expect(pendingChangeCount({ scenes: 2, notes: 3, boards: 1, rows: 4 })).toBe(10);
    expect(pendingChangeCount(EMPTY)).toBe(0);
  });
});

describe("pendingChangeLabel", () => {
  it("says nothing when nothing is waiting", () => {
    expect(pendingChangeLabel(0)).toBeNull();
    expect(pendingChangeLabel(-1)).toBeNull();
  });

  it("agrees with itself on number", () => {
    expect(pendingChangeLabel(1)).toBe("1 change is waiting, and will sync when you pair again.");
    expect(pendingChangeLabel(4)).toBe("4 changes are waiting, and will sync when you pair again.");
  });
});

describe("executeUnpair", () => {
  it("stops engine before and after clearing credentials", async () => {
    const order: string[] = [];
    const engine = { stop: vi.fn(() => { order.push("stop"); }) };
    const clearKeys = vi.fn(async () => { order.push("clear"); });

    await executeUnpair(engine, clearKeys);

    expect(order).toEqual(["stop", "clear", "stop"]);
    expect(engine.stop).toHaveBeenCalledTimes(2);
    expect(clearKeys).toHaveBeenCalledOnce();
  });
});

describe("guardUnpairedEngine", () => {
  const offStatus: SyncStatus = {
    state: "off", peerSeen: false, lastSyncAt: null, lastPeerSeenAt: null,
    queue: EMPTY, behind: [], devices: [],
  };
  const connectedStatus: SyncStatus = {
    ...offStatus, state: "connected",
  };

  it("stops the engine if non-off status arrives when no master key exists", async () => {
    let listener: ((status: SyncStatus) => void) | undefined;
    const engine = {
      stop: vi.fn(),
      subscribe: vi.fn((cb: (status: SyncStatus) => void) => {
        listener = cb;
        return () => { listener = undefined; };
      }),
    };
    const checkKey = vi.fn(async () => false);

    guardUnpairedEngine(engine, checkKey);
    expect(engine.subscribe).toHaveBeenCalledOnce();

    listener?.(connectedStatus);
    await new Promise((r) => setTimeout(r, 0));

    expect(checkKey).toHaveBeenCalledOnce();
    expect(engine.stop).toHaveBeenCalledOnce();
  });

  it("leaves the engine running if key exists", async () => {
    let listener: ((status: SyncStatus) => void) | undefined;
    const engine = {
      stop: vi.fn(),
      subscribe: vi.fn((cb: (status: SyncStatus) => void) => {
        listener = cb;
        return () => { listener = undefined; };
      }),
    };
    const checkKey = vi.fn(async () => true);

    guardUnpairedEngine(engine, checkKey);
    listener?.(connectedStatus);
    await new Promise((r) => setTimeout(r, 0));

    expect(checkKey).toHaveBeenCalledOnce();
    expect(engine.stop).not.toHaveBeenCalled();
  });

  it("ignores status changes when engine state is off", async () => {
    let listener: ((status: SyncStatus) => void) | undefined;
    const engine = {
      stop: vi.fn(),
      subscribe: vi.fn((cb: (status: SyncStatus) => void) => {
        listener = cb;
        return () => { listener = undefined; };
      }),
    };
    const checkKey = vi.fn(async () => false);

    guardUnpairedEngine(engine, checkKey);
    listener?.(offStatus);
    await new Promise((r) => setTimeout(r, 0));

    expect(checkKey).not.toHaveBeenCalled();
    expect(engine.stop).not.toHaveBeenCalled();
  });
});

