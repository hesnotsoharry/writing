import { describe, expect, it } from "vitest";

import { SHORT_PIECES_TITLE } from "./binderTree";
import {
  buildFolderChoices,
  commitCreatePrompt,
  DEFAULT_CHAPTER_TITLE,
  DEFAULT_SCENE_TITLE,
  defaultTitleFor,
  resolveCreateTitle,
  resolveTargetFolderId,
} from "./createPromptModel";

describe("resolveCreateTitle", () => {
  it("keeps a typed name, trimmed", () => {
    expect(resolveCreateTitle("Opening", DEFAULT_SCENE_TITLE)).toBe("Opening");
    expect(resolveCreateTitle("  Opening  ", DEFAULT_SCENE_TITLE)).toBe("Opening");
  });

  it("falls back to the placeholder when the input is empty or whitespace", () => {
    expect(resolveCreateTitle("", DEFAULT_SCENE_TITLE)).toBe(DEFAULT_SCENE_TITLE);
    expect(resolveCreateTitle("   ", DEFAULT_SCENE_TITLE)).toBe(DEFAULT_SCENE_TITLE);
    expect(resolveCreateTitle("", DEFAULT_CHAPTER_TITLE)).toBe(DEFAULT_CHAPTER_TITLE);
  });

  it("keeps the placeholder when the user confirms it as-is", () => {
    expect(resolveCreateTitle(DEFAULT_SCENE_TITLE, DEFAULT_SCENE_TITLE)).toBe(DEFAULT_SCENE_TITLE);
  });

  it("never returns a blank title even if the fallback is blank", () => {
    expect(resolveCreateTitle("", "")).toBe(DEFAULT_SCENE_TITLE);
    expect(resolveCreateTitle("   ", "   ")).toBe(DEFAULT_SCENE_TITLE);
  });
});

describe("defaultTitleFor", () => {
  it("uses the live placeholder for each kind", () => {
    expect(defaultTitleFor("scene")).toBe(DEFAULT_SCENE_TITLE);
    expect(defaultTitleFor("chapter")).toBe(DEFAULT_CHAPTER_TITLE);
  });
});

describe("resolveTargetFolderId", () => {
  const known = ["ch1", "ch2"];

  it("uses the implied chapter when the user has not picked", () => {
    expect(resolveTargetFolderId({ impliedId: "ch2", knownIds: known })).toBe("ch2");
  });

  it("preselects Short pieces when the invocation implied the root bucket", () => {
    expect(resolveTargetFolderId({ impliedId: null, knownIds: known })).toBe(null);
  });

  it("lets the user's pick override the implied chapter, including Short pieces", () => {
    expect(resolveTargetFolderId({ impliedId: "ch1", pickedId: "ch2", knownIds: known })).toBe("ch2");
    expect(resolveTargetFolderId({ impliedId: "ch1", pickedId: null, knownIds: known })).toBe(null);
  });

  it("ignores a stale pick and falls back to the implied chapter", () => {
    expect(resolveTargetFolderId({ impliedId: "ch1", pickedId: "gone", knownIds: known })).toBe("ch1");
  });

  it("falls back to the first chapter when nothing is implied", () => {
    expect(resolveTargetFolderId({ knownIds: known })).toBe("ch1");
  });

  it("lands in Short pieces when there are no chapters", () => {
    expect(resolveTargetFolderId({ knownIds: [] })).toBe(null);
    expect(resolveTargetFolderId({ impliedId: "gone", knownIds: [] })).toBe(null);
  });

  it("ignores a stale implication and uses the first live chapter", () => {
    expect(resolveTargetFolderId({ impliedId: "gone", knownIds: known })).toBe("ch1");
  });
});

describe("buildFolderChoices", () => {
  it("lists chapters then the Short pieces bucket", () => {
    expect(buildFolderChoices([{ id: "ch1", title: "One" }, { id: "ch2", title: "Two" }])).toEqual([
      { id: "ch1", title: "One" },
      { id: "ch2", title: "Two" },
      { id: null, title: SHORT_PIECES_TITLE },
    ]);
  });

  it("still offers Short pieces when the project has no chapters", () => {
    expect(buildFolderChoices([])).toEqual([{ id: null, title: SHORT_PIECES_TITLE }]);
  });
});

describe("commitCreatePrompt", () => {
  it("resolves title and folder together from input plus invocation context", () => {
    expect(commitCreatePrompt({
      kind: "scene",
      titleInput: "  ",
      impliedFolderId: "ch1",
      knownIds: ["ch1", "ch2"],
    })).toEqual({ title: DEFAULT_SCENE_TITLE, folderId: "ch1" });
    expect(commitCreatePrompt({
      kind: "scene",
      titleInput: "  Night  ",
      impliedFolderId: "ch1",
      pickedFolderId: null,
      knownIds: ["ch1", "ch2"],
    })).toEqual({ title: "Night", folderId: null });
    expect(commitCreatePrompt({
      kind: "chapter",
      titleInput: "",
      knownIds: ["ch1"],
    })).toEqual({ title: DEFAULT_CHAPTER_TITLE, folderId: "ch1" });
  });
});
