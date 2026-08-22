// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SyncDevice } from "../sync/deviceRoster";

function device(id: string, name: string, lastSeenAt: string, self = false): SyncDevice {
  return { id, name, platform: null, firstSeenAt: lastSeenAt, lastSeenAt, self };
}

const mocks = vi.hoisted(() => ({
  clearKey: vi.fn<() => Promise<void>>(),
  getKey: vi.fn<() => Promise<Uint8Array | null>>(),
  setKey: vi.fn<(key: Uint8Array) => Promise<void>>(),
  setRole: vi.fn<(role: "origin" | "joined") => Promise<void>>(),
  clearRole: vi.fn<() => Promise<void>>(),
  start: vi.fn<(relayUrl?: string) => Promise<void>>(),
  stop: vi.fn<() => void>(),
  sendCredentialOffer: vi.fn(),
  onCredentialAck: vi.fn(),
  forgetDevice: vi.fn<(id: string) => Promise<void>>(),
  status: {
    state: "disconnected" as "off" | "connecting" | "connected" | "disconnected",
    peerSeen: false,
    lastSyncAt: null as string | null,
    devices: [] as SyncDevice[],
  },
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => command === "device_name" ? "Cole-PC" : null),
}));

vi.mock("../sync/keyStorage", () => ({
  clearSyncMasterKey: mocks.clearKey,
  getSyncMasterKey: mocks.getKey,
  setSyncMasterKey: mocks.setKey,
}));

vi.mock("../sync/desktopEngine", () => ({
  syncEngine: {
    start: mocks.start,
    stop: mocks.stop,
    subscribe: vi.fn((callback: (status: typeof mocks.status) => void) => {
      callback({ ...mocks.status });
      return vi.fn();
    }),
    sendCredentialOffer: mocks.sendCredentialOffer,
    onCredentialAck: mocks.onCredentialAck,
    forgetDevice: mocks.forgetDevice,
  },
}));

vi.mock("../sync/syncRole", () => ({
  clearSyncRole: mocks.clearRole,
  setSyncRole: mocks.setRole,
}));

// The QR itself is `uqr`'s SVG rendering (third-party, not this change's
// logic); mock the presentation component so tests can read the `payload`
// prop it was handed instead of trying to decode rendered SVG paths.
vi.mock("../features/settings/SyncQr", () => ({
  SyncQr: ({ payload }: { payload: string }) => <div data-testid="sync-qr" data-payload={payload} />,
}));

import { TWEAK_DEFAULTS } from "../features/settings/settings.store";
import { SyncSection } from "../features/settings/Settings.sync";
import { DEFAULT_RELAY_URL } from "../sync/engineDefaults";
import { encodeMasterKey, parsePairPayload } from "../sync/keys";

const MASTER_KEY = new Uint8Array(32).fill(7);

function renderSection(tweakOverrides: Partial<typeof TWEAK_DEFAULTS> = {}) {
  const setTweak = vi.fn();
  render(<SyncSection tweaks={{ ...TWEAK_DEFAULTS, ...tweakOverrides }} setTweak={setTweak} />);
  return { setTweak };
}

function readQrPayload(): string {
  return screen.getByTestId("sync-qr").getAttribute("data-payload") ?? "";
}

