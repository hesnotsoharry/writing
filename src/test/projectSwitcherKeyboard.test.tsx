// @vitest-environment jsdom
/**
 * ProjectSwitcher keyboard navigation — contract tests.
 *
 * Required floor: pure clampIndex helper unit tests (no DOM, no React).
 * Optional render-level tests: ArrowDown / ArrowUp / Escape via jsdom focus tracking.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clampIndex,ProjectSwitcher } from "../binder/ProjectSwitcher";
import type { Project } from "../db/binderStore";

afterEach(cleanup);

// ── clampIndex — pure helper unit tests (required floor) ─────────────────

describe("clampIndex — clamping below zero", () => {
  it("returns 0 when next is -1 (one below the floor)", () => {
    expect(clampIndex(-1, 3)).toBe(0);
  });

  it("returns 0 when next is a large negative number", () => {
    expect(clampIndex(-99, 5)).toBe(0);
  });
});

describe("clampIndex — clamping above count-1", () => {
  it("returns count-1 when next equals count exactly", () => {
    expect(clampIndex(3, 3)).toBe(2);
  });

  it("returns count-1 when next is well above count", () => {
    expect(clampIndex(10, 4)).toBe(3);
  });
});

describe("clampIndex — normal step within range", () => {
  it("returns next unchanged when next is in the middle of the range", () => {
    expect(clampIndex(1, 3)).toBe(1);
  });

  it("returns 0 unchanged when already at the first item", () => {
    expect(clampIndex(0, 4)).toBe(0);
  });

  it("returns count-1 unchanged when already at the last item", () => {
    expect(clampIndex(3, 4)).toBe(3);
  });
});

describe("clampIndex — New-manuscript row included in count (count = N+1)", () => {
  it("clamps correctly when count includes the New-manuscript row as the last item", () => {
    // 2 projects + 1 "New manuscript…" row = count 3, valid indices [0, 1, 2]
    expect(clampIndex(3, 3)).toBe(2); // ArrowDown from last item stays at 2
    expect(clampIndex(2, 3)).toBe(2); // New-manuscript row index is reachable
    expect(clampIndex(1, 3)).toBe(1); // middle item unaffected
  });

  it("returns 0 for count=0 guard (empty list edge case)", () => {
    expect(clampIndex(0, 0)).toBe(0);
  });
});

// ── Render-level keyboard tests (jsdom focus tracking) ───────────────────

const PROJECTS: Project[] = [
  { id: "p1", title: "First Novel", type: "novel", sort_order: 0, created_at: "", updated_at: "" },
  { id: "p2", title: "Short Stories", type: "collection", sort_order: 1, created_at: "", updated_at: "" },
];

function renderSwitcher(overrides: Partial<Parameters<typeof ProjectSwitcher>[0]> = {}) {
  const onSwitchProject = vi.fn();
  const onCreateProject = vi.fn();
  const { container } = render(
    <ProjectSwitcher
      projects={PROJECTS}
      activeProjectId="p1"
      onSwitchProject={onSwitchProject}
      onCreateProject={onCreateProject}
      {...overrides}
    />,
  );
  return { container, onSwitchProject, onCreateProject };
}

describe("ProjectSwitcher — trigger ArrowDown/Up opens menu", () => {
  it("ArrowDown on the trigger opens the menu and focuses the active project item", () => {
    const { container } = renderSwitcher();
    expect(container.querySelector(".proj-menu")).toBeNull();
    act(() => { fireEvent.keyDown(container.querySelector(".proj-btn")!, { key: "ArrowDown" }); });
    expect(container.querySelector(".proj-menu")).not.toBeNull();
    // useEffect focuses the active (p1) item on mount — assert DOM focus, not just menu presence
    expect(document.activeElement).toBe(container.querySelector(".proj-item.on"));
  });

  it("ArrowUp on the trigger button also opens the dropdown menu", () => {
    const { container } = renderSwitcher();
    fireEvent.keyDown(container.querySelector(".proj-btn")!, { key: "ArrowUp" });
    expect(container.querySelector(".proj-menu")).not.toBeNull();
  });

  it("Enter on the trigger does not open the menu (only ArrowDown/Up trigger open)", () => {
    const { container } = renderSwitcher();
    fireEvent.keyDown(container.querySelector(".proj-btn")!, { key: "Enter" });
    expect(container.querySelector(".proj-menu")).toBeNull();
  });
});

describe("ProjectSwitcher — Escape closes the menu and refocuses trigger", () => {
  it("Escape on an open menu item closes the dropdown and returns focus to the trigger button", () => {
    const { container } = renderSwitcher();
    fireEvent.click(container.querySelector(".proj-btn")!);
    expect(container.querySelector(".proj-menu")).not.toBeNull();
    const firstItem = container.querySelector(".proj-item") as HTMLElement;
    act(() => { fireEvent.keyDown(firstItem, { key: "Escape" }); });
    expect(container.querySelector(".proj-menu")).toBeNull();
    // onFocusTrigger() must have fired — trigger has focus so user can reopen without mouse
    expect(document.activeElement).toBe(container.querySelector(".proj-btn"));
  });
});

describe("ProjectSwitcher — ArrowUp moves focus backward", () => {
  it("ArrowUp on the second item moves DOM focus back to the first item", () => {
    const { container } = renderSwitcher();
    fireEvent.click(container.querySelector(".proj-btn")!);
    const items = container.querySelectorAll(".proj-item");
    // Move forward first (activeIndex 0→1), then reverse (1→0)
    act(() => { fireEvent.keyDown(items[0], { key: "ArrowDown" }); });
    expect(document.activeElement).toBe(items[1]);
    act(() => { fireEvent.keyDown(items[1], { key: "ArrowUp" }); });
    expect(document.activeElement).toBe(items[0]);
  });

  it("ArrowUp stays on the first item when already at index 0 (no wrap)", () => {
    const { container } = renderSwitcher();
    fireEvent.click(container.querySelector(".proj-btn")!);
    const items = container.querySelectorAll(".proj-item");
    // activeIndex starts at 0 (active project p1); pressing ArrowUp should clamp at 0
    act(() => { fireEvent.keyDown(items[0], { key: "ArrowUp" }); });
    expect(document.activeElement).toBe(items[0]);
  });
});

describe("ProjectSwitcher — ArrowDown moves focus between items", () => {
  it("ArrowDown on the first item moves DOM focus to the second item", () => {
    const { container } = renderSwitcher();
    fireEvent.click(container.querySelector(".proj-btn")!);
    const items = container.querySelectorAll(".proj-item");
    // After open, useEffect focuses the active (first / p1) item; activeIndex=0
    act(() => { fireEvent.keyDown(items[0], { key: "ArrowDown" }); });
    expect(document.activeElement).toBe(items[1]);
  });

  it("ArrowDown stays on the last item when already at count-1 (no wrap)", () => {
    const { container } = renderSwitcher();
    fireEvent.click(container.querySelector(".proj-btn")!);
    const items = container.querySelectorAll(".proj-item");
    // Navigate to last proj-item (index 1 of 2 projects), then to New manuscript (index 2)
    act(() => { fireEvent.keyDown(items[0], { key: "ArrowDown" }); }); // 0→1
    act(() => { fireEvent.keyDown(items[1], { key: "ArrowDown" }); }); // 1→2 (New manuscript)
    const newBtn = container.querySelector(".proj-new") as HTMLElement;
    act(() => { fireEvent.keyDown(newBtn, { key: "ArrowDown" }); }); // 2→2 (clamped)
    expect(document.activeElement).toBe(newBtn);
  });
});
