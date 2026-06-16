// @vitest-environment jsdom
import type { Editor } from "@tiptap/react";
import { describe, expect, it, vi } from "vitest";

import type { MenuItemAction } from "../components/menu/ContextMenu";
import { buildEditorContextMenu } from "../editor/EditorContextMenu";

// ---------------------------------------------------------------------------
// Minimal chainable mock editor for buildEditorContextMenu tests.
// ---------------------------------------------------------------------------

function makeMockEditor(empty: boolean) {
  const run = vi.fn();
  const chain = {
    focus: vi.fn(() => chain),
    deleteSelection: vi.fn(() => chain),
    insertContent: vi.fn(() => chain),
    selectAll: vi.fn(() => chain),
    toggleBold: vi.fn(() => chain),
    toggleItalic: vi.fn(() => chain),
    toggleStrike: vi.fn(() => chain),
    toggleHighlight: vi.fn(() => chain),
    run,
  };
  // W52 Phase 2: buildEditorContextMenu now calls extractAiSafeSelection which
  // uses doc.nodesBetween (a ProseMirror Node method). Provide a mock that
  // invokes the callback with a plain text node carrying no aiExclude marks.
  const selText = empty ? "" : "selected text";
  const doc = {
    textBetween: vi.fn(() => selText),
    nodesBetween: vi.fn((_from: number, _to: number, cb: (node: unknown, pos: number) => boolean | void) => {
      if (!empty) cb({ isText: true, text: selText, marks: [] }, _from);
    }),
  };
  const state = {
    selection: { empty, from: 0, to: empty ? 0 : 13 },
    doc,
  };
  const editor = {
    chain: vi.fn(() => chain),
    state,
  } as unknown as Editor;
  return { editor, chain, run };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findItem(label: string, empty: boolean): MenuItemAction {
  const { editor } = makeMockEditor(empty);
  const descriptor = buildEditorContextMenu(editor, 0, 0);
  const item = descriptor.items.find(
    (i): i is MenuItemAction => "label" in i && i.label === label,
  );
  if (!item) throw new Error(`Item "${label}" not found`);
  return item;
}

// ---------------------------------------------------------------------------
// Highlight item — presence, disabled state, command wiring
// ---------------------------------------------------------------------------

describe("buildEditorContextMenu — Highlight item", () => {
  it("includes a Highlight item in the menu", () => {
    const { editor } = makeMockEditor(false);
    const descriptor = buildEditorContextMenu(editor, 0, 0);
    const labels = descriptor.items
      .filter((i): i is MenuItemAction => "label" in i)
      .map((i) => i.label);
    expect(labels).toContain("Highlight");
  });

  it("Highlight item is disabled when selection is empty", () => {
    const item = findItem("Highlight", true);
    expect(item.disabled).toBe(true);
  });

  it("Highlight item is not disabled when selection is non-empty", () => {
    const item = findItem("Highlight", false);
    expect(item.disabled).toBe(false);
  });

  it("Highlight item carries a swatch color", () => {
    const item = findItem("Highlight", false);
    expect(typeof item.swatch).toBe("string");
    expect(item.swatch!.length).toBeGreaterThan(0);
  });

  it("clicking Highlight calls toggleHighlight with the default color then run", () => {
    const { editor, chain, run } = makeMockEditor(false);
    const descriptor = buildEditorContextMenu(editor, 0, 0);
    const item = descriptor.items.find(
      (i): i is MenuItemAction => "label" in i && i.label === "Highlight",
    )!;
    item.onClick?.();
    expect(chain.toggleHighlight).toHaveBeenCalledWith({ color: "rgba(176,125,46,0.28)" });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