beforeEach(() => {
  mocks.clearKey.mockResolvedValue(undefined);
  mocks.setKey.mockResolvedValue(undefined);
  mocks.start.mockResolvedValue(undefined);
  mocks.setRole.mockResolvedValue(undefined);
  mocks.clearRole.mockResolvedValue(undefined);
  mocks.sendCredentialOffer.mockImplementation(async (_managed: unknown, id: string) => id);
  mocks.status.state = "disconnected";
  mocks.status.peerSeen = false;
  mocks.status.devices = [];
  mocks.forgetDevice.mockResolvedValue(undefined);
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

  it("counts the peers it is synced with instead of assuming there is one", async () => {
    // "your other device" was true only on a two-device key. It hid the case
    // that made this list necessary: a phone believed unpaired still answering
    // alongside an emulator, with no way to tell which was which.
    const now = new Date().toISOString();
    mocks.status.state = "connected";
    mocks.status.peerSeen = true;
    mocks.status.lastSyncAt = "2026-08-06T14:35:00.000Z";
    mocks.status.devices = [
      device("self", "Cole-PC", now, true),
      device("phone", "Pixel 3 XL", now),
      device("emu", "sdk_gphone64_x86_64", now),
    ];
    mocks.getKey.mockResolvedValue(MASTER_KEY);
    renderSection();
    expect(await screen.findByText(/Connected — synced with 2 devices/i)).toBeTruthy();
    expect(screen.getByText(/14:35|10:35/)).toBeTruthy();
  });

  it("names every device on the key, and says which one you are looking out of", async () => {
    const now = new Date().toISOString();
    mocks.status.state = "connected";
    mocks.status.peerSeen = true;
    mocks.status.devices = [
      device("self", "Cole-PC", now, true),
      device("phone", "Pixel 3 XL", now),
    ];
    mocks.getKey.mockResolvedValue(MASTER_KEY);
    renderSection();
    expect(await screen.findByText("Cole-PC")).toBeTruthy();
    expect(screen.getByText("Pixel 3 XL")).toBeTruthy();
    expect(screen.getByText(/· this device$/)).toBeTruthy();
    expect(screen.getByText(/online now/i)).toBeTruthy();
  });

  it("shows a stale device as last-seen, and forgetting it is local only", async () => {
    const stale = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    mocks.status.state = "connected";
    mocks.status.peerSeen = true;
    mocks.status.devices = [
      device("self", "Cole-PC", new Date().toISOString(), true),
      device("phone", "Pixel 3 XL", stale),
    ];
    mocks.getKey.mockResolvedValue(MASTER_KEY);
    renderSection();
    expect(await screen.findByText(/last seen 3h ago/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove from list" }));
    expect(mocks.forgetDevice).toHaveBeenCalledWith("phone");
  });

  it("keeps the access explainer behind a disclosure rather than in the panel", async () => {
    mocks.status.state = "connected";
    mocks.status.devices = [device("self", "Cole-PC", new Date().toISOString(), true)];
    mocks.getKey.mockResolvedValue(MASTER_KEY);
    renderSection();
    const help = await screen.findByRole("button", { name: "What does this list mean?" });
    expect(screen.queryByText(/it does not control access/i)).toBeNull();
    fireEvent.click(help);
    // The panel must never imply the list evicts a device — it cannot.
    expect(screen.getByText(/it does not control access/i)).toBeTruthy();
    fireEvent.click(help);
    expect(screen.queryByText(/it does not control access/i)).toBeNull();
  });

  it("closes the pairing string when the button is pressed again", async () => {
    mocks.getKey.mockResolvedValue(MASTER_KEY);
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Show pairing string" }));
    const hide = await screen.findByRole("button", { name: "Hide pairing string" });
    expect(screen.getByText(/Scan with your phone/i)).toBeTruthy();
    fireEvent.click(hide);
    await waitFor(() => expect(screen.queryByText(/Scan with your phone/i)).toBeNull());
    expect(screen.getByRole("button", { name: "Show pairing string" })).toBeTruthy();
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
    expect(mocks.setRole).toHaveBeenCalledWith("origin");
    expect(setTweak).toHaveBeenCalledWith("syncExperimental", "on");
    expect(mocks.start).toHaveBeenCalledWith("");
    expect(await screen.findByText(/Scan with your phone, or enter this on your other device\./))
      .toBeTruthy();
    const parsed = parsePairPayload(readQrPayload());
    expect(parsed.masterKey).toEqual(mocks.setKey.mock.calls[0][0]);
    expect(parsed.relayUrl).toBe(DEFAULT_RELAY_URL);
    expect(parsed.deviceName).toBe("Cole-PC");
  });

  it("requires confirmation and transports only the managed credential fields", async () => {
    mocks.getKey.mockResolvedValue(MASTER_KEY);
    renderSection({
      aiLicenseKey: "managed-license", aiTrialKey: "trial-that-must-not-win",
      aiModel: "claude-haiku-4-5-20251001", aiEnabled: true,
    });
    const share = await screen.findByRole("button", { name: "Share access…" });
    fireEvent.click(share);
    expect(mocks.sendCredentialOffer).not.toHaveBeenCalled();
    expect(screen.getByText(/Provider API keys and local model endpoints are not shared/i))
      .toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirm share" }));
    await waitFor(() => expect(mocks.sendCredentialOffer).toHaveBeenCalledOnce());
    expect(mocks.sendCredentialOffer.mock.calls[0][0]).toEqual({
      aiLicenseKey: "managed-license", aiModel: "claude-haiku-4-5-20251001",
      aiEnabled: true,
    });
  });

  it("sends nothing and explains the managed-AI requirement for BYOK-only setup", async () => {
    mocks.getKey.mockResolvedValue(MASTER_KEY);
    renderSection({ aiLicenseKey: "", aiTrialKey: "" });
    expect(await screen.findByText(/Set up managed AI on desktop to share access/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Share access…" })).toBeNull();
    expect(mocks.sendCredentialOffer).not.toHaveBeenCalled();
  });

  it("encodes a custom relay tweak into the pairing QR instead of the default", async () => {
    mocks.getKey.mockResolvedValue(null);
    renderSection({ syncRelayUrl: "wss://relay.example.test" });
    fireEvent.click(await screen.findByRole("button", { name: "Enable sync on this device" }));
    await waitFor(() => expect(mocks.setKey).toHaveBeenCalled());
    expect(parsePairPayload(readQrPayload()).relayUrl).toBe("wss://relay.example.test");
  });

  it("shows the pairing QR again from 'Show pairing string' for an already-enabled device", async () => {
    mocks.getKey.mockResolvedValue(MASTER_KEY);
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Show pairing string" }));
    const parsed = await waitFor(() => parsePairPayload(readQrPayload()));
    expect(parsed.masterKey).toEqual(MASTER_KEY);
    expect(parsed.relayUrl).toBe(DEFAULT_RELAY_URL);
  });

  it("marks a pairing-string device as joined and explains local-only projects", async () => {
    mocks.getKey.mockResolvedValue(null);
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "I have a pairing string" }));
    expect(screen.getByText(/Projects on this device stay local-only/i)).toBeTruthy();
    const pairingString = encodeMasterKey(MASTER_KEY);
    fireEvent.change(screen.getByLabelText("Pairing string"), { target: { value: pairingString } });
    fireEvent.click(screen.getByRole("button", { name: "Connect this device" }));
    await waitFor(() => expect(mocks.setRole).toHaveBeenCalledWith("joined"));
  });
});
