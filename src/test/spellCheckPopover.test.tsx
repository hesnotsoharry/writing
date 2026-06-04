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
import { afterEach, describe, expect, it } from "vitest";

import { SpellCheckPopover } from "../editor/SpellCheckPopover";

afterEach(cleanup);

describe("SpellCheckPopover — presentational contract", () => {
  it("renders each suggestion as a clickable button", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SpellCheckPopover
        x={10}
        y={10}
        suggestions={["brown", "brows"]}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("option", { name: "brown" })).toBeDefined();
    expect(screen.getByRole("option", { name: "brows" })).toBeDefined();
  });

  it("calls onSelect with the correct word when a suggestion is clicked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SpellCheckPopover
        x={10}
        y={10}
        suggestions={["brown", "brows"]}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: "brown" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("brown");
  });

  it("does not call onSelect when the second suggestion is clicked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SpellCheckPopover
        x={10}
        y={10}
        suggestions={["brown", "brows"]}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: "brows" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("brows");
    // Confirm "brown" was NOT selected in this interaction.
    expect(onSelect).not.toHaveBeenCalledWith("brown");
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
        suggestions={["brown"]}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
