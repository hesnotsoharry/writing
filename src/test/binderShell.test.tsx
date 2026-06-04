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
}

function makeProps(overrides: MakePropsOverrides = {}) {
  const {
    tree = makeTree(),
    callbacks = {},
    quickCount,
    archivedCount,
    onOpenQuickNotes = vi.fn(),
    onOpenArchive = vi.fn(),
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

// ── activeWords → ProjectSwitcher ─────────────────────────────────────────

describe("Binder — activeWords wired to ProjectSwitcher", () => {
  it("sums chapters + shortPieces word counts and shows total in .proj-sub", () => {
    const scene100 = makeScene({ id: "s1", word_count: 100 });
    const scene200 = makeScene({ id: "s2", title: "Scene Two", word_count: 200 });
    const shortPiece50 = makeScene({ id: "s3", folder_id: null, title: "A note", word_count: 50 });
    const tree: BinderTree = {
      chapters: [
        {
          folder: { id: "f1", project_id: "p1", title: "Chapter One", sort_order: 0 },
          scenes: [scene100, scene200],
        },
      ],
      shortPieces: [shortPiece50],
    };
    const props = makeProps({ tree });
    const { container } = render(<Binder {...props} />);
    const sub = container.querySelector(".proj-sub");
    expect(sub?.textContent).toBe("Novel · 350 words");
  });
});
