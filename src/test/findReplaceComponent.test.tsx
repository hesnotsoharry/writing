// @vitest-environment jsdom
/**
 * Component-level regression tests: onUndoReplace is only triggered by an
 * explicit Undo button click, never by the replace-all operation itself.
 *
 * These tests mount the real FindReplace component in jsdom (via createPortal
 * into document.body) and mock only the DB-layer boundary
 * (manuscriptSearchStore), verifying that the UI wiring is correct:
 *
 *   handleReplaceAll → shows a Toast  ← onUndoReplace NOT called
 *   user clicks Undo in Toast         → onUndoReplace(sceneIds) IS called
 *
 * The pre-fix bug: doToastClose / doToastUndo were plain inline functions
 * recreated on every render. Toast's useEffect depended on them, so the 5 s
 * undo window reset on every re-render, making the undo window unbounded.
 * The fix: stabilize both with useCallback.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the DB store boundary — component tests assert UI wiring, not DB ops.
vi.mock("../db/manuscriptSearchStore", () => ({
  searchManuscript: vi.fn(),
  replaceInScene: vi.fn(),
}));

import type { SearchMatch } from "../db/manuscriptSearchStore";
import { replaceInScene, searchManuscript } from "../db/manuscriptSearchStore";
import type { Snapshot, SnapshotStore } from "../db/snapshotStore";
import { FindReplace } from "../features/findreplace/FindReplace";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SCENE_MATCH: SearchMatch = {
  sceneId: "s-1",
  sceneTitle: "Scene One",
  chapterTitle: "Chapter One",
  chapterId: "c-1",
  offsets: [4],
  plaintext: "The hero stood firm.",
};

function makeSnapStore(): SnapshotStore {
  const snap: Snapshot = {
    id: "snap-1", sceneId: "s-1", label: null,
    wordCount: 4, createdAt: Date.now(), kind: "auto",
  };
  return {
    takeSnapshot: vi.fn(() => Promise.resolve(snap)),
    listSnapshots: vi.fn(() => Promise.resolve([])),
    getSnapshot: vi.fn(() => Promise.resolve(null)),
    renameSnapshot: vi.fn(() => Promise.resolve()),
    deleteSnapshot: vi.fn(() => Promise.resolve()),
    pruneAuto: vi.fn(() => Promise.resolve()),
  };
}

/** Drive the find+replace flow up to (but not including) the toast interaction. */
async function driveToToast(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Find…"), "hero");
  await waitFor(() =>
    expect(vi.mocked(searchManuscript)).toHaveBeenCalledWith(
      "p-1", "hero", expect.any(Object),
    ),
  );
  await user.type(screen.getByPlaceholderText("Replace with…"), "champion");
  // Wait for the "Replace all (1)" button to become enabled (results + repl both set)
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Replace all (1)" })).not.toBeDisabled(),
  );
  await user.click(screen.getByRole("button", { name: "Replace all (1)" }));
  await user.click(await screen.findByRole("button", { name: "Replace all" }));
  // Wait for toast to appear
  await screen.findByText(/Replaced in 1 scene/);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FindReplace component — onUndoReplace is only triggered by explicit Undo click", () => {
  beforeEach(() => {
    vi.mocked(searchManuscript).mockResolvedValue([SCENE_MATCH]);
    vi.mocked(replaceInScene).mockResolvedValue({ replacedCount: 1 });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("does NOT call onUndoReplace automatically after replace-all completes", async () => {
    const user = userEvent.setup({ delay: null });
    const onUndoReplace = vi.fn();

    render(
      <FindReplace projectId="p-1" snapshotStore={makeSnapStore()} onUndoReplace={onUndoReplace} />,
    );

    await driveToToast(user);

    // Toast is visible but onUndoReplace must NOT have fired automatically
    expect(onUndoReplace).not.toHaveBeenCalled();
  });

  it("calls onUndoReplace with the replaced scene IDs when the toast Undo button is clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const onUndoReplace = vi.fn();

    render(
      <FindReplace projectId="p-1" snapshotStore={makeSnapStore()} onUndoReplace={onUndoReplace} />,
    );

    await driveToToast(user);

    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(onUndoReplace).toHaveBeenCalledTimes(1);
    expect(onUndoReplace).toHaveBeenCalledWith(["s-1"]);
  });
});

