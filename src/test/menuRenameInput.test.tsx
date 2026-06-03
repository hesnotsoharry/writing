// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RenameInput } from "../components/menu/RenameInput";

afterEach(cleanup);

/**
 * RenameInput keyboard contract.
 *
 * Enter → onCommit(currentValue); Escape → onCancel(); other keys → neither.
 * Blur also commits (same as source), but keyboard paths are the primary contract.
 */

describe("RenameInput — Enter commits with current value", () => {
  it("calls onCommit with the current input value when Enter is pressed", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(<RenameInput value="Old name" onCommit={onCommit} onCancel={onCancel} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New name" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("New name");
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("commits with the original value when the input is cleared and Enter is pressed", () => {
    // Source fallback: v.trim() || value → falls back to original when trimmed is empty.
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(<RenameInput value="Original" onCommit={onCommit} onCancel={onCancel} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCommit).toHaveBeenCalledWith("Original");
  });
});

describe("RenameInput — Escape cancels", () => {
  it("calls onCancel when Escape is pressed", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(<RenameInput value="Old name" onCommit={onCommit} onCancel={onCancel} />);

    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not also commit when Escape is followed by focus loss (one-shot guard)", () => {
    // Escape fires onCancel; the resulting blur must NOT also commit a cancelled rename.
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(<RenameInput value="Old name" onCommit={onCommit} onCancel={onCancel} />);

    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe("RenameInput — other keys do not trigger commit or cancel", () => {
  it("does not call onCommit or onCancel for ArrowDown", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(<RenameInput value="Name" onCommit={onCommit} onCancel={onCancel} />);

    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Tab" });
    fireEvent.keyDown(input, { key: "a" });

    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe("RenameInput — initial value", () => {
  it("renders the input with the provided initial value", () => {
    render(
      <RenameInput value="Chapter One" onCommit={vi.fn()} onCancel={vi.fn()} />,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("Chapter One");
  });
});
