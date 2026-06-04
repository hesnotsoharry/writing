// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArchivedItem, BinderStore } from "../db/binderStore";
import { Archive } from "../features/archive/Archive";

afterEach(cleanup);

function makeItem(over: Partial<ArchivedItem> = {}): ArchivedItem {
  return {
    id: "a1",
    kind: "scene",
    originalId: "s1",
    title: "Opening scene",
    sub: "Chapter I",
    archivedAt: Date.now() - 1000 * 60,
    ...over,
  };
}

function makeStore(items: ArchivedItem[] = [makeItem()]): Pick<
  BinderStore,
  "listArchived" | "restoreArchived" | "purgeArchived"
> & Record<string, ReturnType<typeof vi.fn>> {
  return {
    listArchived: vi.fn().mockResolvedValue(items),
    restoreArchived: vi.fn().mockResolvedValue(undefined),
    purgeArchived: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Archive overlay", () => {
  it("renders both item titles and subs when listArchived returns two items", async () => {
    const items = [
      makeItem({ id: "a1", title: "Opening scene", sub: "Chapter I" }),
      makeItem({ id: "a2", title: "Climax chapter", sub: "3 scenes", kind: "chapter" }),
    ];
    const store = makeStore(items);
    render(
      <Archive
        projectId="p1"
        store={store as unknown as BinderStore}
        onClose={vi.fn()}
      />
    );
    await screen.findByText("Opening scene");
    expect(screen.getByText("Climax chapter")).toBeInTheDocument();
    expect(screen.getByText("Scene · Chapter I")).toBeInTheDocument();
    expect(screen.getByText("Chapter · 3 scenes")).toBeInTheDocument();
    expect(store.listArchived).toHaveBeenCalledWith("p1");
  });

  it("shows 'Nothing archived.' when listArchived returns an empty array", async () => {
    const store = makeStore([]);
    render(
      <Archive
        projectId="p1"
        store={store as unknown as BinderStore}
        onClose={vi.fn()}
      />
    );
    await screen.findByText("Nothing archived.");
  });

  it("Restore calls store.restoreArchived(id), triggers onChanged, and reloads the list", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    const items = [makeItem({ id: "a1", title: "Old draft" })];
    const store = makeStore(items);
    render(
      <Archive
        projectId="p1"
        store={store as unknown as BinderStore}
        onClose={vi.fn()}
        onChanged={onChanged}
      />
    );
    await screen.findByText("Old draft");
    const restoreBtn = screen.getByRole("button", { name: /restore/i });
    await user.click(restoreBtn);
    await waitFor(() => expect(store.restoreArchived).toHaveBeenCalledWith("a1"));
    expect(onChanged).toHaveBeenCalledTimes(1);
    // list reloaded — listArchived called twice (mount + after restore)
    expect(store.listArchived).toHaveBeenCalledTimes(2);
  });

  it("Remove button calls store.purgeArchived(id) and onChanged; list reloads", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    const items = [makeItem({ id: "a3", title: "Cut scene" })];
    const store = makeStore(items);
    render(
      <Archive
        projectId="p1"
        store={store as unknown as BinderStore}
        onClose={vi.fn()}
        onChanged={onChanged}
      />
    );
    await screen.findByText("Cut scene");
    const removeBtn = screen.getByRole("button", { name: /delete forever/i });
    await user.click(removeBtn);
    await waitFor(() => expect(store.purgeArchived).toHaveBeenCalledWith("a3"));
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(store.listArchived).toHaveBeenCalledTimes(2);
  });

  it("re-renders with a new projectId call listArchived with the new id", async () => {
    const store = makeStore([makeItem({ id: "a1", title: "Scene A" })]);
    const { rerender } = render(
      <Archive projectId="p1" store={store as unknown as BinderStore} onClose={vi.fn()} />
    );
    await screen.findByText("Scene A");
    rerender(
      <Archive projectId="p2" store={store as unknown as BinderStore} onClose={vi.fn()} />
    );
    await waitFor(() => expect(store.listArchived).toHaveBeenCalledWith("p2"));
  });

  it("shows 'Nothing archived.' gracefully when listArchived rejects", async () => {
    const store = makeStore([]);
    (store.listArchived as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB down"));
    render(
      <Archive projectId="p1" store={store as unknown as BinderStore} onClose={vi.fn()} />
    );
    await screen.findByText("Nothing archived.");
  });

  it("omitting projectId shows the empty state without calling listArchived", async () => {
    const store = makeStore([makeItem()]);
    render(<Archive store={store as unknown as BinderStore} onClose={vi.fn()} />);
    await screen.findByText("Nothing archived.");
    expect(store.listArchived).not.toHaveBeenCalled();
  });
});
