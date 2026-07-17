// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type BinderCallbacks, ChapterHeader, SceneRow } from "../binder/BinderCrud";
import { BinderToastProvider } from "../binder/binderToast";
import { BoardRowItem } from "../binder/BrainstormSection";
import type { BinderTree } from "../binder/buildTree";
import type { Scene } from "../db/binderStore";

afterEach(cleanup);

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: "s1",
    project_id: "p1",
    folder_id: "f1",
    title: "Test Scene",
    synopsis: null,
    sort_order: 0,
    word_count: 1234,
    status: "draft",
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

function makeChapter(scenes: Scene[] = []): BinderTree["chapters"][0] {
  return {
    folder: { id: "f1", project_id: "p1", title: "Chapter One", sort_order: 0 },
    scenes,
  };
}

function renderScene(scene: Scene, callbacks: BinderCallbacks) {
  return render(
    <BinderToastProvider>
      <ul>
        <SceneRow
          scene={scene}
          isSelected={false}
          onSelect={vi.fn()}
          callbacks={callbacks}
        />
      </ul>
    </BinderToastProvider>
  );
}

function renderChapter(chapter: BinderTree["chapters"][0], callbacks: BinderCallbacks) {
  return render(
    <BinderToastProvider>
      <ChapterHeader chapter={chapter} callbacks={callbacks} />
    </BinderToastProvider>
  );
}

// ── Scene status indicator ────────────────────────────────────────────────

describe("SceneRow — status indicator", () => {
  it("renders an svg glyph (no bare dot span) for non-final status", () => {
    const { container } = renderScene(makeScene({ status: "draft" }), makeCallbacks());
    // StatusGlyph renders an svg symbol for every status — no bare colored dot span.
    const glyph = container.querySelector('[role="button"] svg') as SVGElement;
    expect(glyph).not.toBeNull();
    expect(container.querySelector(".scene-dot")).toBeNull();
  });

  it("renders an svg glyph (no bare dot span) for final status", () => {
    const { container } = renderScene(makeScene({ status: "final" }), makeCallbacks());
    const glyph = container.querySelector('[role="button"] svg') as SVGElement;
    expect(glyph).not.toBeNull();
    expect(container.querySelector(".scene-dot")).toBeNull();
  });
});

// ── Word count ────────────────────────────────────────────────────────────

describe("SceneRow — word count", () => {
  it("renders formatted word count in .scene-words", () => {
    const { container } = renderScene(makeScene({ word_count: 1234 }), makeCallbacks());
    const words = container.querySelector(".scene-words");
    expect(words?.textContent).toBe("1,234");
  });

  it("renders '0' (not em-dash) when word_count is 0 — new scene shows numeric zero", () => {
    const { container } = renderScene(makeScene({ word_count: 0 }), makeCallbacks());
    expect(container.querySelector(".scene-words")?.textContent).toBe("0");
  });
});

// ── No inline edit buttons ────────────────────────────────────────────────

describe("SceneRow — no always-visible mutate buttons", () => {
  it("does not render a ✎ rename button", () => {
    const { container } = renderScene(makeScene(), makeCallbacks());
    const buttons = Array.from(container.querySelectorAll("button"));
    const hasRenameBtn = buttons.some((b) => b.textContent?.includes("✎"));
    expect(hasRenameBtn).toBe(false);
  });

  it("does not render a × delete button", () => {
    const { container } = renderScene(makeScene(), makeCallbacks());
    const buttons = Array.from(container.querySelectorAll("button"));
    const hasDeleteBtn = buttons.some((b) => b.textContent?.includes("×"));
    expect(hasDeleteBtn).toBe(false);
  });
});

describe("ChapterHeader — no always-visible mutate buttons", () => {
  it("does not render ✎, +, or × inline buttons", () => {
    const { container } = renderChapter(makeChapter(), makeCallbacks());
    const buttons = Array.from(container.querySelectorAll("button"));
    const inline = buttons.filter((b) => {
      const t = b.textContent ?? "";
      return t.includes("✎") || t.includes("×") || t === "+";
    });
    expect(inline).toHaveLength(0);
  });
});

