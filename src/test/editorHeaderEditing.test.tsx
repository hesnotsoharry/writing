// @vitest-environment jsdom
/**
 * EditorHeader — inline title editing + status picker callback seam.
 *
 * Guards the wiring between EditorHeader's interaction affordances and the
 * onRenameTitle / onSetStatus props. ProseMirror / CDP smoke is out of scope
 * here — these are plain React component unit tests.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorHeader } from "../editor/EditorHeader";

afterEach(cleanup);

const defaultProps = {
  chapterTitle: "Chapter One",
  title: "The Scene",
  status: "draft" as const,
  words: 0,
  characters: 0,
  locations: 0,
};

// ---------------------------------------------------------------------------
// Inline title editing
// ---------------------------------------------------------------------------

describe("EditorHeader — inline title editing", () => {
  it("committing a renamed title calls onRenameTitle with the new string", () => {
    const onRenameTitle = vi.fn();
    const { container } = render(<EditorHeader {...defaultProps} onRenameTitle={onRenameTitle} />);

    fireEvent.click(container.querySelector(".scene-h1") as HTMLElement);
    const input = container.querySelector("input.scene-h1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New Title" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRenameTitle).toHaveBeenCalledOnce();
    expect(onRenameTitle).toHaveBeenCalledWith("New Title");
  });

  it("committing via blur calls onRenameTitle with the changed value", () => {
    const onRenameTitle = vi.fn();
    const { container } = render(<EditorHeader {...defaultProps} onRenameTitle={onRenameTitle} />);

    fireEvent.click(container.querySelector(".scene-h1") as HTMLElement);
    const input = container.querySelector("input.scene-h1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Blur Title" } });
    fireEvent.blur(input);

    expect(onRenameTitle).toHaveBeenCalledWith("Blur Title");
  });

  it("pressing Escape cancels the edit without calling onRenameTitle", () => {
    const onRenameTitle = vi.fn();
    const { container } = render(<EditorHeader {...defaultProps} onRenameTitle={onRenameTitle} />);

    fireEvent.click(container.querySelector(".scene-h1") as HTMLElement);
    const input = container.querySelector("input.scene-h1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Should Not Save" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onRenameTitle).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "The Scene" })).toBeInTheDocument();
  });

  it("empty title on commit does NOT call onRenameTitle (reverts to prior)", () => {
    const onRenameTitle = vi.fn();
    const { container } = render(<EditorHeader {...defaultProps} onRenameTitle={onRenameTitle} />);

    fireEvent.click(container.querySelector(".scene-h1") as HTMLElement);
    const input = container.querySelector("input.scene-h1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRenameTitle).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "The Scene" })).toBeInTheDocument();
  });

  it("whitespace-only title on commit does NOT call onRenameTitle", () => {
    const onRenameTitle = vi.fn();
    const { container } = render(<EditorHeader {...defaultProps} onRenameTitle={onRenameTitle} />);

    fireEvent.click(container.querySelector(".scene-h1") as HTMLElement);
    const input = container.querySelector("input.scene-h1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRenameTitle).not.toHaveBeenCalled();
  });

  it("when onRenameTitle is absent, clicking the title is a no-op — no input appears, no throw", () => {
    const { container } = render(<EditorHeader {...defaultProps} />);
    const h1 = container.querySelector(".scene-h1") as HTMLElement;

    expect(() => fireEvent.click(h1)).not.toThrow();
    expect(container.querySelector("input")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Status picker
// ---------------------------------------------------------------------------

describe("EditorHeader — status picker", () => {
  it("clicking the status badge opens the context menu", () => {
    render(<EditorHeader {...defaultProps} onSetStatus={vi.fn()} />);

    fireEvent.click(screen.getByText("Drafting"));

    expect(document.body.querySelector(".cm")).not.toBeNull();
  });

  it("choosing 'Final' from the picker calls onSetStatus with 'final'", () => {
    const onSetStatus = vi.fn();
    render(<EditorHeader {...defaultProps} onSetStatus={onSetStatus} />);

    fireEvent.click(screen.getByText("Drafting"));
    const finalItem = Array.from(document.body.querySelectorAll(".cm-item"))
      .find((el) => el.textContent?.includes("Final")) as HTMLElement;
    expect(finalItem).not.toBeNull();
    fireEvent.click(finalItem);

    expect(onSetStatus).toHaveBeenCalledOnce();
    expect(onSetStatus).toHaveBeenCalledWith("final");
  });

  it("choosing 'To write' from the picker calls onSetStatus with 'blank'", () => {
    const onSetStatus = vi.fn();
    render(<EditorHeader {...defaultProps} onSetStatus={onSetStatus} />);

    fireEvent.click(screen.getByText("Drafting"));
    const blankItem = Array.from(document.body.querySelectorAll(".cm-item"))
      .find((el) => el.textContent?.includes("To write")) as HTMLElement;
    expect(blankItem).not.toBeNull();
    fireEvent.click(blankItem);

    expect(onSetStatus).toHaveBeenCalledWith("blank");
  });

  it("when onSetStatus is absent, clicking the status badge is a no-op — no menu, no throw", () => {
    render(<EditorHeader {...defaultProps} />);

    expect(() => fireEvent.click(screen.getByText("Drafting"))).not.toThrow();
    expect(document.body.querySelector(".cm")).toBeNull();
  });
});
