import { describe, expect,it } from "vitest";

import { buildTree } from "../binder/buildTree";
import type { Folder, Scene } from "../db/binderStore";

// ---------------------------------------------------------------------------
// Helpers — construct minimal test fixtures without touching real stores.
// ---------------------------------------------------------------------------

function folder(id: string, sort_order: number): Folder {
  return { id, project_id: "p1", title: `Folder ${id}`, sort_order };
}

function scene(
  id: string,
  folder_id: string | null,
  sort_order: number
): Scene {
  return {
    id,
    project_id: "p1",
    folder_id,
    title: `Scene ${id}`,
    synopsis: null,
    sort_order,
    word_count: 0,
    status: "blank",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildTree", () => {
  it("returns chapters in folder sort_order when folders are out of order", () => {
    const folders = [folder("f2", 2000), folder("f1", 1000)];
    const scenes: Scene[] = [];
    const tree = buildTree(folders, scenes);
    expect(tree.chapters.map((c) => c.folder.id)).toEqual(["f1", "f2"]);
  });

  it("assigns scenes to their chapter, sorted by scene sort_order", () => {
    const folders = [folder("f1", 1000)];
    // Deliberately insert in reverse order to confirm sort.
    const scenes = [scene("s2", "f1", 2000), scene("s1", "f1", 1000)];
    const tree = buildTree(folders, scenes);
    expect(tree.chapters[0].scenes.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("puts folder_id=null scenes in shortPieces, sorted by sort_order", () => {
    const folders: Folder[] = [];
    const scenes = [scene("s2", null, 2000), scene("s1", null, 1000)];
    const tree = buildTree(folders, scenes);
    expect(tree.shortPieces.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(tree.chapters).toHaveLength(0);
  });

  it("scenes not belonging to any folder in the list appear in shortPieces if folder_id is null", () => {
    // Folder f1 exists; scene s1 belongs to it; scene s2 is a short piece.
    const folders = [folder("f1", 1000)];
    const scenes = [scene("s1", "f1", 1000), scene("s2", null, 1000)];
    const tree = buildTree(folders, scenes);
    expect(tree.chapters[0].scenes.map((s) => s.id)).toEqual(["s1"]);
    expect(tree.shortPieces.map((s) => s.id)).toEqual(["s2"]);
  });

  it("returns empty chapters and shortPieces for an empty project", () => {
    const tree = buildTree([], []);
    expect(tree.chapters).toHaveLength(0);
    expect(tree.shortPieces).toHaveLength(0);
  });

  it("does not mutate the input arrays", () => {
    const folders = [folder("f2", 2000), folder("f1", 1000)];
    const foldersCopy = [...folders];
    buildTree(folders, []);
    expect(folders).toEqual(foldersCopy);
  });
});
