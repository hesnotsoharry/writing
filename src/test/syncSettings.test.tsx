// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearKey: vi.fn<() => Promise<void>>(),
  getKey: vi.fn<() => Promise<Uint8Array | null>>(),
  setKey: vi.fn<(key: Uint8Array) => Promise<void>>(),
  start: vi.fn<(relayUrl?: string) => Promise<void>>(),
  stop: vi.fn<() => void>(),
  status: {
    state: "disconnected" as "off" | "connecting" | "connected" | "disconnected",
    peerSeen: false,
    lastSyncAt: null as string | null,
  },
}));

vi.mock("../sync/keyStorage", () => ({
  clearSyncMasterKey: mocks.clearKey,
  getSyncMasterKey: mocks.getKey,
  setSyncMasterKey: mocks.setKey,
}));

vi.mock("../sync/engine", () => ({
  syncEngine: {
    start: mocks.start,
    stop: mocks.stop,
    subscribe: vi.fn((callback: (status: typeof mocks.status) => void) => {
      callback({ ...mocks.status });
      return vi.fn();
    }),
  },
}));

import { TWEAK_DEFAULTS } from "../features/settings/settings.store";
import { SyncSection } from "../features/settings/Settings.sync";

const MASTER_KEY = new Uint8Array(32).fill(7);

function renderSection() {
  const setTweak = vi.fn();
  render(<SyncSection tweaks={{ ...TWEAK_DEFAULTS }} setTweak={setTweak} />);
  return { setTweak };
}

beforeEach(() => {
  mocks.clearKey.mockResolvedValue(undefined);
  mocks.setKey.mockResolvedValue(undefined);
  mocks.start.mockResolvedValue(undefined);
  mocks.status.state = "disconnected";
  mocks.status.peerSeen = false;
  mocks.status.lastSyncAt = null;
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("SyncSection", () => {
  it("shows the no-key explainer and setup choices", async () => {
    mocks.getKey.mockResolvedValue(null);
    renderSection();
    expect(await screen.findByText(/end-to-end encrypted/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enable sync on this device" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "I have a pairing string" })).toBeTruthy();
  });

  it("shows Offline when a stored key has a disconnected engine", async () => {
    mocks.getKey.mockResolvedValue(MASTER_KEY);
    renderSection();
    expect(await screen.findByText("Offline")).toBeTruthy();
  });

  it("shows the last-sync time when the engine has connected to a peer", async () => {
    mocks.status.state = "connected";
    mocks.status.peerSeen = true;
    mocks.status.lastSyncAt = "2026-08-06T14:35:00.000Z";
    mocks.getKey.mockResolvedValue(MASTER_KEY);
    renderSection();
    expect(await screen.findByText(/Connected — synced with your other device/i)).toBeTruthy();
    expect(screen.getByText(/14:35|10:35/)).toBeTruthy();
  });

  it("gently rejects a garbage pairing string", async () => {
    mocks.getKey.mockResolvedValue(null);
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "I have a pairing string" }));
    fireEvent.change(screen.getByLabelText("Pairing string"), { target: { value: "garbage" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect this device" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("doesn't look right");
    expect(mocks.setKey).not.toHaveBeenCalled();
  });

  it("enabling stores the key, enables the tweak, and starts the engine", async () => {
    mocks.getKey.mockResolvedValue(null);
    const { setTweak } = renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Enable sync on this device" }));
    await waitFor(() => expect(mocks.setKey).toHaveBeenCalled());
    expect(mocks.setKey.mock.calls[0][0]).toHaveLength(32);
    expect(setTweak).toHaveBeenCalledWith("syncExperimental", "on");
    expect(mocks.start).toHaveBeenCalledWith("");
    expect(await screen.findByText("Enter this on your other device.")).toBeTruthy();
  });
});
