// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Inbox } from "../features/inbox/Inbox";
import type { QuickNote } from "../features/quickcapture/SqliteQuickNoteStore";
import { QUICK_NOTES_CHANGED_EVENT } from "../lib/settings";

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

// Stateful (not a single static mockResolvedValue): delete/markFiled mutate
// `notes` in place, so a re-fetch after the QUICK_NOTES_CHANGED_EVENT the
// Inbox now dispatches (and listens for — see Problem A) sees the same
// removal the real store would, instead of resurrecting the note from a
// stale snapshot.
function makeStore(notes: QuickNote[] = [makeNote()]) {
  const remove = (id: string) => {
    const idx = notes.findIndex((n) => n.id === id);
    if (idx >= 0) notes.splice(idx, 1);
    return Promise.resolve();
  };
  return {
    // Return a fresh copy each call: `notes` is mutated in place by
    // delete/markFiled, and resolving with that same array reference twice
    // in a row (once pre-mutation, once post-) can collide with React's
    // same-reference state bailout across the two setNotes calls in flight
    // (the local optimistic update and the event-triggered re-fetch).
    listUnfiled: vi.fn().mockImplementation(() => Promise.resolve([...notes])),
    updateBody: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockImplementation(remove),
    markFiled: vi.fn().mockImplementation(remove),
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
    // Mirrors production's promoteNoteToScene, which files the note through
    // the store as part of promotion — otherwise the re-fetch this dispatch
    // triggers (see Problem A) would resurrect the note from a stale list.
    const promote = vi.fn().mockImplementation((n: QuickNote) => store.markFiled(n.id));
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

  it("shows an 'N unsorted' count once notes have loaded (Problem B item 4)", async () => {
    const notes = [makeNote({ id: "n1", body: "First" }), makeNote({ id: "n2", body: "Second" })];
    const store = makeStore(notes);
    render(
      <Inbox onClose={vi.fn()} activeProjectId="p1" setHasQuickItems={vi.fn()} store={store} />
    );
    await screen.findByText("First");
    expect(screen.getByText("2 unsorted")).toBeInTheDocument();
  });

  it("re-fetches listUnfiled when QUICK_NOTES_CHANGED_EVENT fires (a phone-captured note lands via sync)", async () => {
    const store = {
      listUnfiled: vi.fn()
        .mockResolvedValueOnce([makeNote({ id: "n1", body: "Local note" })])
        .mockResolvedValueOnce([
          makeNote({ id: "n1", body: "Local note" }),
          makeNote({ id: "n2", body: "Synced from phone" }),
        ]),
      updateBody: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      markFiled: vi.fn().mockResolvedValue(undefined),
    };
    render(
      <Inbox onClose={vi.fn()} activeProjectId="p1" setHasQuickItems={vi.fn()} store={store} />
    );
    await screen.findByText("Local note");
    expect(store.listUnfiled).toHaveBeenCalledTimes(1);

    act(() => { window.dispatchEvent(new CustomEvent(QUICK_NOTES_CHANGED_EVENT)); });

    await screen.findByText("Synced from phone");
    expect(store.listUnfiled).toHaveBeenCalledTimes(2);
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
