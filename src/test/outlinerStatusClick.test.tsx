// @vitest-environment jsdom
/**
 * Outliner — status dot click dispatches to h.onStatus with the updated scene.
 *
 * Guards the `{ ...scene, status: s }` spread in handleStatusClick.
 * No CDP needed — pure React render + fireEvent.
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BinderTree } from "../binder/buildTree";
import type { Scene } from "../db/binderStore";
import { Outliner } from "../features/outliner/Outliner";

afterEach(cleanup);

const scene: Scene = {
  id: "s1",
  project_id: "p1",
  folder_id: null,
  title: "Test Scene",
  synopsis: null,
  sort_order: 0,
  word_count: 0,
  status: "draft",
};

const tree: BinderTree = { chapters: [], shortPieces: [scene] };

describe("Outliner — status dot click opens the picker", () => {
  it("clicking .otl-statusbtn renders a .cm context menu", () => {
    const { container } = render(
      <Outliner
        tree={tree} labels={[]} sceneLabels={{}}
        sort={{ col: "manual", dir: "asc" }} setSort={vi.fn()}
        h={{}}
      />
    );
    fireEvent.click(container.querySelector(".otl-statusbtn") as HTMLElement);
    expect(document.body.querySelector(".cm")).not.toBeNull();
  });
});

describe("Outliner — selecting a status calls h.onStatus with the new status", () => {
  it("picking 'Final' calls h.onStatus with { id: scene.id, status: 'final' }", () => {
    const onStatus = vi.fn();
    const { container } = render(
      <Outliner
        tree={tree} labels={[]} sceneLabels={{}}
        sort={{ col: "manual", dir: "asc" }} setSort={vi.fn()}
        h={{ onStatus }}
      />
    );
    fireEvent.click(container.querySelector(".otl-statusbtn") as HTMLElement);
    const finalItem = Array.from(document.body.querySelectorAll(".cm-item")).find(
      (el) => el.textContent?.includes("Final")
    ) as HTMLElement;
    expect(finalItem).not.toBeNull();
    fireEvent.click(finalItem);
    expect(onStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "s1", status: "final" }),
    );
  });

  it("picking 'To write' calls h.onStatus with { id: scene.id, status: 'blank' }", () => {
    const onStatus = vi.fn();
    const { container } = render(
      <Outliner
        tree={tree} labels={[]} sceneLabels={{}}
        sort={{ col: "manual", dir: "asc" }} setSort={vi.fn()}
        h={{ onStatus }}
      />
    );
    fireEvent.click(container.querySelector(".otl-statusbtn") as HTMLElement);
    const blankItem = Array.from(document.body.querySelectorAll(".cm-item")).find(
      (el) => el.textContent?.includes("To write")
    ) as HTMLElement;
    fireEvent.click(blankItem);
    expect(onStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "s1", status: "blank" }),
    );
  });
});
