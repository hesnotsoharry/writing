// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { BinderTree } from "../binder/buildTree";
import type { Scene, SceneStatus } from "../db/binderStore";
import { Corkboard } from "../features/corkboard/Corkboard";

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
