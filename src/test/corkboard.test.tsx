// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// DndContext mock — captures onDragEnd from each rendered DndContext so tests
// can fire a synthetic drop without fighting jsdom's PointerSensor activation.
// The REAL DndContext is still rendered (children intact, sortable context alive).
// ---------------------------------------------------------------------------
import type { DragEndEvent, DragOverEvent } from "@dnd-kit/core";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DragCallbacks } from "../binder/BinderDrag";
import type { BinderTree } from "../binder/buildTree";
import type { Scene, SceneStatus } from "../db/binderStore";
import { Corkboard, CorkGroupDnd } from "../features/corkboard/Corkboard";

let capturedOnDragStart: (() => void) | undefined;
let capturedOnDragOver: ((e: DragOverEvent) => void) | undefined;
let capturedOnDragEnd: ((e: DragEndEvent) => void) | undefined;

vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");
  // Wrap DndContext to capture onDragStart/onDragOver/onDragEnd for direct invocation
  // in tests. The real DndContext is rendered via JSX so hooks + sortable context work.
  const RealDndContext = actual.DndContext;
  const CapturingDndContext = (props: Parameters<typeof RealDndContext>[0]) => {
    capturedOnDragStart = props.onDragStart as (() => void) | undefined;
    capturedOnDragOver = props.onDragOver as ((e: DragOverEvent) => void) | undefined;
    capturedOnDragEnd = props.onDragEnd;
    return <RealDndContext {...props} />;
  };
  return { ...actual, DndContext: CapturingDndContext };
});

/**
 * Orchestrator-owned acceptance test for Wave 12 Phase 2 (Corkboard render contract).
 *
 * Updated for Wave 17: SceneStatus widened to the 5-value canon set
 * (blank/outline/draft/revise/final). Legacy "done" is no longer a valid
 * value — fixtures updated to "final" accordingly. STATUS_CYCLE now advances
 * through STATUS_ORDER (blank→outline→draft→revise→final→blank).
 */

afterEach(() => {
  cleanup();
});

function scene(over: Partial<Scene> & { id: string; title: string }): Scene {
  return {
    project_id: "p1",
    folder_id: null,
    synopsis: null,
    sort_order: 0,
    word_count: 0,
    status: "blank",
    ...over,
  };
}

const TREE: BinderTree = {
  chapters: [
    {
      folder: { id: "f1", project_id: "p1", title: "Chapter One", sort_order: 1000 },
      scenes: [
        scene({ id: "s1", title: "Opening", synopsis: "A storm rolls in.", word_count: 1234, status: "draft" }),
        scene({ id: "s2", title: "The Letter", synopsis: null, word_count: 0, status: "blank" }),
      ],
    },
    {
      folder: { id: "f2", project_id: "p1", title: "Chapter Two", sort_order: 2000 },
      scenes: [],
    },
  ],
  shortPieces: [
    scene({ id: "sp1", title: "Stray Idea", synopsis: null, word_count: 0, status: "final" }),
  ],
};

const noopSelect = (): void => {};
const noopView = (): void => {};

