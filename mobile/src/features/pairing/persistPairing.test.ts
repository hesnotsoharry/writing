import { beforeEach, describe, expect, it, vi } from "vitest";

import * as keyStorage from "../../sync/mobileKeyStorage";
import * as relayUrl from "../../sync/mobileRelayUrl";
import * as syncRole from "../../sync/mobileSyncRole";
import * as pairedDevice from "../../sync/pairedDevice";
import { persistPairing } from "./pairPersistence";

vi.mock("../../sync/mobileKeyStorage", () => ({
  clearSyncMasterKey: vi.fn(async () => undefined),
  setSyncMasterKey: vi.fn(async () => undefined),
}));

vi.mock("../../sync/mobileRelayUrl", () => ({
  setMobileRelayUrlOverride: vi.fn(async () => undefined),
}));

vi.mock("../../sync/mobileSyncRole", () => ({
  clearDeviceJoined: vi.fn(async () => undefined),
  markDeviceJoined: vi.fn(async () => undefined),
}));

vi.mock("../../sync/pairedDevice", () => ({
  clearPairedDeviceName: vi.fn(async () => undefined),
  setPairedDeviceName: vi.fn(async () => undefined),
}));

describe("persistPairing", () => {
  const dummyKey = new Uint8Array([1, 2, 3, 4]);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists key, relay override, device name, and joined role on success", async () => {
    const onSuccess = vi.fn();
    await persistPairing(dummyKey, "wss://custom.relay", "My Desktop", onSuccess);

    expect(keyStorage.setSyncMasterKey).toHaveBeenCalledWith(dummyKey);
    expect(relayUrl.setMobileRelayUrlOverride).toHaveBeenCalledWith("wss://custom.relay");
    expect(pairedDevice.setPairedDeviceName).toHaveBeenCalledWith("My Desktop");
    expect(syncRole.markDeviceJoined).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("cleans up partial credentials and rethrows when SecureStore fails", async () => {
    vi.mocked(keyStorage.setSyncMasterKey).mockRejectedValueOnce(new Error("Keystore failed"));
    const onSuccess = vi.fn();

    await expect(persistPairing(dummyKey, null, null, onSuccess)).rejects.toThrow("Keystore failed");

    expect(keyStorage.clearSyncMasterKey).toHaveBeenCalledOnce();
    expect(syncRole.clearDeviceJoined).toHaveBeenCalledOnce();
    expect(pairedDevice.clearPairedDeviceName).toHaveBeenCalledOnce();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("cleans up partial credentials and rethrows when markDeviceJoined fails", async () => {
    vi.mocked(syncRole.markDeviceJoined).mockRejectedValueOnce(new Error("SQLite disk full"));
    const onSuccess = vi.fn();

    await expect(persistPairing(dummyKey, null, "Desktop", onSuccess)).rejects.toThrow("SQLite disk full");

    expect(keyStorage.clearSyncMasterKey).toHaveBeenCalledOnce();
    expect(syncRole.clearDeviceJoined).toHaveBeenCalledOnce();
    expect(pairedDevice.clearPairedDeviceName).toHaveBeenCalledOnce();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
