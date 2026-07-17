// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectSwitcher } from "../binder/ProjectSwitcher";
import type { Project } from "../db/binderStore";

afterEach(cleanup);

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

describe("ProjectSwitcher", () => {
  it("renders the active project title in the proj-btn", () => {
    const { container } = renderSwitcher();
    const btn = container.querySelector(".proj-btn");
    expect(btn?.querySelector(".proj-title")?.textContent).toBe("First Novel");
  });

  it("reveals the proj-menu when the button is clicked", () => {
    const { container } = renderSwitcher();
    expect(container.querySelector(".proj-menu")).toBeNull();
    fireEvent.click(container.querySelector(".proj-btn")!);
    expect(container.querySelector(".proj-menu")).not.toBeNull();
    // Both project items should appear.
    const items = container.querySelectorAll(".proj-item");
    expect(items).toHaveLength(2);
  });

  it("calls onSwitchProject with the correct id when a non-active item is clicked", () => {
    const { container, onSwitchProject } = renderSwitcher();
    fireEvent.click(container.querySelector(".proj-btn")!);
    // Second item is "Short Stories" (p2) — non-active.
    const items = container.querySelectorAll(".proj-item");
    fireEvent.click(items[1]);
    expect(onSwitchProject).toHaveBeenCalledOnce();
    expect(onSwitchProject).toHaveBeenCalledWith("p2");
  });

  it("opens the title entry when 'New manuscript…' is clicked", () => {
    const { container, onCreateProject } = renderSwitcher();
    fireEvent.click(container.querySelector(".proj-btn")!);
    fireEvent.click(screen.getByText(/New manuscript/));
    expect(screen.getByRole("dialog")).not.toBeNull();
    expect(onCreateProject).not.toHaveBeenCalled();
  });

  it("submits a trimmed manuscript title through the creation callback", () => {
    const { container, onCreateProject } = renderSwitcher();
    fireEvent.click(container.querySelector(".proj-btn")!);
    fireEvent.click(screen.getByText(/New manuscript/));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "  The Long Road  " } });
    fireEvent.click(screen.getByRole("button", { name: "Create manuscript" }));
    expect(onCreateProject).toHaveBeenCalledOnce();
    expect(onCreateProject).toHaveBeenCalledWith("The Long Road");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not write for blank submission or cancellation", () => {
    const { container, onCreateProject } = renderSwitcher();
    fireEvent.click(container.querySelector(".proj-btn")!);
    fireEvent.click(screen.getByText(/New manuscript/));
    fireEvent.click(screen.getByRole("button", { name: "Create manuscript" }));
    expect(onCreateProject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCreateProject).not.toHaveBeenCalled();
  });

  it("closes title entry on Escape without creating", () => {
    const { container, onCreateProject } = renderSwitcher();
    fireEvent.click(container.querySelector(".proj-btn")!);
    fireEvent.click(screen.getByText(/New manuscript/));
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onCreateProject).not.toHaveBeenCalled();
  });

  it("shows word count in active subtitle when activeWords is passed", () => {
    const { container } = renderSwitcher({ activeWords: 42000 });
    // Active project subtitle on the button.
    const activeSub = container.querySelector(".proj-btn .proj-sub");
    expect(activeSub?.textContent).toBe("Novel · 42,000 words");
  });

  it("does not show word count in non-active item subtitle", () => {
    const { container } = renderSwitcher({ activeWords: 42000 });
    fireEvent.click(container.querySelector(".proj-btn")!);
    // Second item (p2, non-active) should show only the type label.
    const items = container.querySelectorAll(".proj-item");
    const nonActiveSub = items[1].querySelector(".ps");
    expect(nonActiveSub?.textContent).toBe("Collection");
  });

  it("mouseDown on the backdrop closes the menu", () => {
    const { container } = renderSwitcher();
    fireEvent.click(container.querySelector(".proj-btn")!);
    expect(container.querySelector(".proj-menu")).not.toBeNull();
    fireEvent.mouseDown(container.querySelector(".cm-backdrop")!);
    expect(container.querySelector(".proj-menu")).toBeNull();
  });

  it("only the active proj-item carries the 'on' class", () => {
    const { container } = renderSwitcher({ activeProjectId: "p1" });
    fireEvent.click(container.querySelector(".proj-btn")!);
    const items = container.querySelectorAll(".proj-item");
    expect(items[0].classList.contains("on")).toBe(true);
    expect(items[1].classList.contains("on")).toBe(false);
  });
});
