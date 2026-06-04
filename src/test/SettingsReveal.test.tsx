// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Settings } from "../features/settings/Settings";

// Mock Tauri path and core modules. Declared via vi.hoisted so they exist when
// the hoisted vi.mock factories below run (factories are lifted above plain const).
const { mockInvoke, mockAppConfigDir } = vi.hoisted(() => ({
  mockInvoke: vi.fn().mockResolvedValue(undefined),
  mockAppConfigDir: vi.fn().mockResolvedValue("C:\\fake\\appconfig\\dir"),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@tauri-apps/api/path", () => ({
  appConfigDir: mockAppConfigDir,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseProps = {
  onClose: vi.fn(),
  setTheme: vi.fn(),
  setAccent: vi.fn(),
};

describe("Settings Reveal button (Backup & data)", () => {
  it("clicking Reveal button calls invoke with open_path and appConfigDir result", async () => {
    render(<Settings {...baseProps} />);

    // Navigate to Backup & data section
    fireEvent.click(screen.getByText("Backup & data"));

    // Confirm the section is visible
    expect(screen.getByText("Destination")).toBeTruthy();

    // Click the Reveal button
    const revealBtn = screen.getByText("Reveal");
    fireEvent.click(revealBtn);

    // Wait for the full async chain (appConfigDir resolve → openPath → invoke).
    // Asserting inside waitFor makes this deterministic regardless of microtask timing.
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("open_path", { path: "C:\\fake\\appconfig\\dir" });
    });
  });
});