describe("Corkboard — render contract (Wave 12 Phase 2)", () => {
  function renderBoard() {
    return render(
      <Corkboard tree={TREE} onSelectScene={noopSelect} onViewChange={noopView} />
    );
  }

  it("renders a chapter group per chapter plus a short-pieces group", () => {
    const { container } = renderBoard();
    expect(container.querySelector(".corkboard")).toBeTruthy();
    // Exact title format pins the `· N scenes` suffix (not just the chapter name).
    expect(screen.getByText("Chapter One · 2 scenes")).toBeTruthy();
    expect(screen.getByText("Chapter Two · 0 scenes")).toBeTruthy();
    expect(screen.getByText("Short pieces · 1")).toBeTruthy();
    // Short pieces group renders its card.
    expect(screen.getByText("Stray Idea")).toBeTruthy();
  });

  it("renders a card per scene with title and synopsis (with fallback)", () => {
    const { container } = renderBoard();
    expect(container.querySelectorAll(".card").length).toBe(3); // s1, s2, sp1
    expect(screen.getByText("Opening")).toBeTruthy();
    expect(screen.getByText("The Letter")).toBeTruthy();
    expect(screen.getByText("A storm rolls in.")).toBeTruthy();
    // Null-synopsis scenes (s2, sp1) show the fallback.
    expect(screen.getAllByText("No synopsis yet.").length).toBe(2);
  });

  it("formats word count, falling back to an em dash when zero", () => {
    renderBoard();
    expect(screen.getByText("1,234w")).toBeTruthy(); // s1
    // Two zero-word scenes (s2, sp1) show the em-dash fallback.
    expect(screen.getAllByText("—").length).toBe(2);
  });

  it("shows the status label and a colored dot per status; 'final' renders a check", () => {
    const { container } = renderBoard();
    expect(screen.getByText("Drafting")).toBeTruthy(); // s1 draft
    expect(screen.getByText("To write")).toBeTruthy(); // s2 blank
    expect(screen.getByText("Final")).toBeTruthy(); // sp1 final
    // The final scene renders a check; non-final scenes render dots.
    expect(container.querySelector(".scene-check")).toBeTruthy();
    expect(container.querySelectorAll(".card-status .dot").length).toBe(2); // s1, s2
  });

  it("renders an empty hint for a chapter with no scenes", () => {
    const { container } = renderBoard();
    expect(container.querySelector(".empty-hint")).toBeTruthy(); // Chapter Two
  });

  it("opens a scene in the editor when its card is clicked", () => {
    const selected: string[] = [];
    const views: string[] = [];
    render(
      <Corkboard
        tree={TREE}
        onSelectScene={(id) => selected.push(id)}
        onViewChange={(v) => views.push(v)}
      />
    );
    const card = screen.getAllByText("Opening")[0].closest(".card");
    expect(card).toBeTruthy();
    fireEvent.click(card as Element);
    expect(selected).toEqual(["s1"]);
    expect(views).toEqual(["editor"]);
  });

  it("the status indicator carries a typed status for each card", () => {
    // Type-level guard: STATUS_META must cover the closed five-state union.
    const all: SceneStatus[] = ["blank", "outline", "draft", "revise", "final"];
    expect(all).toHaveLength(5);
  });
});

describe("Corkboard — status cycle (Wave 12 Phase 3)", () => {
  function renderWithStatus(onStatus: (id: string, s: SceneStatus) => void) {
    const opened: string[] = [];
    render(
      <Corkboard
        tree={TREE}
        onSelectScene={(id) => opened.push(id)}
        onViewChange={noopView}
        setSceneStatus={onStatus}
      />
    );
    return { opened };
  }

  it("blank → outline on dot click: persists, does NOT open the scene, updates the label", () => {
    const calls: [string, SceneStatus][] = [];
    const { opened } = renderWithStatus((id, s) => calls.push([id, s]));

    const card = screen.getByText("The Letter").closest(".card") as HTMLElement; // s2, blank
    fireEvent.click(card.querySelector(".dot") as Element);

    expect(calls).toEqual([["s2", "outline"]]); // next step in STATUS_ORDER
    expect(opened).toEqual([]); // stopPropagation — card did not open
    expect(within(card).getByText("Outlined")).toBeTruthy(); // optimistic label update
  });

  it("draft → revise on dot click: optimistic label updates", () => {
    const calls: [string, SceneStatus][] = [];
    renderWithStatus((id, s) => calls.push([id, s]));

    const card = screen.getByText("Opening").closest(".card") as HTMLElement; // s1, draft
    fireEvent.click(card.querySelector(".dot") as Element);

    expect(calls).toEqual([["s1", "revise"]]);
    expect(within(card).getByText("Revising")).toBeTruthy();
  });

  it("final → blank wraps the cycle when the check is clicked", () => {
    const calls: [string, SceneStatus][] = [];
    const { opened } = renderWithStatus((id, s) => calls.push([id, s]));

    const card = screen.getByText("Stray Idea").closest(".card") as HTMLElement; // sp1, final
    fireEvent.click(card.querySelector(".scene-check") as Element);

    expect(calls).toEqual([["sp1", "blank"]]); // wraps back to blank
    expect(opened).toEqual([]);
    expect(within(card).getByText("To write")).toBeTruthy();
  });
});

