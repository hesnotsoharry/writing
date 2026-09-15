// @vitest-environment jsdom
/**
 * useWhatsNew — hook-level tests: fresh install stores silently, a version
 * bump with real CHANGELOG.md notes (pinned to the 0.13.1 entry, whose "What's new"
 * bullet the assertion reads; it was 0.12.9 until that entry was renamed) shows and defers the store until
 * dismiss, and the `blocked` gate (UpdateModal open) suppresses rendering
 * without losing the pending notes.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetVersion } = vi.hoisted(() => ({
  mockGetVersion: vi.fn(),
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: mockGetVersion,
}));

import { useWhatsNew } from "../features/updater/useWhatsNew";

const LAST_SEEN_KEY = "writing.lastSeenVersion";

beforeEach(() => {
  localStorage.clear();
  mockGetVersion.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useWhatsNew", () => {
  it("fresh install: stores the current version silently, never opens", async () => {
    mockGetVersion.mockResolvedValue("0.13.1");
    const { result } = renderHook(() => useWhatsNew(false));

    await waitFor(() => {
      expect(localStorage.getItem(LAST_SEEN_KEY)).toBe("0.13.1");
    });
    expect(result.current.open).toBe(false);
  });

  it("upgrade from a build without lastSeenVersion (other writing.* state present) opens", async () => {
    localStorage.setItem("writing.goalsOn", "true");
    mockGetVersion.mockResolvedValue("0.13.1");
    const { result } = renderHook(() => useWhatsNew(false));

    await waitFor(() => expect(result.current.open).toBe(true));
    expect(result.current.version).toBe("0.13.1");
  });

  it("relaunch after an in-app update (pending flag) opens, and the flag is consumed", async () => {
    localStorage.setItem("writing.pendingWhatsNew", "1");
    mockGetVersion.mockResolvedValue("0.13.1");
    const { result } = renderHook(() => useWhatsNew(false));

    await waitFor(() => expect(result.current.open).toBe(true));
    expect(localStorage.getItem("writing.pendingWhatsNew")).toBeNull();
  });

  it("version change with real CHANGELOG.md notes opens, and dismiss stores the version", async () => {
    localStorage.setItem(LAST_SEEN_KEY, "0.13.0");
    mockGetVersion.mockResolvedValue("0.13.1");
    const { result } = renderHook(() => useWhatsNew(false));

    await waitFor(() => expect(result.current.open).toBe(true));
    expect(result.current.version).toBe("0.13.1");
    expect(result.current.notes).toContain("What's new");
    // Not stored yet — only on dismiss.
    expect(localStorage.getItem(LAST_SEEN_KEY)).toBe("0.13.0");

    act(() => result.current.dismiss());
    expect(localStorage.getItem(LAST_SEEN_KEY)).toBe("0.13.1");
    expect(result.current.open).toBe(false);
  });

  it("blocked (an UpdateModal is showing) suppresses open without losing the pending notes", async () => {
    localStorage.setItem(LAST_SEEN_KEY, "0.13.0");
    mockGetVersion.mockResolvedValue("0.13.1");
    const { result, rerender } = renderHook(({ blocked }) => useWhatsNew(blocked), {
      initialProps: { blocked: true },
    });

    await waitFor(() => expect(result.current.notes).toContain("What's new"));
    expect(result.current.open).toBe(false);

    rerender({ blocked: false });
    await waitFor(() => expect(result.current.open).toBe(true));
  });

  it("same version as last seen: no store, no open", async () => {
    localStorage.setItem(LAST_SEEN_KEY, "0.13.1");
    mockGetVersion.mockResolvedValue("0.13.1");
    const { result } = renderHook(() => useWhatsNew(false));

    await waitFor(() => expect(mockGetVersion).toHaveBeenCalled());
    expect(result.current.open).toBe(false);
    expect(localStorage.getItem(LAST_SEEN_KEY)).toBe("0.13.1");
  });
});
