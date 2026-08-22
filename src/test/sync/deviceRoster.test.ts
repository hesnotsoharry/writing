import { describe, expect, it } from "vitest";

import {
describeDevice,   DEVICE_ONLINE_WINDOW_MS, DeviceRosterTracker, forgetDevice, isDeviceOnline,
  parseRoster, recordSighting, serializeRoster, type SyncDevice,
} from "../../sync/deviceRoster";

const T1 = "2026-08-21T10:00:00.000Z";
const T2 = "2026-08-21T11:00:00.000Z";
const T3 = "2026-08-21T12:00:00.000Z";

function device(overrides: Partial<SyncDevice> & { id: string }): SyncDevice {
  return {
    name: null, platform: null, firstSeenAt: T1, lastSeenAt: T1, self: false, ...overrides,
  };
}

describe("parseRoster", () => {
  it("survives anything a corrupt or hand-edited row can hold", () => {
    expect(parseRoster(null)).toEqual([]);
    expect(parseRoster("")).toEqual([]);
    expect(parseRoster("not json")).toEqual([]);
    expect(parseRoster('{"id":"a"}')).toEqual([]);
    expect(parseRoster('[null, 3, "x", {"id":""}]')).toEqual([]);
  });

  it("keeps well-formed entries and drops malformed siblings", () => {
    const json = JSON.stringify([
      { id: "good", firstSeenAt: T1, lastSeenAt: T1, name: "Desk", platform: "Windows" },
      { id: "no-dates" },
    ]);
    const roster = parseRoster(json);
    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({ id: "good", name: "Desk", platform: "Windows" });
  });

  it("round-trips through serializeRoster", () => {
    const roster = [device({ id: "a", name: "Desk", self: true })];
    expect(parseRoster(serializeRoster(roster))).toEqual(roster);
  });
});

describe("recordSighting", () => {
  it("preserves firstSeenAt across later sightings", () => {
    let roster = recordSighting([], { id: "a", seenAt: T1 });
    roster = recordSighting(roster, { id: "a", seenAt: T3 });
    expect(roster[0].firstSeenAt).toBe(T1);
    expect(roster[0].lastSeenAt).toBe(T3);
  });

  it("learns a name later without ever unlearning it", () => {
    // A peer on a build older than the roster sends no name. That must not
    // erase a name the same device sent on a newer build.
    let roster = recordSighting([], { id: "a", name: "Pixel 3 XL", seenAt: T1 });
    roster = recordSighting(roster, { id: "a", seenAt: T2 });
    expect(roster[0].name).toBe("Pixel 3 XL");
    roster = recordSighting(roster, { id: "a", name: "   ", seenAt: T3 });
    expect(roster[0].name).toBe("Pixel 3 XL");
  });

  it("never walks last-seen backwards for a clock-skewed peer", () => {
    let roster = recordSighting([], { id: "a", seenAt: T3 });
    roster = recordSighting(roster, { id: "a", seenAt: T1 });
    expect(roster[0].lastSeenAt).toBe(T3);
  });

  it("orders newest first and keeps one entry per device", () => {
    let roster = recordSighting([], { id: "a", seenAt: T1 });
    roster = recordSighting(roster, { id: "b", seenAt: T2 });
    roster = recordSighting(roster, { id: "a", seenAt: T3 });
    expect(roster.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("caps the roster and drops the stalest entry", () => {
    let roster: SyncDevice[] = [];
    for (let index = 0; index < 30; index += 1) {
      const seenAt = new Date(Date.UTC(2026, 7, 21, 0, index)).toISOString();
      roster = recordSighting(roster, { id: `device-${index}`, seenAt });
    }
    expect(roster).toHaveLength(24);
    expect(roster.map((entry) => entry.id)).not.toContain("device-0");
    expect(roster[0].id).toBe("device-29");
  });
});

describe("forgetDevice", () => {
  it("removes a peer but never this device", () => {
    const roster = [device({ id: "self", self: true }), device({ id: "peer" })];
    expect(forgetDevice(roster, "peer").map((entry) => entry.id)).toEqual(["self"]);
    expect(forgetDevice(roster, "self").map((entry) => entry.id)).toEqual(["self", "peer"]);
  });
});

describe("isDeviceOnline", () => {
  const now = Date.parse(T3);

  it("reports nobody online while this device is disconnected", () => {
    const fresh = device({ id: "a", lastSeenAt: T3 });
    expect(isDeviceOnline(fresh, false, now)).toBe(false);
    expect(isDeviceOnline(device({ id: "s", self: true }), false, now)).toBe(false);
  });

  it("treats this device as online whenever the engine is connected", () => {
    expect(isDeviceOnline(device({ id: "s", self: true, lastSeenAt: T1 }), true, now)).toBe(true);
  });

  it("holds a peer online across one missed sweep and drops it after the window", () => {
    const inside = new Date(now - DEVICE_ONLINE_WINDOW_MS + 1_000).toISOString();
    const outside = new Date(now - DEVICE_ONLINE_WINDOW_MS - 1_000).toISOString();
    expect(isDeviceOnline(device({ id: "a", lastSeenAt: inside }), true, now)).toBe(true);
    expect(isDeviceOnline(device({ id: "a", lastSeenAt: outside }), true, now)).toBe(false);
  });

  it("does not call an unparseable timestamp online", () => {
    expect(isDeviceOnline(device({ id: "a", lastSeenAt: "whenever" }), true, now)).toBe(false);
  });
});

describe("describeDevice", () => {
  it("falls back to a short stable id when a peer sent no name", () => {
    expect(describeDevice(device({ id: "a", name: "Cole's PC" }))).toBe("Cole's PC");
    expect(describeDevice(device({ id: "3f2a1b9c-dead-4beef" })))
      .toBe("Unnamed device 3F2A1B");
  });
});

describe("DeviceRosterTracker", () => {
  function makeTracker(stored: string | null = null) {
    const saved: string[] = [];
    const tracker = new DeviceRosterTracker({
      load: () => Promise.resolve(stored),
      save: (value) => { saved.push(value); return Promise.resolve(); },
      identity: () => Promise.resolve({ name: "Cole's PC", platform: "Windows" }),
    });
    return { saved, tracker };
  }

  it("stamps this device into the roster on load and persists it", async () => {
    const { saved, tracker } = makeTracker();
    const roster = await tracker.load("self-id", T1);
    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({ id: "self-id", name: "Cole's PC", self: true });
    expect(parseRoster(saved[0])).toEqual(roster);
  });

  it("exposes its own identity for the hello it will send", async () => {
    const { tracker } = makeTracker();
    await tracker.load("self-id", T1);
    expect(tracker.self()).toEqual({ name: "Cole's PC", platform: "Windows" });
  });

  it("merges a peer sighting into the stored roster", async () => {
    const stored = serializeRoster([device({ id: "peer", name: "Pixel 3 XL" })]);
    const { saved, tracker } = makeTracker(stored);
    await tracker.load("self-id", T2);
    const roster = await tracker.record({ id: "peer", seenAt: T3 });
    expect(roster.map((entry) => entry.id)).toEqual(["peer", "self-id"]);
    expect(roster[0]).toMatchObject({ name: "Pixel 3 XL", firstSeenAt: T1, lastSeenAt: T3 });
    expect(parseRoster(saved[saved.length - 1])).toEqual(roster);
  });

  it("works with no storage and no identity wired", async () => {
    const tracker = new DeviceRosterTracker({});
    const roster = await tracker.load("self-id", T1);
    expect(roster).toEqual([device({ id: "self-id", self: true })]);
  });
});
