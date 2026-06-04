// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Inbox } from "../features/inbox/Inbox";
import type { QuickNote } from "../features/quickcapture/SqliteQuickNoteStore";

afterEach(cleanup);

function makeNote(over: Partial<QuickNote> = {}): QuickNote {
  return {
    id: "n1",
    project_id: "p1",
    body: "Hello world",
    created_at: Date.now() - 1000 * 60 * 5, // 5 minutes ago
    filed: 0,
    ...over,
  };
}

function makeStore(notes: QuickNote[] = [makeNote()]) {
  return {
    listUnfiled: vi.fn().mockResolvedValue(notes),
    updateBody: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    markFiled: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Inbox", () => {
  it("renders unfiled notes from store.listUnfiled", async () => {
    const notes = [makeNote({ id: "n1", body: "First note" }), makeNote({ id: "n2", body: "Second note" })];
    const store = makeStore(notes);
    render(
      <Inbox onClose={vi.fn()} activeProjectId="p1" setHasQuickItems={vi.fn()} store={store} />
    );
    await screen.findByText("First note");
    expect(screen.getByText("Second note")).toBeTruthy();
    expect(store.listUnfiled).toHaveBeenCalledWith("p1");
  });

  it("shows empty-hint when listUnfiled returns []", async () => {
    const store = makeStore([]);
    render(
      <Inbox onClose={vi.fn()} activeProjectId="p1" setHasQuickItems={vi.fn()} store={store} />
    );
    await screen.findByText(/inbox is empty/i);
  });

  it("delete: calls store.delete(id), removes note from list, and calls setHasQuickItems(false) when last note removed", async () => {
    const note = makeNote({ id: "n1", body: "Only note" });
    const store = makeStore([note]);
    const setHasQuickItems = vi.fn();
    render(
      <Inbox onClose={vi.fn()} activeProjectId="p1" setHasQuickItems={setHasQuickItems} store={store} />
    );
    await screen.findByText("Only note");
    const deleteBtn = screen.getByTitle("Delete note");
    fireEvent.click(deleteBtn);
    await screen.findByText(/inbox is empty/i);
    expect(store.delete).toHaveBeenCalledWith("n1");
    expect(setHasQuickItems).toHaveBeenCalledWith(false);
  });

  it("edit: entering edit mode, changing text, blurring calls store.updateBody(id, newBody)", async () => {
    const note = makeNote({ id: "n1", body: "Original text" });
    const store = makeStore([note]);
    render(
      <Inbox onClose={vi.fn()} activeProjectId="p1" setHasQuickItems={vi.fn()} store={store} />
    );
    await screen.findByText("Original text");
    fireEvent.click(screen.getByTitle("Click to edit"));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Updated text" } });
    fireEvent.blur(textarea);
    await vi.waitFor(() => {
      expect(store.updateBody).toHaveBeenCalledWith("n1", "Updated text");
    });
  });

  it("promote: calls injected promote(note), removes note from list, and calls setHasQuickItems", async () => {
    const note = makeNote({ id: "n1", body: "Promote me" });
    const store = makeStore([note]);
    const promote = vi.fn().mockResolvedValue(undefined);
    const setHasQuickItems = vi.fn();
    render(
      <Inbox onClose={vi.fn()} activeProjectId="p1" setHasQuickItems={setHasQuickItems}
        store={store} promote={promote} />
    );
    await screen.findByText("Promote me");
    fireEvent.click(screen.getByTitle("Promote to scene"));
    await screen.findByText(/inbox is empty/i);
    expect(promote).toHaveBeenCalledWith(note);
    expect(setHasQuickItems).toHaveBeenCalledWith(false);
  });

  // ── New cases (wave-13 hardening) ───────────────────────────────────────

  it("project-switch reload: re-calls listUnfiled with new projectId and shows new note", async () => {
    const noteA = makeNote({ id: "nA", body: "Note A", project_id: "A" });
    const noteB = makeNote({ id: "nB", body: "Note B", project_id: "B" });
    const store = {
      listUnfiled: vi.fn()
        .mockResolvedValueOnce([noteA])
        .mockResolvedValueOnce([noteB]),
      updateBody: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      markFiled: vi.fn().mockResolvedValue(undefined),
    };
    const { rerender } = render(
      <Inbox onClose={vi.fn()} activeProjectId="A" setHasQuickItems={vi.fn()} store={store} />
    );
    await screen.findByText("Note A");
    expect(store.listUnfiled).toHaveBeenCalledWith("A");

    rerender(
      <Inbox onClose={vi.fn()} activeProjectId="B" setHasQuickItems={vi.fn()} store={store} />
    );
    await screen.findByText("Note B");
    expect(store.listUnfiled).toHaveBeenCalledWith("B");
  });

  it("failed delete keeps the note in DOM and does not call setHasQuickItems(false)", async () => {
    const note = makeNote({ id: "n1", body: "Stubborn note" });
    const store = makeStore([note]);
    store.delete = vi.fn().mockRejectedValue(new Error("DB error"));
    const setHasQuickItems = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <Inbox onClose={vi.fn()} activeProjectId="p1" setHasQuickItems={setHasQuickItems} store={store} />
    );
    await screen.findByText("Stubborn note");
    fireEvent.click(screen.getByTitle("Delete note"));
    // Give the rejected promise a tick to settle.
    await vi.waitFor(() => expect(store.delete).toHaveBeenCalledWith("n1"));
    expect(screen.queryByText("Stubborn note")).toBeTruthy();
    expect(setHasQuickItems).not.toHaveBeenCalledWith(false);
    errorSpy.mockRestore();
  });

  it("unchanged edit does not call store.updateBody", async () => {
    const note = makeNote({ id: "n1", body: "Same text" });
    const store = makeStore([note]);
    render(
      <Inbox onClose={vi.fn()} activeProjectId="p1" setHasQuickItems={vi.fn()} store={store} />
    );
    await screen.findByText("Same text");
    fireEvent.click(screen.getByTitle("Click to edit"));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    // Do NOT change the value — blur immediately.
    fireEvent.blur(textarea);
    await vi.waitFor(() => expect(store.listUnfiled).toHaveBeenCalled());
    expect(store.updateBody).not.toHaveBeenCalled();
  });

  it("Ctrl+Enter commits exactly once (doneRef blocks the blur double-write)", async () => {
    const note = makeNote({ id: "n1", body: "Original" });
    const store = makeStore([note]);
    render(
      <Inbox onClose={vi.fn()} activeProjectId="p1" setHasQuickItems={vi.fn()} store={store} />
    );
    await screen.findByText("Original");
    fireEvent.click(screen.getByTitle("Click to edit"));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Changed" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    // blur fires after keyDown in the real browser; simulate it here too.
    fireEvent.blur(textarea);
    await vi.waitFor(() => expect(store.updateBody).toHaveBeenCalledTimes(1));
    expect(store.updateBody).toHaveBeenCalledWith("n1", "Changed");
  });
});