describe("FindReplace component — onAfterReplace triggers scene reload after replace-all", () => {
  const SCENE_TWO: SearchMatch = {
    sceneId: "s-2", sceneTitle: "Scene Two",
    chapterTitle: "Chapter One", chapterId: "c-1",
    offsets: [4], plaintext: "The hero stood firm.",
  };

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("calls onAfterReplace with the scene ID after replace-all completes", async () => {
    vi.mocked(searchManuscript).mockResolvedValue([SCENE_MATCH]);
    vi.mocked(replaceInScene).mockResolvedValue({ replacedCount: 1 });
    const user = userEvent.setup({ delay: null });
    const onAfterReplace = vi.fn();

    render(
      <FindReplace projectId="p-1" snapshotStore={makeSnapStore()} onAfterReplace={onAfterReplace} />,
    );

    await driveToToast(user);

    expect(onAfterReplace).toHaveBeenCalledTimes(1);
    expect(onAfterReplace).toHaveBeenCalledWith("s-1");
  });

  it("does NOT call onAfterReplace when replacedCount is zero", async () => {
    vi.mocked(searchManuscript).mockResolvedValue([SCENE_MATCH]);
    vi.mocked(replaceInScene).mockResolvedValue({ replacedCount: 0 });
    const user = userEvent.setup({ delay: null });
    const onAfterReplace = vi.fn();

    render(
      <FindReplace projectId="p-1" snapshotStore={makeSnapStore()} onAfterReplace={onAfterReplace} />,
    );

    await user.type(screen.getByPlaceholderText("Find…"), "hero");
    await waitFor(() => expect(vi.mocked(searchManuscript)).toHaveBeenCalled());
    await user.type(screen.getByPlaceholderText("Replace with…"), "champion");
    await waitFor(() => expect(screen.getByRole("button", { name: "Replace all (1)" })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Replace all (1)" }));
    await user.click(await screen.findByRole("button", { name: "Replace all" }));
    // When ids.length === 0 the component calls onClose (no toast). Wait for the
    // replace store call to confirm the async path ran before asserting the negative.
    await waitFor(() => expect(vi.mocked(replaceInScene)).toHaveBeenCalledWith(
      "s-1", "hero", "champion", expect.any(Object), expect.any(Object),
    ));

    expect(onAfterReplace).not.toHaveBeenCalled();
  });

  it("calls onAfterReplace per-scene — only the open scene is reloaded by the callback guard", async () => {
    vi.mocked(searchManuscript).mockResolvedValue([SCENE_MATCH, SCENE_TWO]);
    vi.mocked(replaceInScene).mockResolvedValue({ replacedCount: 1 });
    const user = userEvent.setup({ delay: null });
    const openSceneId = "s-1";
    const handleSelectScene = vi.fn();
    // Simulate the App.tsx onAfterReplace guard: only reload if sceneId === openSceneId
    const onAfterReplace = (sceneId: string) => { if (sceneId === openSceneId) handleSelectScene(sceneId); };

    render(
      <FindReplace projectId="p-1" snapshotStore={makeSnapStore()} onAfterReplace={onAfterReplace} />,
    );

    await user.type(screen.getByPlaceholderText("Find…"), "hero");
    await waitFor(() => expect(vi.mocked(searchManuscript)).toHaveBeenCalled());
    await user.type(screen.getByPlaceholderText("Replace with…"), "champion");
    await waitFor(() => expect(screen.getByRole("button", { name: "Replace all (2)" })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Replace all (2)" }));
    await user.click(await screen.findByRole("button", { name: "Replace all" }));
    await screen.findByText(/Replaced in 2 scenes/);

    // handleSelectScene fires only for the open scene, not for "s-2"
    expect(handleSelectScene).toHaveBeenCalledTimes(1);
    expect(handleSelectScene).toHaveBeenCalledWith("s-1");
    expect(handleSelectScene).not.toHaveBeenCalledWith("s-2");
  });
});
