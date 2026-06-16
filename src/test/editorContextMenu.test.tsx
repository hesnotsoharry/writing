// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContextMenu } from "../components/menu/ContextMenu";
import { buildEditorContextMenu } from "../editor/EditorContextMenu";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Mock editor helpers — matches the pattern in formatBubble.test.tsx
// ---------------------------------------------------------------------------

function makeChain() {
  const run = vi.fn();
  // Each method returns `chain` so calls can be chained: editor.chain().focus().run()
  const chain: Record<string, unknown> & { run: ReturnType<typeof vi.fn> } = { run };
  chain.focus = vi.fn(() => chain);
  chain.toggleBold = vi.fn(() => chain);
  chain.toggleItalic = vi.fn(() => chain);
  chain.toggleStrike = vi.fn(() => chain);
  chain.toggleHighlight = vi.fn(() => chain);
  chain.selectAll = vi.fn(() => chain);
  chain.deleteSelection = vi.fn(() => chain);
  chain.insertContent = vi.fn(() => chain);
  return { chain, run };
}

function makeEditorWithSelection(
  isEmpty: boolean,
  fromPos = 1,
  toPos = 5,
  textBetweenResult = "hello",
) {
  const { chain, run } = makeChain();
  // W52 Phase 2: buildEditorContextMenu now calls extractAiSafeSelection which
  // uses doc.nodesBetween (a ProseMirror Node method). The mock must provide it.
  // We invoke the callback once with a plain text node carrying no aiExclude marks
  // so the extraction returns the expected text string.
  const doc = {
    textBetween: vi.fn(() => textBetweenResult),
    nodesBetween: vi.fn((_from: number, _to: number, cb: (node: unknown, pos: number) => boolean | void) => {
      cb({ isText: true, text: textBetweenResult, marks: [] }, _from);
    }),
  };
  const editor = {
    chain: vi.fn(() => chain),
    state: {
      selection: {
        empty: isEmpty,
        from: fromPos,
        to: toPos,
      },
      doc,
    },
  } as unknown as Editor;
  return { editor, chain, run };
}

// ---------------------------------------------------------------------------
// buildEditorContextMenu — item structure
// ---------------------------------------------------------------------------

describe("buildEditorContextMenu — item labels", () => {
  it("returns Cut, Copy, Paste, Select All, sep, Bold, Italic, Strikethrough", () => {
    const { editor } = makeEditorWithSelection(false);
    const menu = buildEditorContextMenu(editor, 100, 200);
    const actions = menu.items.filter((it) => it.type !== "sep");
    const labels = actions.map((it) => ("label" in it ? it.label : ""));
    expect(labels).toEqual(["Cut", "Copy", "Paste", "Select All", "Bold", "Italic", "Strikethrough", "Highlight"]);
  });

  it("includes exactly one separator between clipboard and format groups", () => {
    const { editor } = makeEditorWithSelection(false);
    const menu = buildEditorContextMenu(editor, 0, 0);
    const seps = menu.items.filter((it) => it.type === "sep");
    expect(seps).toHaveLength(1);
    const sepIdx = menu.items.findIndex((it) => it.type === "sep");
    // separator is between Select All (index 3) and Bold (index 5)
    expect(sepIdx).toBe(4);
  });

  it("stores the requested pointer coordinates", () => {
    const { editor } = makeEditorWithSelection(false);
    const menu = buildEditorContextMenu(editor, 42, 87);
    expect(menu.x).toBe(42);
    expect(menu.y).toBe(87);
  });
});

// ---------------------------------------------------------------------------
// buildEditorContextMenu — Cut/Copy disabled state
// ---------------------------------------------------------------------------

describe("buildEditorContextMenu — Cut/Copy disabled when selection is empty", () => {
  it("Cut is disabled and Copy is disabled when selection is empty", () => {
    const { editor } = makeEditorWithSelection(true);
    const menu = buildEditorContextMenu(editor, 0, 0);
    const cut = menu.items.find((it) => "label" in it && it.label === "Cut");
    const copy = menu.items.find((it) => "label" in it && it.label === "Copy");
    expect("disabled" in cut! && cut.disabled).toBe(true);
    expect("disabled" in copy! && copy.disabled).toBe(true);
  });

  it("Cut is enabled and Copy is enabled when selection is non-empty", () => {
    const { editor } = makeEditorWithSelection(false);
    const menu = buildEditorContextMenu(editor, 0, 0);
    const cut = menu.items.find((it) => "label" in it && it.label === "Cut");
    const copy = menu.items.find((it) => "label" in it && it.label === "Copy");
    expect("disabled" in cut! && cut.disabled).toBeFalsy();
    expect("disabled" in copy! && copy.disabled).toBeFalsy();
  });

  it("Paste and Select All are always enabled regardless of selection", () => {
    const { editor } = makeEditorWithSelection(true);
    const menu = buildEditorContextMenu(editor, 0, 0);
    const paste = menu.items.find((it) => "label" in it && it.label === "Paste");
    const selectAll = menu.items.find((it) => "label" in it && it.label === "Select All");
    expect("disabled" in paste! && paste.disabled).toBeFalsy();
    expect("disabled" in selectAll! && selectAll.disabled).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// buildEditorContextMenu — Cut/Copy clipboard write on click
// ---------------------------------------------------------------------------

describe("buildEditorContextMenu — clipboard write on Cut/Copy", () => {
  it("Copy onClick calls navigator.clipboard.writeText with the selected text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText, readText: vi.fn().mockResolvedValue("") },
    });
    const { editor } = makeEditorWithSelection(false, 1, 6, "world");
    const menu = buildEditorContextMenu(editor, 0, 0);
    const copy = menu.items.find((it) => "label" in it && it.label === "Copy");
    expect("onClick" in copy! && typeof copy.onClick).toBe("function");
    if ("onClick" in copy! && copy.onClick) copy.onClick();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("world"));
  });
});

// ---------------------------------------------------------------------------
// ContextMenu — disabled prop renders a disabled button
// ---------------------------------------------------------------------------

describe("ContextMenu — disabled item renders as disabled button", () => {
  it("item with disabled:true renders a button with the disabled attribute", () => {
    const menu = {
      x: 0,
      y: 0,
      items: [
        { label: "Cut", disabled: true, onClick: vi.fn() },
        { label: "Copy", onClick: vi.fn() },
      ],
    };
    render(<ContextMenu menu={menu} onClose={vi.fn()} />);
    const cutBtn = screen.getByRole("button", { name: "Cut" });
    expect(cutBtn).toBeDisabled();
    const copyBtn = screen.getByRole("button", { name: "Copy" });
    expect(copyBtn).not.toBeDisabled();
  });
});
