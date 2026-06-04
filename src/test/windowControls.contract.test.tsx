// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WindowControls } from "../shell/WindowControls";

// Mock the Tauri window API at the module boundary.
const mockWindowAPI = {
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  close: vi.fn(),
};

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => mockWindowAPI,
}));

afterEach(cleanup);

describe("WindowControls", () => {
  beforeEach(() => {
    // Reset spies before each test so assertions on call counts are isolated.
    mockWindowAPI.minimize.mockClear();
    mockWindowAPI.toggleMaximize.mockClear();
    mockWindowAPI.close.mockClear();
  });

  it("renders all three control buttons with accessible names", () => {
    render(<WindowControls />);

    // Query by accessible name (role-based); do not couple to DOM structure/classes.
    expect(screen.getByRole("button", { name: /minimize/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /maximize|restore/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /close/i })).toBeTruthy();
  });

  it("calls minimize() when Minimize button is clicked", () => {
    render(<WindowControls />);

    const minimizeBtn = screen.getByRole("button", { name: /minimize/i });
    fireEvent.click(minimizeBtn);

    expect(mockWindowAPI.minimize).toHaveBeenCalledOnce();
    expect(mockWindowAPI.toggleMaximize).not.toHaveBeenCalled();
    expect(mockWindowAPI.close).not.toHaveBeenCalled();
  });

  it("calls toggleMaximize() when Maximize button is clicked", () => {
    render(<WindowControls />);

    const maximizeBtn = screen.getByRole("button", { name: /maximize|restore/i });
    fireEvent.click(maximizeBtn);

    expect(mockWindowAPI.toggleMaximize).toHaveBeenCalledOnce();
    expect(mockWindowAPI.minimize).not.toHaveBeenCalled();
    expect(mockWindowAPI.close).not.toHaveBeenCalled();
  });

  it("calls close() when Close button is clicked", () => {
    render(<WindowControls />);

    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);

    expect(mockWindowAPI.close).toHaveBeenCalledOnce();
    expect(mockWindowAPI.minimize).not.toHaveBeenCalled();
    expect(mockWindowAPI.toggleMaximize).not.toHaveBeenCalled();
  });

  it("close button carries .wbtn.close CSS classes so canvas hover styles apply", () => {
    const { container } = render(<WindowControls />);
    // The close button must have both .wbtn and .close so that the CSS rule
    // `.wbtn.close:hover { background: var(--accent); }` targets it.
    const closeBtn = container.querySelector("button.wbtn.close");
    expect(closeBtn).not.toBeNull();
    expect(closeBtn?.getAttribute("aria-label")).toBe("Close");
  });

  it("minimize and maximize buttons carry .wbtn CSS class for consistent hover treatment", () => {
    const { container } = render(<WindowControls />);
    const wbtns = container.querySelectorAll("button.wbtn");
    // Exactly 3 control buttons, all with .wbtn
    expect(wbtns).toHaveLength(3);
  });
});