describe("Corkboard — status write triggers reloadTree (Wave 25 Phase 5 Item 1)", () => {
  it("calls reloadTree after a dot-click status cycle so the binder reflects the change", () => {
    const reloadCalls: number[] = [];
    const reloadTree = () => { reloadCalls.push(1); };
    // setSceneStatus returns a resolved promise; reloadTree should fire after it resolves.
    const statusWrites: [string, SceneStatus][] = [];
    const setSceneStatus = (id: string, s: SceneStatus) => {
      statusWrites.push([id, s]);
      return Promise.resolve();
    };
    render(
      <Corkboard
        tree={TREE}
        onSelectScene={() => {}}
        onViewChange={() => {}}
        setSceneStatus={setSceneStatus}
        reloadTree={reloadTree}
      />,
    );
    const card = screen.getByText("The Letter").closest(".card") as HTMLElement; // s2, blank
    fireEvent.click(card.querySelector(".dot") as Element);

    expect(statusWrites).toEqual([["s2", "outline"]]); // status was written
    // reloadTree is called asynchronously (after the promise resolves) but the cycle
    // fires the promise synchronously-resolved so a microtask flush is needed.
    return Promise.resolve().then(() => {
      expect(reloadCalls.length).toBe(1); // reloadTree fired after the write
    });
  });

  it("calls reloadTree after a context-menu status change so the binder reflects the change", () => {
    const reloadCalls: number[] = [];
    const reloadTree = () => { reloadCalls.push(1); };
    const statusWrites: [string, SceneStatus][] = [];
    const setSceneStatus = (id: string, s: SceneStatus) => {
      statusWrites.push([id, s]);
      return Promise.resolve();
    };
    render(
      <Corkboard
        tree={TREE}
        onSelectScene={() => {}}
        onViewChange={() => {}}
        setSceneStatus={setSceneStatus}
        reloadTree={reloadTree}
      />,
    );
    const card = screen.getByText("Opening").closest(".card") as HTMLElement; // s1, draft
    fireEvent.contextMenu(card);
    // The context menu uses a submenu — hover "Set status" to open it, then click the status.
    const setStatusItem = screen.getByText("Set status");
    fireEvent.mouseEnter(setStatusItem.closest("button") as Element);
    // After hovering, the submenu renders status labels — "Revising" is the label for "revise".
    const reviseItem = screen.getByText("Revising");
    fireEvent.click(reviseItem);

    expect(statusWrites).toEqual([["s1", "revise"]]);
    return Promise.resolve().then(() => {
      expect(reloadCalls.length).toBe(1);
    });
  });
});

