// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Toast } from "../components/menu/Toast";

afterEach(cleanup);

/**
 * Toast auto-dismiss and undo contract.
 *
 * onClose must NOT fire before 5 000 ms; it MUST fire at exactly 5 000 ms.
 * Clicking Undo calls onUndo (does not close automatically in the same tick).
 */

describe("Toast — auto-dismiss timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call onClose before 5 000 ms", () => {
    const onClose = vi.fn();
    const onUndo = vi.fn();
    render(<Toast toast={{ label: "Deleted", undo: true }} onUndo={onUndo} onClose={onClose} />);

    vi.advanceTimersByTime(4999);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose at exactly 5 000 ms", () => {
    const onClose = vi.fn();
    const onUndo = vi.fn();
    render(<Toast toast={{ label: "Deleted", undo: true }} onUndo={onUndo} onClose={onClose} />);

    vi.advanceTimersByTime(5000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clears the timer on unmount so onClose is not called after component is removed", () => {
    const onClose = vi.fn();
    const onUndo = vi.fn();
    const { unmount } = render(
      <Toast toast={{ label: "Deleted", undo: false }} onUndo={onUndo} onClose={onClose} />,
    );

    vi.advanceTimersByTime(3000);
    unmount();
    vi.advanceTimersByTime(5000);

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Toast — undo button", () => {
  it("calls onUndo when the Undo button is clicked", () => {
    const onClose = vi.fn();
    const onUndo = vi.fn();
    render(<Toast toast={{ label: "Deleted", undo: true }} onUndo={onUndo} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("does not show the Undo button when toast.undo is false", () => {
    const onClose = vi.fn();
    const onUndo = vi.fn();
    render(<Toast toast={{ label: "Deleted", undo: false }} onUndo={onUndo} onClose={onClose} />);

    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });
});

describe("Toast — null state", () => {
  it("renders nothing when toast prop is null", () => {
    const { container } = render(
      <Toast toast={null} onUndo={vi.fn()} onClose={vi.fn()} />,
    );
    expect(container.querySelector(".toast-wrap")).toBeNull();
  });
});
