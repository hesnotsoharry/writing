// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Settings } from "../features/settings/Settings";
import { getTweak, SPELLCHECK_KEY } from "../features/settings/settings.store";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const baseProps = {
  onClose: vi.fn(),
  setTheme: vi.fn(),
  setAccent: vi.fn(),
};

describe("Settings", () => {
  it("renders all five nav section labels", () => {
    render(<Settings {...baseProps} />);
    // Each nav label appears in a set-nav-item button; use getAllByText and check
    // at least one match is a button inside the nav.
    const navEl = document.querySelector(".set-nav") as HTMLElement;
    expect(navEl.querySelector('[class*="set-nav-item"]')).toBeTruthy();
    // Confirm every nav label has a matching button in set-nav
    const navText = navEl.textContent ?? "";
    expect(navText).toContain("Appearance");
    expect(navText).toContain("Editor");
    expect(navText).toContain("Writing");
    expect(navText).toContain("Backup & data");
    expect(navText).toContain("About");
  });

  it("clicking Editor nav shows editor-only row not present in Appearance", () => {
    render(<Settings {...baseProps} />);
    // Appearance is active by default — "Check spelling" should not be visible
    expect(screen.queryByText("Check spelling")).toBeNull();

    fireEvent.click(screen.getAllByText("Editor")[0]);
    expect(screen.getByText("Check spelling")).toBeTruthy();
  });

  it("toggling Check spelling flips the persisted spellCheck value", () => {
    render(<Settings {...baseProps} />);
    // Navigate to Editor
    fireEvent.click(screen.getAllByText("Editor")[0]);

    // Default is true — find the toggle by its container label and click it
    const label = screen.getByText("Check spelling");
    // The toggle div is in the sibling .set-row-c; walk up to .set-row then find .toggle
    const row = label.closest(".set-row") as HTMLElement;
    const toggle = row.querySelector(".toggle") as HTMLElement;
    expect(toggle).toBeTruthy();

    fireEvent.click(toggle);

    // After one click the value flips from true to false
    expect(getTweak(SPELLCHECK_KEY, true)).toBe(false);
  });

  it("clicking Dark theme button calls setTheme prop with 'dark'", () => {
    const setTheme = vi.fn();
    render(<Settings {...baseProps} setTheme={setTheme} />);
    // Appearance is active by default
    fireEvent.click(screen.getByText("Dark"));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("clicking a non-default accent swatch calls setAccent with a 3-tuple", () => {
    const setAccent = vi.fn();
    render(<Settings {...baseProps} setAccent={setAccent} />);
    // Appearance is active — swatches are visible.
    // Click the blue swatch (#3f6f9e), which is not the default clay swatch.
    const swatches = document.querySelectorAll(".set-swatch");
    // swatches[1] is the blue palette
    fireEvent.click(swatches[1]);
    expect(setAccent).toHaveBeenCalledWith(["#3f6f9e", "#315e89", "#dde7f1"]);
  });

  it("clicking the header X button calls onClose", () => {
    const onClose = vi.fn();
    render(<Settings {...baseProps} onClose={onClose} />);
    // The iconbtn close button in set-main-head
    const closeBtn = document.querySelector(".iconbtn") as HTMLElement;
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("Goals Configure button shows fallback toast text when onOpenGoals is absent", () => {
    render(<Settings {...baseProps} />);
    fireEvent.click(screen.getAllByText("Writing")[0]);
    fireEvent.click(screen.getByText(/Configure/i));
    // Toast text should appear in the document
    expect(screen.getByText("Open Writing Goals from the toolbar")).toBeTruthy();
  });

  it("clicking Writing nav shows Writing-section-only text", () => {
    render(<Settings {...baseProps} />);
    // Initially on Appearance, so Writing content should not be visible
    expect(screen.queryByText("Default status for new scenes")).toBeNull();
    // Click Writing nav
    fireEvent.click(screen.getAllByText("Writing")[0]);
    // Writing-only label should appear
    expect(screen.getByText("Default status for new scenes")).toBeTruthy();
  });

  it("clicking Backup & data nav shows Backup-section-only text", () => {
    render(<Settings {...baseProps} />);
    // Initially on Appearance, so Backup content should not be visible
    expect(screen.queryByText("Destination")).toBeNull();
    // Click Backup & data nav
    fireEvent.click(screen.getByText("Backup & data"));
    // Backup-only label should appear
    expect(screen.getByText("Destination")).toBeTruthy();
  });

  it("clicking About nav shows About-section-only text", () => {
    render(<Settings {...baseProps} />);
    // Initially on Appearance, so About content should not be visible
    expect(screen.queryByText("Writers Nook")).toBeNull();
    // Click About nav
    fireEvent.click(screen.getByText("About"));
    // About-only text should appear
    expect(screen.getByText("Writers Nook")).toBeTruthy();
  });

  it("clicking the scrim calls onClose without triggering sheet actions", () => {
    const onClose = vi.fn();
    render(<Settings {...baseProps} onClose={onClose} />);
    // Find the scrim element and click directly on it (not a child)
    const scrim = document.querySelector(".scrim") as HTMLElement;
    expect(scrim).toBeTruthy();
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalled();
  });
});
