// @vitest-environment jsdom

// Mock the ProseMirror extension and dictionary before importing the component.
// Both pull in Vite ?url asset imports that are unavailable in the Vitest / Node
// environment.  The presentational component under test does not use either at
// runtime; the mocks exist solely to satisfy the module graph.
import { vi } from "vitest";

vi.mock("../editor/extensions/ProofreadExtension", () => ({
  proofreadKey: { getState: vi.fn() },
}));
vi.mock("../lib/dictionary", () => ({
  getSpeller: vi.fn(),
}));

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { EditorView } from "@tiptap/pm/view";
import { afterEach, describe, expect, it } from "vitest";

import { SpellCheckPopover } from "../editor/SpellCheckPopover";
import { applySuggestion } from "../editor/SpellCheckPopover";
import type { GrammarSuggestion } from "../lib/ipc";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Presentational contract — SpellCheckPopover
// ---------------------------------------------------------------------------

describe("SpellCheckPopover — presentational contract (GrammarSuggestion[])", () => {
  const replaceSuggestions: GrammarSuggestion[] = [
    { kind: "replace", text: "brown" },
    { kind: "replace", text: "brows" },
  ];

  it("renders each suggestion as a clickable button using suggestion text", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SpellCheckPopover
        x={10}
        y={10}
        suggestions={replaceSuggestions}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("option", { name: "brown" })).toBeDefined();
    expect(screen.getByRole("option", { name: "brows" })).toBeDefined();
  });

  it("renders with canon .cm container class and .cm-item button class", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <SpellCheckPopover
        x={10}
        y={10}
        suggestions={replaceSuggestions}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    // Container must carry the canon context-menu class so it renders identically
    // to every other app context menu (border, shadow, border-radius from .cm).
    expect(container.querySelector(".cm")).not.toBeNull();
    // Each suggestion button must carry .cm-item for canon item styling.
    const items = container.querySelectorAll(".cm-item");
    expect(items.length).toBe(replaceSuggestions.length);
  });

  it("calls onSelect with the full GrammarSuggestion object when a suggestion is clicked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SpellCheckPopover
        x={10}
        y={10}
        suggestions={replaceSuggestions}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: "brown" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ kind: "replace", text: "brown" });
  });

  it("does not call onSelect for 'brown' when 'brows' is clicked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SpellCheckPopover
        x={10}
        y={10}
        suggestions={replaceSuggestions}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: "brows" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ kind: "replace", text: "brows" });
    expect(onSelect).not.toHaveBeenCalledWith({ kind: "replace", text: "brown" });
  });

  it("renders 'Delete' label for a remove-kind suggestion", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    const suggestions: GrammarSuggestion[] = [
      { kind: "replace", text: "brown" },
      { kind: "remove", text: "" },
    ];

    render(
      <SpellCheckPopover
        x={10}
        y={10}
        suggestions={suggestions}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    // replace suggestion renders its text; remove suggestion renders "Delete".
    expect(screen.getByRole("option", { name: "brown" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Delete" })).toBeDefined();
  });

  it("calls onSelect with the remove GrammarSuggestion when 'Delete' is clicked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    const removeSuggestion: GrammarSuggestion = { kind: "remove", text: "" };

    render(
      <SpellCheckPopover
        x={10}
        y={10}
        suggestions={[{ kind: "replace", text: "brown" }, removeSuggestion]}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: "Delete" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(removeSuggestion);
  });

  it("renders a disabled 'No suggestions' item when suggestions array is empty", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SpellCheckPopover
        x={10}
        y={10}
        suggestions={[]}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    const noSuggestionsBtn = screen.getByText("No suggestions");
    expect(noSuggestionsBtn).toBeDefined();
    // Clicking it must not invoke onSelect.
    fireEvent.click(noSuggestionsBtn);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onClose when Escape is pressed", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SpellCheckPopover
        x={10}
        y={10}
        suggestions={[{ kind: "replace", text: "brown" }]}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// applySuggestion — per-kind transaction dispatch (Decision F)
// ---------------------------------------------------------------------------

describe("applySuggestion — dispatches correct ProseMirror transaction per kind", () => {
  function makeFakeView() {
    const dispatchedTrs: unknown[] = [];
    // Each tr method returns itself so dispatch can receive it.
    const tr = {
      replaceWith: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      insertText: vi.fn().mockReturnThis(),
    };
    const view = {
      state: {
        tr,
        schema: { text: vi.fn((s: string) => ({ _text: s })) },
      },
      dispatch: vi.fn((t: unknown) => { dispatchedTrs.push(t); }),
    };
    // applySuggestion takes a real EditorView; the fake is structurally sufficient
    // for the methods it touches (state.tr, state.schema.text, dispatch).
    return { view: view as unknown as EditorView, tr, dispatchedTrs };
  }

  it("calls tr.replaceWith for a 'replace' suggestion", () => {
    const { view, tr } = makeFakeView();
    applySuggestion(view, 5, 8, { kind: "replace", text: "goes" });
    expect(tr.replaceWith).toHaveBeenCalledWith(5, 8, expect.anything());
    expect(view.dispatch).toHaveBeenCalledTimes(1);
  });

  it("calls tr.delete for a 'remove' suggestion", () => {
    const { view, tr } = makeFakeView();
    applySuggestion(view, 5, 8, { kind: "remove", text: "" });
    expect(tr.delete).toHaveBeenCalledWith(5, 8);
    expect(view.dispatch).toHaveBeenCalledTimes(1);
  });

  it("calls tr.insertText for an 'insert_after' suggestion", () => {
    const { view, tr } = makeFakeView();
    applySuggestion(view, 5, 8, { kind: "insert_after", text: " indeed" });
    expect(tr.insertText).toHaveBeenCalledWith(" indeed", 8);
    expect(view.dispatch).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch when 'replace' text is empty (schema.text guard)", () => {
    const { view } = makeFakeView();
    applySuggestion(view, 5, 8, { kind: "replace", text: "" });
    expect(view.dispatch).not.toHaveBeenCalled();
  });

  it("does not dispatch when 'insert_after' text is empty", () => {
    const { view } = makeFakeView();
    applySuggestion(view, 5, 8, { kind: "insert_after", text: "" });
    expect(view.dispatch).not.toHaveBeenCalled();
  });
});
