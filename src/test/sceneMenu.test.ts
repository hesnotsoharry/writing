// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import type { MenuItem, MenuItemAction } from "../components/menu/ContextMenu";
import type { ChapterMenuCallbacks, SceneMenuCallbacks } from "../components/menu/sceneMenu";
import {
  buildChapterMenu,
  buildSceneMenu,
} from "../components/menu/sceneMenu";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSceneCb(overrides?: Partial<SceneMenuCallbacks>): SceneMenuCallbacks {
  return {
    onRename:    vi.fn(),
    currentStatus: "draft",
    onSetStatus: vi.fn(),
    onDuplicate: vi.fn(),
    onExport:    vi.fn(),
    onArchive:   vi.fn(),
    onDelete:    vi.fn(),
    ...overrides,
  };
}

function makeChapterCb(overrides?: Partial<ChapterMenuCallbacks>): ChapterMenuCallbacks {
  return {
    onRename:   vi.fn(),
    onNewScene: vi.fn(),
    onExport:   vi.fn(),
    onArchive:  vi.fn(),
    onDelete:   vi.fn(),
    ...overrides,
  };
}

function actionLabels(items: MenuItem[]): string[] {
  return items
    .filter((it): it is Extract<MenuItem, { label: string }> => "label" in it)
    .map((it) => it.label);
}

// ── buildSceneMenu ────────────────────────────────────────────────────────────

describe("buildSceneMenu", () => {
  it("returns exactly 7 top-level items (Rename, Set status, Duplicate, Export, sep, Archive, Delete)", () => {
    const items = buildSceneMenu(makeSceneCb());
    expect(items).toHaveLength(7);
  });

  it("first item label is 'Rename'", () => {
    const items = buildSceneMenu(makeSceneCb());
    const first = items[0];
    expect("label" in first && first.label).toBe("Rename");
  });

  it("second item is 'Set status' with a submenu of 5 entries", () => {
    const items = buildSceneMenu(makeSceneCb());
    const second = items[1];
    expect("label" in second && second.label).toBe("Set status");
    expect("submenu" in second && Array.isArray(second.submenu) && second.submenu).toHaveLength(5);
  });

  it("status submenu follows STATUS_ORDER: blank/outline/draft/revise/final", () => {
    const items = buildSceneMenu(makeSceneCb());
    const second = items[1] as MenuItemAction;
    const labels = actionLabels(second.submenu!);
    expect(labels).toStrictEqual(["To write", "Outlined", "Drafting", "Revising", "Final"]);
  });

  it("tick is set on the current status (draft) in the submenu", () => {
    const items = buildSceneMenu(makeSceneCb({ currentStatus: "draft" }));
    const second = items[1] as MenuItemAction;
    const draftItem = second.submenu![2] as MenuItemAction;
    expect(draftItem.tick).toBe(true);
  });

  it("tick is NOT set on non-current statuses", () => {
    const items = buildSceneMenu(makeSceneCb({ currentStatus: "blank" }));
    const second = items[1] as MenuItemAction;
    // blank (index 0) has tick; rest do not.
    for (let i = 1; i < second.submenu!.length; i++) {
      const it = second.submenu![i] as MenuItemAction;
      expect(it.tick).toBeFalsy();
    }
  });

  it("item at index 4 is a separator", () => {
    const items = buildSceneMenu(makeSceneCb());
    expect(items[4]).toStrictEqual({ type: "sep" });
  });

  it("last item ('Delete') has danger:true", () => {
    const items = buildSceneMenu(makeSceneCb());
    const last = items[items.length - 1] as MenuItemAction;
    expect(last.danger).toBe(true);
    expect("label" in last && last.label).toBe("Delete");
  });

  it("Archive item does NOT have danger flag", () => {
    const items = buildSceneMenu(makeSceneCb());
    const archiveItem = items[5] as MenuItemAction;
    expect("label" in archiveItem && archiveItem.label).toBe("Archive");
    expect(archiveItem.danger).toBeFalsy();
  });

  it("status submenu items have swatch colors from STATUS_META", () => {
    const items = buildSceneMenu(makeSceneCb());
    const second = items[1] as MenuItemAction;
    const blankItem = second.submenu![0] as MenuItemAction;
    expect(blankItem.swatch).toBe("var(--ink-4)");
    const finalItem = second.submenu![4] as MenuItemAction;
    expect(finalItem.swatch).toBe("var(--good)");
  });

  it("onRename fires when Rename onClick is called", () => {
    const cb = makeSceneCb();
    const items = buildSceneMenu(cb);
    const first = items[0] as MenuItemAction;
    first.onClick?.();
    expect(cb.onRename).toHaveBeenCalledOnce();
  });

  it("onDelete fires when Delete onClick is called", () => {
    const cb = makeSceneCb();
    const items = buildSceneMenu(cb);
    const last = items[items.length - 1] as MenuItemAction;
    last.onClick?.();
    expect(cb.onDelete).toHaveBeenCalledOnce();
  });

  it("onSetStatus is called with the correct status from submenu", () => {
    const cb = makeSceneCb();
    const items = buildSceneMenu(cb);
    const second = items[1] as MenuItemAction;
    const finalItem = second.submenu![4] as MenuItemAction;
    finalItem.onClick?.();
    expect(cb.onSetStatus).toHaveBeenCalledWith("final");
  });
});

// ── buildChapterMenu ──────────────────────────────────────────────────────────

describe("buildChapterMenu", () => {
  it("returns exactly 7 top-level items", () => {
    const items = buildChapterMenu(makeChapterCb());
    expect(items).toHaveLength(7);
  });

  it("first item is 'Rename chapter'", () => {
    const items = buildChapterMenu(makeChapterCb());
    const first = items[0];
    expect("label" in first && first.label).toBe("Rename chapter");
  });

  it("second item is 'New scene'", () => {
    const items = buildChapterMenu(makeChapterCb());
    const second = items[1];
    expect("label" in second && second.label).toBe("New scene");
  });

  it("item at index 2 is a separator", () => {
    const items = buildChapterMenu(makeChapterCb());
    expect(items[2]).toStrictEqual({ type: "sep" });
  });

  it("item at index 5 is a separator", () => {
    const items = buildChapterMenu(makeChapterCb());
    expect(items[5]).toStrictEqual({ type: "sep" });
  });

  it("last item is 'Delete chapter' with danger:true", () => {
    const items = buildChapterMenu(makeChapterCb());
    const last = items[items.length - 1] as MenuItemAction;
    expect(last.danger).toBe(true);
    expect("label" in last && last.label).toBe("Delete chapter");
  });

  it("'Archive chapter' item does NOT have danger flag", () => {
    const items = buildChapterMenu(makeChapterCb());
    const archiveItem = items[4] as MenuItemAction;
    expect("label" in archiveItem && archiveItem.label).toBe("Archive chapter");
    expect(archiveItem.danger).toBeFalsy();
  });

  it("onNewScene fires when 'New scene' onClick is called", () => {
    const cb = makeChapterCb();
    const items = buildChapterMenu(cb);
    const second = items[1] as MenuItemAction;
    second.onClick?.();
    expect(cb.onNewScene).toHaveBeenCalledOnce();
  });
});