// ── Context menu — scene ──────────────────────────────────────────────────

describe("SceneRow — context menu", () => {
  it("confirms scene deletion and preserves the scene title", () => {
    const callbacks = makeCallbacks();
    const { container } = renderScene(makeScene(), callbacks);
    fireEvent.contextMenu(container.querySelector("li.scene-row") as HTMLElement);
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Test Scene");
    fireEvent.click(screen.getByRole("button", { name: "Delete scene" }));
    expect(callbacks.onDeleteScene).toHaveBeenCalledWith("s1");
  });

  it("cancels scene deletion on Escape without writing", () => {
    const callbacks = makeCallbacks();
    const { container } = renderScene(makeScene(), callbacks);
    fireEvent.contextMenu(container.querySelector("li.scene-row") as HTMLElement);
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(callbacks.onDeleteScene).not.toHaveBeenCalled();
  });
  it("shows .cm menu with Rename and Delete items on right-click", () => {
    const { container } = renderScene(makeScene(), makeCallbacks());
    const li = container.querySelector("li.scene-row") as HTMLElement;
    fireEvent.contextMenu(li);
    expect(document.body.querySelector(".cm")).not.toBeNull();
    const labels = Array.from(document.body.querySelectorAll(".cm-item")).map(
      (el) => el.textContent
    );
    expect(labels.some((l) => l?.includes("Rename"))).toBe(true);
    expect(labels.some((l) => l?.includes("Delete"))).toBe(true);
    expect(labels.some((l) => l?.includes("Duplicate"))).toBe(true);
    expect(labels.some((l) => l?.includes("Export"))).toBe(true);
    expect(labels.some((l) => l?.includes("Archive"))).toBe(true);
  });

  it("shows a Set status submenu item", () => {
    const { container } = renderScene(makeScene(), makeCallbacks());
    fireEvent.contextMenu(container.querySelector("li.scene-row") as HTMLElement);
    const labels = Array.from(document.body.querySelectorAll(".cm-item")).map(
      (el) => el.textContent
    );
    expect(labels.some((l) => l?.includes("Set status"))).toBe(true);
  });

  it("calls onSetSceneStatus with the chosen status when a status submenu item is clicked", () => {
    const callbacks = makeCallbacks();
    const { container } = renderScene(makeScene({ status: "draft" }), callbacks);
    fireEvent.contextMenu(container.querySelector("li.scene-row") as HTMLElement);

    // Hover the "Set status" item to open the submenu.
    const statusBtn = Array.from(document.body.querySelectorAll(".cm-item")).find(
      (el) => el.textContent?.includes("Set status")
    ) as HTMLElement;
    fireEvent.mouseEnter(statusBtn);

    // Click "To write" (blank).
    const subItems = Array.from(document.body.querySelectorAll(".cm-sub .cm-item"));
    const toWriteBtn = subItems.find((el) => el.textContent?.includes("To write")) as HTMLElement;
    expect(toWriteBtn).not.toBeNull();
    fireEvent.click(toWriteBtn);

    expect(callbacks.onSetSceneStatus).toHaveBeenCalledWith("s1", "blank");
  });
});

// ── Selected row carries .active class ───────────────────────────────────

describe("SceneRow — selection state", () => {
  it("carries the 'active' class on scene-row when isSelected is true", () => {
    const { container } = render(
      <BinderToastProvider>
        <ul>
          <SceneRow
            scene={makeScene()}
            isSelected={true}
            onSelect={vi.fn()}
            callbacks={makeCallbacks()}
          />
        </ul>
      </BinderToastProvider>
    );
    const li = container.querySelector("li.scene-row");
    expect(li?.classList.contains("active")).toBe(true);
  });
});

// ── Double-click to rename ────────────────────────────────────────────────