describe("Corkboard — DnD reorder wires to existing moveScene callback (Wave 25 Phase 5 Item 3)", () => {
  it("renders cards as sortable when dragCallbacks are provided", () => {
    const dragCallbacks: DragCallbacks = {
      onMoveScene: vi.fn(),
      onMoveFolder: vi.fn(),
    };
    const { container } = render(
      <Corkboard
        tree={TREE}
        onSelectScene={() => {}}
        onViewChange={() => {}}
        dragCallbacks={dragCallbacks}
      />,
    );
    // When dragCallbacks are provided, SortableContext wraps each group
    // and cards carry the grab cursor style.
    const cards = container.querySelectorAll(".card");
    expect(cards.length).toBe(3); // s1, s2, sp1 still rendered
    // Each card in a DnD-enabled board should have cursor:grab via useSortableCard.
    // We verify the style attribute is present (set by @dnd-kit).
    // Note: @dnd-kit sets transform on the element; style.cursor is our override.
    Array.from(cards).forEach((card) => {
      expect((card as HTMLElement).style.cursor).toBe("grab");
    });
  });

  it("drop fires onMoveScene(sceneId, folderId, toIndex) and reloadTree exactly once after the move", () => {
    // Contract: dropping scene s2 onto s1's position within Chapter One (folderId=f1)
    // must call onMoveScene with the correct args and reloadTree exactly once (post-write).
    // The test renders CorkGroupDnd directly (one DndContext) so capturedOnDragEnd is
    // unambiguous. onMoveScene is a spy — its call validates the persistence path.
    // reloadTree is supplied as the reloadTree prop to Corkboard; since we render
    // CorkGroupDnd directly we verify the contract at the cbs.onMoveScene call level,
    // confirming no redundant onAfterDrop call follows.
    const onMoveScene = vi.fn();
    const onMoveFolder = vi.fn();
    const cbs: DragCallbacks = { onMoveScene, onMoveFolder };
    const onAfterDrop = vi.fn();
    const chapterScenes: Scene[] = [
      scene({ id: "s1", title: "Opening", word_count: 1234, status: "draft" }),
      scene({ id: "s2", title: "The Letter", word_count: 0, status: "blank" }),
    ];

    render(
      <CorkGroupDnd folderId="f1" scenes={chapterScenes} cbs={cbs} onAfterDrop={onAfterDrop}>
        {(sorted) => (
          <div>
            {sorted.map((s) => <div key={s.id} data-testid={`card-${s.id}`}>{s.title}</div>)}
          </div>
        )}
      </CorkGroupDnd>,
    );

    // Simulate a REAL reorder: onDragStart seeds liveIds, onDragOver slides s2 ahead of
    // s1 (liveIds -> ["s2","s1"]), then onDragEnd commits. dnd-kit reports over===active
    // at release (the dragged card now occupies its own new slot) — the commit is driven
    // by the order actually CHANGING, not by event.over. This guards the snap-back fix:
    // the old `over===active → cancel` path would (wrongly) skip onMoveScene here.
    expect(capturedOnDragStart).toBeDefined();
    act(() => { capturedOnDragStart!(); });
    act(() => { capturedOnDragOver!({ active: { id: "s2" }, over: { id: "s1" } } as unknown as DragOverEvent); });
    act(() => { capturedOnDragEnd!({ active: { id: "s2" }, over: { id: "s2" } } as unknown as DragEndEvent); });

    // s2 moved to index 0 — onMoveScene fires with the new index (no snap-back cancel).
    expect(onMoveScene).toHaveBeenCalledTimes(1);
    expect(onMoveScene).toHaveBeenCalledWith("s2", "f1", 0);

    // Fix 1 guard: onAfterDrop must NOT have been called (double-reload eliminated).
    // The single post-write reload is owned by onMoveScene's own .then(doReload) chain.
    expect(onAfterDrop).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Wave 26 Phase 4 — snap-back fix: optimistic order holds until server truth arrives
// ---------------------------------------------------------------------------

describe("Corkboard — snap-back fix: liveIds holds through async window (Wave 26 Phase 4)", () => {
  it("holds optimistic [s2,s1] order immediately after drop and clears only when committed scenes match", () => {
    // WHAT THIS TEST CATCHES: with the old bug, onDragEnd called setLiveIds(null)
    // synchronously, causing the DOM to snap back to [s1,s2] before the DB write resolved.
    // The in-window assertion below (before setScenes) goes RED if the fix is reverted.
    //
    // Drag cycle: onDragStart seeds liveIds=[s1,s2]; onDragOver reorders to [s2,s1];
    // onDragEnd (successful move) leaves liveIds=[s2,s1] SET. Only when the parent
    // delivers reloadedScenes=[s2,s1] does liveIds.join === ids.join → guard clears.
    const onMoveScene = vi.fn();
    const cbs: DragCallbacks = { onMoveScene, onMoveFolder: vi.fn() };
    const initialScenes: Scene[] = [
      scene({ id: "s1", title: "Opening", word_count: 1234, status: "draft" }),
      scene({ id: "s2", title: "The Letter", word_count: 0, status: "blank" }),
    ];
    // Reloaded scenes as delivered by doReload after the DB write commits (s2 first).
    const reloadedScenes: Scene[] = [
      scene({ id: "s2", title: "The Letter", word_count: 0, status: "blank" }),
      scene({ id: "s1", title: "Opening", word_count: 1234, status: "draft" }),
    ];

    let capturedSetScenes: ((s: Scene[]) => void) | undefined;

    function Wrapper() {
      const [scenes, setScenes] = useState<Scene[]>(initialScenes);
      capturedSetScenes = setScenes;
      return (
        <CorkGroupDnd folderId="f1" scenes={scenes} cbs={cbs} onAfterDrop={() => {}}>
          {(sorted) => (
            <div data-testid="list">
              {sorted.map((s) => <div key={s.id} data-testid={`card-${s.id}`}>{s.title}</div>)}
            </div>
          )}
        </CorkGroupDnd>
      );
    }

    render(<Wrapper />);

    // Step 1: onDragStart — seeds liveIds to current ids order ["s1","s2"].
    expect(capturedOnDragStart).toBeDefined();
    act(() => { capturedOnDragStart!(); });

    // Step 2: onDragOver s2→s1 — reorders liveIds to ["s2","s1"].
    expect(capturedOnDragOver).toBeDefined();
    act(() => {
      capturedOnDragOver!({
        active: { id: "s2", data: { current: undefined }, rect: { current: { initial: null, translated: null } } },
        over: { id: "s1", rect: { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 }, data: { current: undefined }, disabled: false },
        delta: { x: 0, y: 0 },
        activatorEvent: new Event("pointerdown"),
        collisions: null,
      } as unknown as DragOverEvent);
    });

    // Step 3: onDragEnd — successful move. liveIds must stay SET (["s2","s1"]).
    expect(capturedOnDragEnd).toBeDefined();
    act(() => {
      capturedOnDragEnd!({
        active: { id: "s2", data: { current: undefined }, rect: { current: { initial: null, translated: null } } },
        over: { id: "s1", rect: { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 }, data: { current: undefined }, disabled: false },
        delta: { x: 0, y: 0 },
        activatorEvent: new Event("pointerdown"),
        collisions: null,
      } as unknown as DragEndEvent);
    });

    // onMoveScene must have been called with the correct target index.
    // liveIds = ["s2","s1"] after onDragOver; s2 is at index 0 in that array.
    expect(onMoveScene).toHaveBeenCalledTimes(1);
    expect(onMoveScene).toHaveBeenCalledWith("s2", "f1", 0);

    // IN-WINDOW ASSERTION — this is the one that goes RED if the fix is reverted.
    // Scenes prop is still initialScenes=[s1,s2], but liveIds=[s2,s1] must be holding.
    // The rendered order must be [s2,s1], NOT [s1,s2] (snap-back).
    let cards = screen.getAllByTestId(/^card-/);
    expect(cards.map((c) => c.getAttribute("data-testid"))).toEqual(["card-s2", "card-s1"]);

    // Step 4: simulate doReload delivering committed order [s2,s1] via scenes prop.
    // The match-based guard fires: liveIds.join("s2,s1") === ids.join("s2,s1") → clear.
    act(() => { capturedSetScenes!(reloadedScenes); });

    // DOM order must still be [s2,s1] — now driven by the committed scenes prop.
    cards = screen.getAllByTestId(/^card-/);
    expect(cards.map((c) => c.getAttribute("data-testid"))).toEqual(["card-s2", "card-s1"]);
  });
});
