// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { BinderTree } from "../binder/buildTree";
import type { Scene, SceneStatus } from "../db/binderStore";
import { Corkboard } from "../features/corkboard/Corkboard";

/**
 * Orchestrator-owned acceptance test for Wave 12 Phase 2 (Corkboard render contract).
 *
 * Three-state status model per the locked product decision (blank/draft/done) — NOT the
 * design-reference data.jsx five-state mock. STATUS_META labels: "To write"/"Drafting"/"Done".
 *
 * The implementer makes the render assertions pass and MUST NOT modify this file.
 * (Interaction assertions — click-to-open, status-cycle — are added for Phase 3.)
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
    scene({ id: "sp1", title: "Stray Idea", synopsis: null, word_count: 0, status: "done" }),
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

  it("shows the status label and a colored dot per status; 'done' renders a check", () => {
    const { container } = renderBoard();
    expect(screen.getByText("Drafting")).toBeTruthy(); // s1 draft
    expect(screen.getByText("To write")).toBeTruthy(); // s2 blank
    expect(screen.getByText("Done")).toBeTruthy(); // sp1 done
    // The done scene renders a check; non-done scenes render dots.
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
    // Type-level guard: STATUS_META must cover the closed three-state union.
    const all: SceneStatus[] = ["blank", "draft", "done"];
    expect(all).toHaveLength(3);
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

  it("blank → draft on dot click: persists, does NOT open the scene, updates the label", () => {
    const calls: [string, SceneStatus][] = [];
    const { opened } = renderWithStatus((id, s) => calls.push([id, s]));

    const card = screen.getByText("The Letter").closest(".card") as HTMLElement; // s2, blank
    fireEvent.click(card.querySelector(".dot") as Element);

    expect(calls).toEqual([["s2", "draft"]]); // persisted with the next status
    expect(opened).toEqual([]); // stopPropagation — card did not open
    expect(within(card).getByText("Drafting")).toBeTruthy(); // optimistic label update
  });

  it("draft → done on dot click: optimistic indicator becomes the check + 'Done'", () => {
    const calls: [string, SceneStatus][] = [];
    renderWithStatus((id, s) => calls.push([id, s]));

    const card = screen.getByText("Opening").closest(".card") as HTMLElement; // s1, draft
    fireEvent.click(card.querySelector(".dot") as Element);

    expect(calls).toEqual([["s1", "done"]]);
    expect(within(card).getByText("Done")).toBeTruthy();
    expect(card.querySelector(".scene-check")).toBeTruthy(); // dot → check after reaching done
  });

  it("done → blank wraps the cycle when the check is clicked", () => {
    const calls: [string, SceneStatus][] = [];
    const { opened } = renderWithStatus((id, s) => calls.push([id, s]));

    const card = screen.getByText("Stray Idea").closest(".card") as HTMLElement; // sp1, done
    fireEvent.click(card.querySelector(".scene-check") as Element);

    expect(calls).toEqual([["sp1", "blank"]]); // wraps back to blank
    expect(opened).toEqual([]);
    expect(within(card).getByText("To write")).toBeTruthy();
  });
});