describe("SceneRow — double-click rename", () => {
  it("shows .rename-input on double-click", () => {
    const { container } = renderScene(makeScene(), makeCallbacks());
    const li = container.querySelector("li.scene-row") as HTMLElement;
    fireEvent.doubleClick(li);
    expect(container.querySelector(".rename-input")).not.toBeNull();
  });
});

// ── Chapter header ────────────────────────────────────────────────────────

describe("ChapterHeader", () => {
  it("confirms chapter deletion and shows the scene relocation warning", () => {
    const callbacks = makeCallbacks();
    const { container } = renderChapter(makeChapter(), callbacks);
    fireEvent.contextMenu(container.querySelector(".chapter-row") as HTMLElement);
    fireEvent.click(screen.getByText("Delete chapter"));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Its scenes will move to Short pieces.");
    fireEvent.click(screen.getByRole("button", { name: "Delete chapter" }));
    expect(callbacks.onDeleteChapter).toHaveBeenCalledWith("f1");
  });

  it("cancels chapter deletion via backdrop", () => {
    const callbacks = makeCallbacks();
    const { container } = renderChapter(makeChapter(), callbacks);
    fireEvent.contextMenu(container.querySelector(".chapter-row") as HTMLElement);
    fireEvent.click(screen.getByText("Delete chapter"));
    fireEvent.mouseDown(screen.getByRole("presentation"));
    expect(callbacks.onDeleteChapter).not.toHaveBeenCalled();
  });

  it("renders .ch-count equal to scenes.length", () => {
    const scenes = [makeScene(), makeScene({ id: "s2", title: "Scene 2" })];
    const { container } = renderChapter(makeChapter(scenes), makeCallbacks());
    expect(container.querySelector(".ch-count")?.textContent).toBe("2");
  });

  it("renders a .twist element inside the chapter row", () => {
    const { container } = renderChapter(makeChapter(), makeCallbacks());
    expect(container.querySelector(".twist")).not.toBeNull();
  });

  it("shows chapter context menu on right-click with expected items", () => {
    const { container } = renderChapter(makeChapter(), makeCallbacks());
    const row = container.querySelector(".chapter-row") as HTMLElement;
    fireEvent.contextMenu(row);
    expect(document.body.querySelector(".cm")).not.toBeNull();
    const labels = Array.from(document.body.querySelectorAll(".cm-item")).map(
      (el) => el.textContent
    );
    expect(labels.some((l) => l?.includes("Rename"))).toBe(true);
    expect(labels.some((l) => l?.includes("New scene"))).toBe(true);
    expect(labels.some((l) => l?.includes("Export"))).toBe(true);
    expect(labels.some((l) => l?.includes("Archive"))).toBe(true);
    expect(labels.some((l) => l?.includes("Delete"))).toBe(true);
  });
});

