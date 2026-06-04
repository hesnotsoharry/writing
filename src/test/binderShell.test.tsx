// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Binder } from "../binder/Binder";
import type { BinderCallbacks } from "../binder/BinderCrud";
import type { DragCallbacks } from "../binder/BinderDrag";
import type { BinderTree } from "../binder/buildTree";
import type { Project, Scene } from "../db/binderStore";

afterEach(cleanup);

// ── Fixtures ──────────────────────────────────────────────────────────────

const PROJECTS: Project[] = [
  { id: "p1", title: "My Novel", type: "novel", sort_order: 0, created_at: "", updated_at: "" },
];

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: "s1",
    project_id: "p1",
    folder_id: "f1",
    title: "Scene One",
    synopsis: null,
    sort_order: 0,
    word_count: 200,
    status: "draft",
    ...overrides,
  };
}

function makeTree(overrides: Partial<BinderTree> = {}): BinderTree {
  return {
    chapters: [
      {
        folder: { id: "f1", project_id: "p1", title: "Chapter One", sort_order: 0 },
        scenes: [makeScene()],
      },
    ],
    shortPieces: [],
    ...overrides,
  };
}

function makeCallbacks(overrides: Partial<BinderCallbacks> = {}): BinderCallbacks {
  return {
    onCreateChapter: vi.fn(),
    onCreateScene: vi.fn(),
    onRenameFolder: vi.fn(),
    onRenameScene: vi.fn(),
    onDeleteChapter: vi.fn(),
    onDeleteScene: vi.fn(),
    onSetSceneStatus: vi.fn(),
    onArchiveScene: vi.fn(),
    onArchiveChapter: vi.fn(),
    ...overrides,
  };
}

const DRAG_CALLBACKS: DragCallbacks = {
  onMoveScene: vi.fn(),
  onMoveFolder: vi.fn(),
};

interface MakePropsOverrides {
  tree?: BinderTree;
  callbacks?: Partial<BinderCallbacks>;
  quickCount?: number;
  archivedCount?: number;
  onOpenQuickNotes?: () => void;
  onOpenArchive?: () => void;
  manuscriptTotal?: number;
}

function makeProps(overrides: MakePropsOverrides = {}) {
  const {
    tree = makeTree(),
    callbacks = {},
    quickCount,
    archivedCount,
    onOpenQuickNotes = vi.fn(),
    onOpenArchive = vi.fn(),
    manuscriptTotal,
  } = overrides;
  return {
    tree,
    selectedSceneId: null,
    onSelectScene: vi.fn(),
    callbacks: makeCallbacks(callbacks),
    projects: PROJECTS,
    activeProjectId: "p1",
    onSwitchProject: vi.fn(),
    onCreateProject: vi.fn(),
    dragCallbacks: DRAG_CALLBACKS,
    quickCount,
    archivedCount,
    onOpenQuickNotes,
    onOpenArchive,
    manuscriptTotal,
  };
}

// ── Collapse ──────────────────────────────────────────────────────────────

describe("Binder — chapter collapsibility", () => {
  it("shows the scene initially, hides it after clicking the chapter header, shows again on second click", () => {
    const props = makeProps();
    const { container } = render(<Binder {...props} />);

    // Scene is visible initially.
    expect(container.querySelector("li.scene-row")).not.toBeNull();

    // Click the chapter header row to collapse.
    const chapterRow = container.querySelector(".chapter-row") as HTMLElement;
    expect(chapterRow).not.toBeNull();
    fireEvent.click(chapterRow);

    // Scene is no longer rendered.
    expect(container.querySelector("li.scene-row")).toBeNull();

    // Click again to re-expand.
    fireEvent.click(chapterRow);
    expect(container.querySelector("li.scene-row")).not.toBeNull();
  });
});

// ── Footer badge ──────────────────────────────────────────────────────────

