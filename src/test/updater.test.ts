// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

// Hoist mocks so they exist when the vi.mock factory functions run.
const { mockCheck } = vi.hoisted(() => ({
  mockCheck: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: mockCheck,
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

import { runUpdateCheck } from "../lib/updater";

afterEach(() => {
  vi.clearAllMocks();
});

describe("runUpdateCheck", () => {
  it("returns upToDate when check() resolves null", async () => {
    mockCheck.mockResolvedValue(null);
    const result = await runUpdateCheck();
    expect(result).toBe("upToDate");
  });

  it("returns checkError when check() rejects", async () => {
    mockCheck.mockRejectedValue(new Error("network error"));
    const result = await runUpdateCheck();
    expect(result).toBe("checkError");
  });

  it("returns found and calls onUpdateFound with the update when an update exists", async () => {
    const fakeUpdate = { version: "1.2.3", downloadAndInstall: vi.fn() };
    mockCheck.mockResolvedValue(fakeUpdate);
    const onUpdateFound = vi.fn();
    const result = await runUpdateCheck(onUpdateFound);
    expect(result).toBe("found");
    expect(onUpdateFound).toHaveBeenCalledWith(fakeUpdate);
  });

  it("returns found without error when update exists but no callback is provided", async () => {
    const fakeUpdate = { version: "2.0.0", downloadAndInstall: vi.fn() };
    mockCheck.mockResolvedValue(fakeUpdate);
    const result = await runUpdateCheck();
    expect(result).toBe("found");
  });

  it("does not call onUpdateFound when check() returns null", async () => {
    mockCheck.mockResolvedValue(null);
    const onUpdateFound = vi.fn();
    await runUpdateCheck(onUpdateFound);
    expect(onUpdateFound).not.toHaveBeenCalled();
  });

  it("does not call onUpdateFound when check() rejects", async () => {
    mockCheck.mockRejectedValue(new Error("timeout"));
    const onUpdateFound = vi.fn();
    await runUpdateCheck(onUpdateFound);
    expect(onUpdateFound).not.toHaveBeenCalled();
  });
});