describe("BoardRowItem — delete confirmation", () => {
  const board = { id: "b1", project_id: "p1", title: "Idea Board", sort: 0 };

  it("confirms board deletion", () => {
    const onDelete = vi.fn();
    render(<BoardRowItem board={board} onOpen={vi.fn()} onRename={vi.fn()} onDelete={onDelete} />);
    fireEvent.contextMenu(screen.getByRole("button", { name: "Idea Board" }));
    fireEvent.click(screen.getByText("Delete board"));
    fireEvent.click(screen.getByRole("button", { name: "Delete board" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("cancels board deletion on Escape", () => {
    const onDelete = vi.fn();
    render(<BoardRowItem board={board} onOpen={vi.fn()} onRename={vi.fn()} onDelete={onDelete} />);
    fireEvent.contextMenu(screen.getByRole("button", { name: "Idea Board" }));
    fireEvent.click(screen.getByText("Delete board"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDelete).not.toHaveBeenCalled();
  });
});

// ── Status submenu tick ───────────────────────────────────────────────────

describe("SceneRow — status submenu tick marks current status", () => {
  it("ticks the current status item and does not tick a non-current item", () => {
    const { container } = renderScene(makeScene({ status: "draft" }), makeCallbacks());
    fireEvent.contextMenu(container.querySelector("li.scene-row") as HTMLElement);

    const statusBtn = Array.from(document.body.querySelectorAll(".cm-item")).find(
      (el) => el.textContent?.includes("Set status")
    ) as HTMLElement;
    fireEvent.mouseEnter(statusBtn);

    const subItems = Array.from(document.body.querySelectorAll(".cm-sub .cm-item"));

    // "Drafting" is the label for "draft" — should have a .tick child.
    const draftItem = subItems.find((el) => el.textContent?.includes("Drafting")) as HTMLElement;
    expect(draftItem).not.toBeNull();
    expect(draftItem.querySelector(".tick")).not.toBeNull();

    // "To write" is the label for "blank" — must NOT have a .tick child.
    const blankItem = subItems.find((el) => el.textContent?.includes("To write")) as HTMLElement;
    expect(blankItem).not.toBeNull();
    expect(blankItem.querySelector(".tick")).toBeNull();
  });
});

// ── Chapter double-click → inline rename ──────────────────────────────────

describe("ChapterHeader — double-click rename", () => {
  it("shows .rename-input on double-click of the chapter row", () => {
    const { container } = renderChapter(makeChapter(), makeCallbacks());
    const row = container.querySelector(".chapter-row") as HTMLElement;
    fireEvent.doubleClick(row);
    expect(container.querySelector(".rename-input")).not.toBeNull();
  });
});

// ── Dot click → status picker ────────────────────────────────────────────

describe("SceneRow — dot click opens status picker", () => {
  it("clicking the status dot does NOT call onSelect (stopPropagation isolation)", () => {
    const onSelect = vi.fn();
    const callbacks = makeCallbacks();
    const { container } = render(
      <BinderToastProvider>
        <ul>
          <SceneRow
            scene={makeScene({ status: "draft" })}
            isSelected={false}
            onSelect={onSelect}
            callbacks={callbacks}
          />
        </ul>
      </BinderToastProvider>
    );
    const dot = container.querySelector('span[role="button"]') as HTMLElement;
    fireEvent.click(dot);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clicking the status dot renders a picker with exactly 5 status items", () => {
    const callbacks = makeCallbacks();
    const { container } = renderScene(makeScene({ status: "draft" }), callbacks);
    const dot = container.querySelector('span[role="button"]') as HTMLElement;
    fireEvent.click(dot);
    const items = document.body.querySelectorAll(".cm-item");
    expect(items).toHaveLength(5);
  });

  it("selecting 'Final' from the picker calls onSetSceneStatus(scene.id, 'final')", () => {
    const callbacks = makeCallbacks();
    const { container } = renderScene(makeScene({ status: "draft" }), callbacks);
    const dot = container.querySelector('span[role="button"]') as HTMLElement;
    fireEvent.click(dot);
    const finalItem = Array.from(document.body.querySelectorAll(".cm-item")).find(
      (el) => el.textContent?.includes("Final")
    ) as HTMLElement;
    fireEvent.click(finalItem);
    expect(callbacks.onSetSceneStatus).toHaveBeenCalledWith("s1", "final");
  });
});

// ── Toast ─────────────────────────────────────────────────────────────────

describe("SceneRow — Duplicate fires toast", () => {
  it("shows 'Duplicate — coming in a later wave' toast when Duplicate is clicked", () => {
    const { container } = renderScene(makeScene(), makeCallbacks());
    fireEvent.contextMenu(container.querySelector("li.scene-row") as HTMLElement);

    const duplicateBtn = Array.from(document.body.querySelectorAll(".cm-item")).find(
      (el) => el.textContent?.includes("Duplicate")
    ) as HTMLElement;
    fireEvent.click(duplicateBtn);

    expect(screen.getByText("Duplicate — coming in a later wave")).not.toBeNull();
  });
});