describe("Binder — footer badges", () => {
  it("renders Quick notes button with badge when quickCount is 3", () => {
    const props = makeProps({ quickCount: 3 });
    const { container } = render(<Binder {...props} />);
    const footBtn = Array.from(container.querySelectorAll(".foot-btn")).find(
      (b) => b.textContent?.includes("Quick notes")
    );
    expect(footBtn).not.toBeNull();
    expect(footBtn?.querySelector(".badge")?.textContent).toBe("3");
  });

  it("renders Quick notes button without badge when quickCount is undefined", () => {
    const props = makeProps({ quickCount: undefined });
    const { container } = render(<Binder {...props} />);
    const footBtn = Array.from(container.querySelectorAll(".foot-btn")).find(
      (b) => b.textContent?.includes("Quick notes")
    );
    expect(footBtn).not.toBeNull();
    expect(footBtn?.querySelector(".badge")).toBeNull();
  });

  it("does not render the Archived button when archivedCount is 0", () => {
    const props = makeProps({ archivedCount: 0 });
    const { container } = render(<Binder {...props} />);
    const archivedBtn = Array.from(container.querySelectorAll(".foot-btn")).find(
      (b) => b.textContent?.includes("Archived")
    );
    expect(archivedBtn).toBeUndefined();
  });

  it("renders Archived button and calls onOpenArchive when archivedCount is 2", () => {
    const onOpenArchive = vi.fn();
    const props = makeProps({ archivedCount: 2, onOpenArchive });
    const { container } = render(<Binder {...props} />);
    const archivedBtn = Array.from(container.querySelectorAll(".foot-btn")).find(
      (b) => b.textContent?.includes("Archived")
    ) as HTMLElement;
    expect(archivedBtn).not.toBeNull();
    fireEvent.click(archivedBtn);
    expect(onOpenArchive).toHaveBeenCalledOnce();
  });

  it("clicking Quick notes foot-btn calls onOpenQuickNotes", () => {
    const onOpenQuickNotes = vi.fn();
    const props = makeProps({ onOpenQuickNotes });
    const { container } = render(<Binder {...props} />);
    const quickBtn = Array.from(container.querySelectorAll(".foot-btn")).find(
      (b) => b.textContent?.includes("Quick notes")
    ) as HTMLElement;
    expect(quickBtn).not.toBeNull();
    fireEvent.click(quickBtn);
    expect(onOpenQuickNotes).toHaveBeenCalledOnce();
  });
});

// ── New chapter ───────────────────────────────────────────────────────────

describe("Binder — new chapter", () => {
  it("renders the bottom .add-chapter button and calls onCreateChapter on click", () => {
    const onCreateChapter = vi.fn();
    const props = makeProps({ callbacks: { onCreateChapter } });
    const { container } = render(<Binder {...props} />);
    const addBtn = container.querySelector("button.add-chapter") as HTMLElement;
    expect(addBtn).not.toBeNull();
    fireEvent.click(addBtn);
    expect(onCreateChapter).toHaveBeenCalledOnce();
  });

  it("Manuscript .bsection-head shows chapter count as '1 chapters'", () => {
    const props = makeProps();
    const { container } = render(<Binder {...props} />);
    const heads = Array.from(container.querySelectorAll(".bsection-head"));
    const manuscriptHead = heads.find((h) => h.textContent?.includes("Manuscript"));
    expect(manuscriptHead?.querySelector(".count")?.textContent).toBe("1 chapters");
  });

  it("Manuscript .bsection-head .add button calls onCreateChapter", () => {
    const onCreateChapter = vi.fn();
    const props = makeProps({ callbacks: { onCreateChapter } });
    const { container } = render(<Binder {...props} />);
    const heads = Array.from(container.querySelectorAll(".bsection-head"));
    const manuscriptHead = heads.find((h) => h.textContent?.includes("Manuscript")) as HTMLElement;
    expect(manuscriptHead).not.toBeNull();
    const addBtn = manuscriptHead.querySelector("button.add") as HTMLElement;
    expect(addBtn).not.toBeNull();
    fireEvent.click(addBtn);
    expect(onCreateChapter).toHaveBeenCalledOnce();
  });
});

// ── Empty states ──────────────────────────────────────────────────────────

describe("Binder — chapter empty state", () => {
  it("shows 'No scenes yet' hint when a chapter has zero scenes", () => {
    const tree: BinderTree = {
      chapters: [
        {
          folder: { id: "f1", project_id: "p1", title: "Empty Chapter", sort_order: 0 },
          scenes: [],
        },
      ],
      shortPieces: [],
    };
    const { container } = render(<Binder {...makeProps({ tree })} />);
    expect(container.textContent).toContain("No scenes yet");
  });

  it("clicking 'add one' in an empty chapter calls onCreateScene with the chapter id", () => {
    const onCreateScene = vi.fn();
    const tree: BinderTree = {
      chapters: [
        {
          folder: { id: "f1", project_id: "p1", title: "Empty Chapter", sort_order: 0 },
          scenes: [],
        },
      ],
      shortPieces: [],
    };
    const { getAllByRole } = render(<Binder {...makeProps({ tree, callbacks: { onCreateScene } })} />);
    // Two "add one" buttons may exist (chapter empty hint + short-pieces empty hint).
    // The chapter's "add one" is the first in DOM order.
    const [addOneBtn] = getAllByRole("button", { name: "add one" });
    fireEvent.click(addOneBtn);
    expect(onCreateScene).toHaveBeenCalledWith("f1");
  });

  it("does not show empty hint when a chapter has scenes", () => {
    const props = makeProps(); // default tree has 1 scene in chapter
    const { container } = render(<Binder {...props} />);
    expect(container.textContent).not.toContain("No scenes yet");
  });
});

