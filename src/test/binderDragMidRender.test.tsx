// @vitest-environment jsdom
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAppState, useProjectActions } from "../App.state";
import { BinderDragProvider, type DragCallbacks, type ItemsMap } from "../binder/BinderDrag";

// ── DndContext mock — captures handler props for direct invocation in tests. ──

let capturedOnDragStart: ((e: DragStartEvent) => void) | undefined;
let capturedOnDragOver: ((e: DragOverEvent) => void) | undefined;
let capturedOnDragEnd: ((e: DragEndEvent) => void) | undefined;

vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");
  const RealDndContext = actual.DndContext;
  const CapturingDndContext = (props: Parameters<typeof RealDndContext>[0]) => {
    capturedOnDragStart = props.onDragStart;
    capturedOnDragOver = props.onDragOver;
    capturedOnDragEnd = props.onDragEnd;
    return <RealDndContext {...props} />;
  };
  return { ...actual, DndContext: CapturingDndContext };
});

afterEach(cleanup);

beforeEach(() => {
  capturedOnDragStart = undefined;
  capturedOnDragOver = undefined;
  capturedOnDragEnd = undefined;
});

describe("P6.1 — BinderDragProvider mid-drag parent re-render", () => {
  it("preserves liveItems when items prop identity changes during an in-flight drag", () => {
    const onMoveScene = vi.fn();
    const onMoveFolder = vi.fn();
    const callbacks: DragCallbacks = { onMoveScene, onMoveFolder };
    const items1: ItemsMap = {
      chapters: ["f1"],
      "short-pieces": [],
      f1: ["s1", "s2"],
    };

    const { rerender } = render(
      <BinderDragProvider callbacks={callbacks} items={items1} sceneById={{}} folderById={{}}>
        <div data-testid="child">content</div>
      </BinderDragProvider>
    );

    expect(capturedOnDragStart).toBeDefined();

    // 1. Start drag on s2
    act(() => {
      capturedOnDragStart!({
        active: { id: "s2", data: { current: { type: "scene", containerId: "f1" } } },
      } as unknown as DragStartEvent);
    });

    // 2. Drag over s1 to move s2 to index 0
    act(() => {
      capturedOnDragOver!({
        active: {
          id: "s2",
          data: { current: { type: "scene", containerId: "f1" } },
          rect: { current: { translated: { top: 0, left: 0 } } },
        },
        over: {
          id: "s1",
          data: { current: { type: "scene", containerId: "f1" } },
          rect: { top: 10, height: 20, bottom: 30, left: 0, right: 100, width: 100 },
        },
      } as unknown as DragOverEvent);
    });

    // 3. Parent re-renders mid-drag with a new items object reference (e.g. eager save / word-count reload)
    const items2: ItemsMap = {
      chapters: ["f1"],
      "short-pieces": [],
      f1: ["s1", "s2"],
    };
    rerender(
      <BinderDragProvider callbacks={callbacks} items={items2} sceneById={{}} folderById={{}}>
        <div data-testid="child">content</div>
      </BinderDragProvider>
    );

    // 4. Drop s2
    act(() => {
      capturedOnDragEnd!({
        active: { id: "s2", data: { current: { type: "scene", containerId: "f1" } } },
      } as unknown as DragEndEvent);
    });

    // onMoveScene must commit with index 0 (the dragged position), not index 1 (the original)
    expect(onMoveScene).toHaveBeenCalledTimes(1);
    expect(onMoveScene).toHaveBeenCalledWith("s2", "f1", 0);
  });
});

describe("P6.2 — Project switch resets brainstorm view and board selection", () => {
  it("switchProject resets view to editor", () => {
    const { result } = renderHook(() => useAppState());

    act(() => {
      result.current.setView("brainstorm");
    });
    expect(result.current.view).toBe("brainstorm");

    // Switching view or project
    act(() => {
      result.current.setView("editor");
    });
    expect(result.current.view).toBe("editor");
  });

  it("useProjectActions switchProject resets view to editor and clears scene", async () => {
    const mockBinderStore = {
      loadProject: vi.fn().mockResolvedValue({
        folders: [{ id: "f1", title: "Ch 1", sort_order: 0 }],
        scenes: [{ id: "s1", folder_id: "f1", title: "Sc 1", sort_order: 0 }],
      }),
    };
    const setView = vi.fn();
    const setTree = vi.fn();
    const handleSelectScene = vi.fn();
    const clearScene = vi.fn();
    const activeProjectIdRef = { current: "p1" };
    const loadProjectTokenRef = { current: 0 };
    const setActiveProjectId = vi.fn();
    const setProjects = vi.fn();

    const { result } = renderHook(() =>
      useProjectActions({
        binderStore: mockBinderStore as never,
        activeProjectIdRef,
        loadProjectTokenRef,
        setTree,
        setProjects,
        setActiveProjectId,
        handleSelectScene,
        clearScene,
        setView,
      })
    );

    await act(async () => {
      result.current.onSwitchProject("p2");
    });

    expect(setView).toHaveBeenCalledWith("editor");
    expect(clearScene).toHaveBeenCalled();
    expect(setActiveProjectId).toHaveBeenCalledWith("p2");
  });
});
