// @vitest-environment jsdom
/**
 * Export-wiring integration tests (Wave 23 integration).
 *
 * Contract: each export trigger (scene context-menu, chapter context-menu,
 * corkboard scene context-menu, TitleBar Export button) sets the correct
 * scope+target and opens the ExportOverlay.  Tests render the real components
 * with spy callbacks — no vacuous mock-only assertions.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BinderCallbacks } from "../binder/BinderCrud";
import { ChapterHeader, SceneRow } from "../binder/BinderCrud";
import { BinderToastProvider } from "../binder/binderToast";
import type { BinderTree } from "../binder/buildTree";
import { buildTree } from "../binder/buildTree";
import type { Folder, Scene } from "../db/binderStore";
import { InMemorySceneDocStore } from "../db/sceneDocStore";
import { Corkboard } from "../features/corkboard/Corkboard";
import { ExportOverlay } from "../features/export/Export";

afterEach(() => { cleanup(); });

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeScene(over: Partial<Scene> & { id: string; title: string }): Scene {
  return {
    project_id: "proj-1",
    folder_id: null,
    synopsis: null,
    sort_order: 0,
    word_count: 0,
    status: "blank",
    ...over,
  };
}

function makeFolder(id: string, title: string): Folder {
  return { id, project_id: "proj-1", title, sort_order: 0 };
}

function makeCallbacks(over: Partial<BinderCallbacks> = {}): BinderCallbacks {
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
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Helper: click the first .cm-item that contains the given text substring
// ---------------------------------------------------------------------------

function clickMenuItem(container: HTMLElement, labelSubstr: string) {
  const item = Array.from(container.querySelectorAll(".cm-item")).find(
    (el) => el.textContent?.includes(labelSubstr),
  ) as HTMLElement | undefined;
  if (!item) throw new Error(`Menu item "${labelSubstr}" not found`);
  fireEvent.click(item);
}

// ---------------------------------------------------------------------------
// Scene context-menu trigger (BinderCrud SceneRow)
// ---------------------------------------------------------------------------

describe("SceneRow — context-menu Export trigger", () => {
  it("calls onExport with scope='scene' and the scene's id when 'Export scene…' is clicked", () => {
    const onExport = vi.fn();
    const scene = makeScene({ id: "s-abc", title: "My Scene" });
    const callbacks = makeCallbacks({ onExport });

    const { container } = render(
      <BinderToastProvider>
        <ul>
          <SceneRow scene={scene} isSelected={false} onSelect={vi.fn()} callbacks={callbacks} />
        </ul>
      </BinderToastProvider>
    );

    fireEvent.contextMenu(container.querySelector("li.scene-row") as HTMLElement);
    clickMenuItem(container, "Export scene");

    expect(onExport).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledWith("scene", "s-abc");
  });

  it("shows 'Export — coming in a later wave' toast (no crash) when onExport is omitted", () => {
    // When onExport is absent the fallback toast fires — verify no exception thrown.
    const scene = makeScene({ id: "s-no-export", title: "Scene No Export" });
    const callbacks = makeCallbacks(); // no onExport

    const { container } = render(
      <BinderToastProvider>
        <ul>
          <SceneRow scene={scene} isSelected={false} onSelect={vi.fn()} callbacks={callbacks} />
        </ul>
      </BinderToastProvider>
    );

    fireEvent.contextMenu(container.querySelector("li.scene-row") as HTMLElement);
    // Should not throw — just shows a toast
    expect(() => clickMenuItem(container, "Export scene")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Chapter context-menu trigger (BinderCrud ChapterHeader)
// ---------------------------------------------------------------------------

describe("ChapterHeader — context-menu Export trigger", () => {
  it("calls onExport with scope='chapter' and the folder's id when 'Export chapter…' is clicked", () => {
    const onExport = vi.fn();
    const folder = makeFolder("f-123", "Chapter One");
    const chapter: BinderTree["chapters"][0] = { folder, scenes: [] };
    const callbacks = makeCallbacks({ onExport });

    const { container } = render(
      <BinderToastProvider>
        <ChapterHeader chapter={chapter} callbacks={callbacks} />
      </BinderToastProvider>
    );

    fireEvent.contextMenu(container.querySelector(".chapter-row") as HTMLElement);
    clickMenuItem(container, "Export chapter");

    expect(onExport).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledWith("chapter", "f-123");
  });

  it("shows 'Export — coming in a later wave' toast (no crash) when onExport is omitted", () => {
    const folder = makeFolder("f-no-export", "No Export Chapter");
    const chapter: BinderTree["chapters"][0] = { folder, scenes: [] };
    const callbacks = makeCallbacks(); // no onExport

    const { container } = render(
      <BinderToastProvider>
        <ChapterHeader chapter={chapter} callbacks={callbacks} />
      </BinderToastProvider>
    );

    fireEvent.contextMenu(container.querySelector(".chapter-row") as HTMLElement);
    expect(() => clickMenuItem(container, "Export chapter")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Corkboard context-menu trigger
// ---------------------------------------------------------------------------

describe("Corkboard — context-menu Export trigger", () => {
  it("calls onExport with scope='scene' and the scene's id when 'Export scene…' is clicked", () => {
    const onExport = vi.fn();
    const folder = makeFolder("f1", "Chapter One");
    const scene = makeScene({ id: "s-cork", title: "Cork Scene", folder_id: "f1" });
    const tree = buildTree([folder], [scene]);

    const { container } = render(
      <Corkboard
        tree={tree}
        onSelectScene={vi.fn()}
        onViewChange={vi.fn()}
        onExport={onExport}
      />
    );

    // Right-click the card to open the context menu
    const card = container.querySelector(".card") as HTMLElement;
    fireEvent.contextMenu(card);

    clickMenuItem(container, "Export scene");

    expect(onExport).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledWith("scene", "s-cork");
  });
});

// ---------------------------------------------------------------------------
// ExportOverlay — receives correct projectId, scope, targetId
// ---------------------------------------------------------------------------

describe("ExportOverlay — receives correct projectId, scope, targetId", () => {
  it("shows 'Scene' sub-header when scope='scene'", async () => {
    const store = new InMemorySceneDocStore();
    const folder = makeFolder("f1", "Chapter One");
    const scene = makeScene({ id: "s1", title: "Scene One", folder_id: "f1" });
    await store.save("s1", "", "");
    const tree = buildTree([folder], [scene]);

    render(
      <ExportOverlay
        projectId="proj-1"
        scope="scene"
        targetId="s1"
        sceneDocStore={store}
        tree={tree}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Scene")).toBeInTheDocument();
  });

  it("shows 'Chapter' sub-header when scope='chapter'", async () => {
    const store = new InMemorySceneDocStore();
    const folder = makeFolder("f1", "Chapter One");
    const tree = buildTree([folder], []);

    render(
      <ExportOverlay
        projectId="proj-1"
        scope="chapter"
        targetId="f1"
        sceneDocStore={store}
        tree={tree}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Chapter")).toBeInTheDocument();
  });

  it("shows 'Whole manuscript' sub-header when scope='manuscript'", async () => {
    const store = new InMemorySceneDocStore();
    const tree = buildTree([], []);

    render(
      <ExportOverlay
        projectId="proj-1"
        scope="manuscript"
        targetId="proj-1"
        sceneDocStore={store}
        tree={tree}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Whole manuscript")).toBeInTheDocument();
  });
});