describe("Binder — short pieces empty state", () => {
  it("shows 'Nothing here yet' when shortPieces is empty", () => {
    const tree = makeTree({ shortPieces: [] });
    const { container } = render(<Binder {...makeProps({ tree })} />);
    expect(container.textContent).toContain("Nothing here yet");
  });

  it("clicking 'add one' in empty short-pieces calls onCreateScene with null", () => {
    const onCreateScene = vi.fn();
    const tree = makeTree({ shortPieces: [] });
    const { container } = render(<Binder {...makeProps({ tree, callbacks: { onCreateScene } })} />);
    // Find the "add one" button inside the short-pieces empty hint (last .empty-hint button).
    const emptyHints = Array.from(container.querySelectorAll("p.empty-hint"));
    const spHint = emptyHints[emptyHints.length - 1] as HTMLElement;
    const addOneBtn = spHint.querySelector("button") as HTMLButtonElement;
    expect(addOneBtn).not.toBeNull();
    fireEvent.click(addOneBtn);
    expect(onCreateScene).toHaveBeenCalledWith(null);
  });
});

// ── manuscriptTotal → ProjectSwitcher ────────────────────────────────────

describe("Binder — manuscriptTotal wired to ProjectSwitcher subtitle", () => {
  it("shows the manuscriptTotal prop (not tree word sum) in .proj-sub when provided", () => {
    // manuscriptTotal comes from useManuscriptWordCount (Phase 1) which includes
    // live editor counts — it may differ from the static tree word_count sum.
    const props = makeProps({ manuscriptTotal: 41280 });
    const { container } = render(<Binder {...props} />);
    const sub = container.querySelector(".proj-sub");
    expect(sub?.textContent).toBe("Novel · 41,280 words");
  });

  it("omits the word count from the subtitle when manuscriptTotal is not provided", () => {
    // No manuscriptTotal → subtitle shows only the type label (no stale number).
    const props = makeProps();
    const { container } = render(<Binder {...props} />);
    const sub = container.querySelector(".proj-sub");
    expect(sub?.textContent).toBe("Novel");
  });
});

// ── Right-click 'Add goal' context menu (Wave 25 P6b) ─────────────────────

describe("Binder — right-click 'Add goal' context menu fires onAddGoal with correct scope+id", () => {
  it("scene right-click 'Add goal…' calls onAddGoal('scene', sceneId)", () => {
    const onAddGoal = vi.fn();
    const props = makeProps({ callbacks: { onAddGoal } });
    const { container } = render(<Binder {...props} />);

    // The scene row is the <li class="scene-row"> element.
    const sceneRow = container.querySelector("li.scene-row") as HTMLElement;
    expect(sceneRow).not.toBeNull();
    fireEvent.contextMenu(sceneRow);

    // "Add goal…" should appear as a context-menu button.
    const addGoalBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Add goal"),
    ) as HTMLElement;
    expect(addGoalBtn).toBeDefined();
    fireEvent.click(addGoalBtn);

    expect(onAddGoal).toHaveBeenCalledTimes(1);
    expect(onAddGoal).toHaveBeenCalledWith("scene", "s1");
  });

  it("chapter right-click 'Add goal…' calls onAddGoal('chapter', folderId)", () => {
    const onAddGoal = vi.fn();
    const props = makeProps({ callbacks: { onAddGoal } });
    const { container } = render(<Binder {...props} />);

    // The chapter row is the <div class="chapter-row"> element.
    const chapterRow = container.querySelector(".chapter-row") as HTMLElement;
    expect(chapterRow).not.toBeNull();
    fireEvent.contextMenu(chapterRow);

    // "Add goal…" should appear as a context-menu button.
    const addGoalBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Add goal"),
    ) as HTMLElement;
    expect(addGoalBtn).toBeDefined();
    fireEvent.click(addGoalBtn);

    expect(onAddGoal).toHaveBeenCalledTimes(1);
    expect(onAddGoal).toHaveBeenCalledWith("chapter", "f1");
  });

  it("'Add goal…' is absent from scene context menu when onAddGoal is not provided", () => {
    // No onAddGoal in callbacks — the menu item must not appear.
    const props = makeProps(); // makeCallbacks does not include onAddGoal by default
    const { container } = render(<Binder {...props} />);

    const sceneRow = container.querySelector("li.scene-row") as HTMLElement;
    expect(sceneRow).not.toBeNull();
    fireEvent.contextMenu(sceneRow);

    const addGoalBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Add goal…",
    );
    expect(addGoalBtn).toBeUndefined();
  });
});
