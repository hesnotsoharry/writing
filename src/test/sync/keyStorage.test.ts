// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import {
  clearSyncMasterKey,
  getSyncMasterKey,
  hasSyncMasterKey,
  setSyncMasterKey,
} from "../../sync/keyStorage";

describe("sync key storage IPC boundary", () => {
  beforeEach(() => invokeMock.mockReset());

  it("encodes bytes as base64 when setting the master key", async () => {
    invokeMock.mockResolvedValue(undefined);
    await setSyncMasterKey(Uint8Array.from({ length: 32 }, (_, index) => index));
    expect(invokeMock).toHaveBeenCalledWith("sync_set_master_key", {
      keyBase64: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
    });
  });

  it("decodes a stored base64 master key", async () => {
    invokeMock.mockResolvedValue("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=");
    await expect(getSyncMasterKey()).resolves.toEqual(
      Uint8Array.from({ length: 32 }, (_, index) => index),
    );
  });

  it("preserves an unset master key as null", async () => {
    invokeMock.mockResolvedValue(null);
    await expect(getSyncMasterKey()).resolves.toBeNull();
  });

  it("uses the boolean and clear commands without arguments", async () => {
    invokeMock.mockResolvedValueOnce(true).mockResolvedValueOnce(undefined);
    await expect(hasSyncMasterKey()).resolves.toBe(true);
    await clearSyncMasterKey();
    expect(invokeMock).toHaveBeenNthCalledWith(1, "sync_has_master_key");
    expect(invokeMock).toHaveBeenNthCalledWith(2, "sync_clear_master_key");
  });
});
