// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickCapture } from "../features/quickcapture/QuickCapture";
import { QUICK_NOTES_CHANGED_EVENT } from "../lib/settings";

afterEach(() => {
  cleanup();
});

describe("QuickCapture", () => {
  function makeStore() {
    return { create: vi.fn().mockResolvedValue("id") };
  }

  it("renders with class qc-pop and no .scrim element", () => {
    const store = makeStore();
    const { container } = render(
      <QuickCapture
        onClose={vi.fn()}
        activeProjectId="p1"
        setHasQuickItems={vi.fn()}
        store={store}
      />,
    );
    expect(container.querySelector(".qc-pop")).not.toBeNull();
    expect(container.querySelector(".scrim")).toBeNull();
  });

  it("disables Capture button when textarea is empty", () => {
    const store = makeStore();
    render(
      <QuickCapture
        onClose={vi.fn()}
        activeProjectId="p1"
        setHasQuickItems={vi.fn()}
        store={store}
      />,
    );
    expect(screen.getByText("Capture").closest("button")).toBeDisabled();
  });

  it("disables Capture button when activeProjectId is null even with text", () => {
    const store = makeStore();
    render(
      <QuickCapture
        onClose={vi.fn()}
        activeProjectId={null}
        setHasQuickItems={vi.fn()}
        store={store}
      />,
    );
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "some text" } });
    expect(screen.getByText("Capture").closest("button")).toBeDisabled();
  });

  it("calls store.create, setHasQuickItems(true), dispatches QUICK_NOTES_CHANGED_EVENT, and calls onClose after capture", async () => {
    const store = makeStore();
    const setHasQuickItems = vi.fn();
    const onClose = vi.fn();
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    render(
      <QuickCapture
        onClose={onClose}
        activeProjectId="p1"
        setHasQuickItems={setHasQuickItems}
        store={store}
      />,
    );
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "  my thought  " } });
    const captureBtn = screen.getByText("Capture").closest("button")!;
    expect(captureBtn).not.toBeDisabled();
    fireEvent.click(captureBtn);
    // wait for the async store.create promise to resolve
    await vi.waitFor(() => {
      expect(store.create).toHaveBeenCalledWith("p1", "my thought");
      expect(setHasQuickItems).toHaveBeenCalledWith(true);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: QUICK_NOTES_CHANGED_EVENT }),
      );
      expect(onClose).toHaveBeenCalled();
    });
    dispatchSpy.mockRestore();
  });

  it("Cancel button calls onClose", () => {
    const store = makeStore();
    const onClose = vi.fn();
    render(
      <QuickCapture
        onClose={onClose}
        activeProjectId="p1"
        setHasQuickItems={vi.fn()}
        store={store}
      />,
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("whitespace-only input keeps Capture button disabled", () => {
    const store = makeStore();
    render(
      <QuickCapture
        onClose={vi.fn()}
        activeProjectId="p1"
        setHasQuickItems={vi.fn()}
        store={store}
      />,
    );
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "   " } });
    expect(screen.getByText("Capture").closest("button")).toBeDisabled();
  });

  it("failed write keeps dialog open, does not call setHasQuickItems(true), and does not dispatch event", async () => {
    const errorStore = { create: vi.fn().mockRejectedValue(new Error("boom")) };
    const setHasQuickItems = vi.fn();
    const onClose = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    render(
      <QuickCapture
        onClose={onClose}
        activeProjectId="p1"
        setHasQuickItems={setHasQuickItems}
        store={errorStore}
      />,
    );
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "some text" } });
    fireEvent.click(screen.getByText("Capture").closest("button")!);
    await vi.waitFor(() => {
      expect(errorStore.create).toHaveBeenCalledOnce();
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(setHasQuickItems).not.toHaveBeenCalledWith(true);
    expect(dispatchSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: QUICK_NOTES_CHANGED_EVENT }),
    );
    errorSpy.mockRestore();
    dispatchSpy.mockRestore();
  });

  it("double-click calls store.create exactly once due to isSubmitting guard", async () => {
    const store = makeStore();
    render(
      <QuickCapture
        onClose={vi.fn()}
        activeProjectId="p1"
        setHasQuickItems={vi.fn()}
        store={store}
      />,
    );
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "my thought" } });
    const captureBtn = screen.getByText("Capture").closest("button")!;
    fireEvent.click(captureBtn);
    fireEvent.click(captureBtn);
    await vi.waitFor(() => {
      expect(store.create).toHaveBeenCalledTimes(1);
    });
  });
});
