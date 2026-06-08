// @vitest-environment jsdom
/**
 * OutlinerGroupDnd — drag-end fires onMoveScene with correct args.
 *
 * Mirrors the corkboard.test.tsx pattern: mock DndContext to capture handlers,
 * fire synthetic drag events via act(), assert the onMoveScene spy.
 *
 * Gate assertions use the same capture mechanism: if OutlinerGroupDnd is never
 * mounted (onMoveScene absent or sort non-manual), capturedOnDragEnd stays
 * undefined after render — asserting "no DndContext was rendered".
 */
import type { DragEndEvent, DragOverEvent } from "@dnd-kit/core";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BinderTree } from "../binder/buildTree";
import type { Scene } from "../db/binderStore";
import { Outliner } from "../features/outliner/Outliner";
import { OutlinerGroupDnd } from "../features/outliner/OutlinerDrag";

// ---------------------------------------------------------------------------
// DndContext mock — captures handler props for direct invocation in tests.
// Real DndContext is still rendered so useSortable / SortableContext work.
// ---------------------------------------------------------------------------

let capturedOnDragStart: (() => void) | undefined;
let capturedOnDragOver: ((e: DragOverEvent) => void) | undefined;
let capturedOnDragEnd: ((e: DragEndEvent) => void) | undefined;

vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");
  const RealDndContext = actual.DndContext;
  const CapturingDndContext = (props: Parameters<typeof RealDndContext>[0]) => {
    capturedOnDragStart = props.onDragStart as (() => void) | undefined;
    capturedOnDragOver = props.onDragOver as ((e: DragOverEvent) => void) | undefined;
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

function makeScene(id: string, folderId: string | null = null): Scene {
  return {
    id,
    project_id: "p1",
    folder_id: folderId,
    title: `Scene ${id}`,
    synopsis: null,
    sort_order: 0,
    word_count: 0,
    status: "blank",
  };
}

// ---------------------------------------------------------------------------
// Drag-end → onMoveScene contract
// ---------------------------------------------------------------------------

describe("OutlinerGroupDnd — drag-end fires onMoveScene with correct args", () => {
  it("dropping s2 over s1 in a chapter group calls onMoveScene('s2', 'f1', 0)", () => {
    const onMoveScene = vi.fn();
    const scenes = [makeScene("s1", "f1"), makeScene("s2", "f1")];

    render(
      <OutlinerGroupDnd folderId="f1" scenes={scenes} onMoveScene={onMoveScene}>
        {(sorted) => (
          <div>{sorted.map((s) => <div key={s.id} data-testid={`row-${s.id}`}>{s.title}</div>)}</div>
        )}
      </OutlinerGroupDnd>,
    );

    // Seed liveIds, slide s2 ahead of s1, then commit.
    // onDragEnd fires with over===active (dnd-kit behaviour when card occupies its own slot).
    // The commit path checks that liveIds DIFFERS from committed ids — not event.over.
    expect(capturedOnDragEnd).toBeDefined();
    act(() => { capturedOnDragStart!(); });
    act(() => { capturedOnDragOver!({ active: { id: "s2" }, over: { id: "s1" } } as unknown as DragOverEvent); });
    act(() => { capturedOnDragEnd!({ active: { id: "s2" }, over: { id: "s2" } } as unknown as DragEndEvent); });

    expect(onMoveScene).toHaveBeenCalledTimes(1);
    expect(onMoveScene).toHaveBeenCalledWith("s2", "f1", 0);
  });

  it("dropping in a Short Pieces group (folderId null) calls onMoveScene with null folderId", () => {
    const onMoveScene = vi.fn();
    const scenes = [makeScene("sp1"), makeScene("sp2")];

    render(
      <OutlinerGroupDnd folderId={null} scenes={scenes} onMoveScene={onMoveScene}>
        {(sorted) => (
          <div>{sorted.map((s) => <div key={s.id}>{s.title}</div>)}</div>
        )}
      </OutlinerGroupDnd>,
    );

    act(() => { capturedOnDragStart!(); });
    act(() => { capturedOnDragOver!({ active: { id: "sp2" }, over: { id: "sp1" } } as unknown as DragOverEvent); });
    act(() => { capturedOnDragEnd!({ active: { id: "sp2" }, over: { id: "sp2" } } as unknown as DragEndEvent); });

    expect(onMoveScene).toHaveBeenCalledTimes(1);
    expect(onMoveScene).toHaveBeenCalledWith("sp2", null, 0);
  });

  it("cancelling a drag (no onDragOver — order unchanged) does not call onMoveScene", () => {
    const onMoveScene = vi.fn();
    const scenes = [makeScene("s1", "f1"), makeScene("s2", "f1")];

    render(
      <OutlinerGroupDnd folderId="f1" scenes={scenes} onMoveScene={onMoveScene}>
        {(sorted) => <div>{sorted.map((s) => <div key={s.id}>{s.title}</div>)}</div>}
      </OutlinerGroupDnd>,
    );

    act(() => { capturedOnDragStart!(); });
    // DragEnd without onDragOver — liveIds matches committed ids → cancel path
    act(() => { capturedOnDragEnd!({ active: { id: "s1" }, over: { id: "s1" } } as unknown as DragEndEvent); });

    expect(onMoveScene).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Gate: no DndContext when sort is non-manual or onMoveScene absent
// ---------------------------------------------------------------------------

function makeTree(sceneId: string): BinderTree {
  return {
    chapters: [{ folder: { id: "f1", project_id: "p1", title: "Ch1", sort_order: 1000 }, scenes: [makeScene(sceneId, "f1")] }],
    shortPieces: [],
  };
}

describe("OutlinerGroupDnd — gate: drag disabled when not applicable", () => {
  it("Outliner without onMoveScene prop renders no DndContext", () => {
    render(
      <Outliner
        tree={makeTree("s1")} labels={[]} sceneLabels={{}}
        sort={{ col: "manual", dir: "asc" }} setSort={vi.fn()}
        h={{}}
      />,
    );
    // OutlinerGroupDnd never mounted → CapturingDndContext never called
    expect(capturedOnDragEnd).toBeUndefined();
  });

  it("Outliner with onMoveScene but sort.col !== 'manual' renders no DndContext", () => {
    render(
      <Outliner
        tree={makeTree("s1")} labels={[]} sceneLabels={{}}
        sort={{ col: "title", dir: "asc" }} setSort={vi.fn()}
        h={{}} onMoveScene={vi.fn()}
      />,
    );
    // isManual=false → OutlinerGroupDnd never mounted
    expect(capturedOnDragEnd).toBeUndefined();
  });
});
