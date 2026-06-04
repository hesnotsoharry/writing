// @vitest-environment jsdom

// BubbleMenu requires @floating-ui/dom (a transitive dep not installed in this
// worktree) and a live ProseMirror selection to render its children.
// Mock it so FormatButtons — which holds all command wiring — is testable
// in isolation.  This pattern mirrors spellCheckPopover.test.tsx.
import { vi } from "vitest";

vi.mock("@tiptap/react/menus", () => ({
  BubbleMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it } from "vitest";

import { FormatButtons } from "../editor/FormatBubble";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// chainable mock editor
// ---------------------------------------------------------------------------

function makeMockEditor(isActiveFn?: (...args: unknown[]) => boolean) {
  const run = vi.fn();
  const chain = {
    focus: vi.fn(() => chain),
    toggleBold: vi.fn(() => chain),
    toggleItalic: vi.fn(() => chain),
    toggleHeading: vi.fn(() => chain),
    toggleBlockquote: vi.fn(() => chain),
    toggleBulletList: vi.fn(() => chain),
    run,
  };
  const editor = {
    chain: vi.fn(() => chain),
    isActive: vi.fn(isActiveFn ?? (() => false)),
  } as unknown as Editor;
  return { editor, chain, run };
}

// ---------------------------------------------------------------------------
// Command wiring: clicking each button calls the right chain method then run()
// ---------------------------------------------------------------------------

describe("FormatButtons — command wiring", () => {
  it("clicking Bold calls toggleBold then run", () => {
    const { editor, chain, run } = makeMockEditor();
    render(<FormatButtons editor={editor} />);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(chain.toggleBold).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("clicking Italic calls toggleItalic then run", () => {
    const { editor, chain, run } = makeMockEditor();
    render(<FormatButtons editor={editor} />);
    fireEvent.click(screen.getByRole("button", { name: "Italic" }));
    expect(chain.toggleItalic).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("clicking Heading calls toggleHeading({ level: 2 }) then run", () => {
    const { editor, chain, run } = makeMockEditor();
    render(<FormatButtons editor={editor} />);
    fireEvent.click(screen.getByRole("button", { name: "Heading" }));
    expect(chain.toggleHeading).toHaveBeenCalledWith({ level: 2 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("clicking Quote calls toggleBlockquote then run", () => {
    const { editor, chain, run } = makeMockEditor();
    render(<FormatButtons editor={editor} />);
    fireEvent.click(screen.getByRole("button", { name: "Quote" }));
    expect(chain.toggleBlockquote).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("clicking List calls toggleBulletList then run", () => {
    const { editor, chain, run } = makeMockEditor();
    render(<FormatButtons editor={editor} />);
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(chain.toggleBulletList).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Active state: isActive is consulted for each button
// ---------------------------------------------------------------------------

describe("FormatButtons — active-state consultation", () => {
  it("consults isActive for bold, italic, heading, blockquote, bulletList", () => {
    const { editor } = makeMockEditor();
    render(<FormatButtons editor={editor} />);
    expect(editor.isActive).toHaveBeenCalledWith("bold");
    expect(editor.isActive).toHaveBeenCalledWith("italic");
    expect(editor.isActive).toHaveBeenCalledWith("heading", { level: 2 });
    expect(editor.isActive).toHaveBeenCalledWith("blockquote");
    expect(editor.isActive).toHaveBeenCalledWith("bulletList");
  });

  it("Bold button aria-pressed is true when isActive('bold') returns true", () => {
    const { editor } = makeMockEditor((...args) => args[0] === "bold");
    render(<FormatButtons editor={editor} />);
    const boldBtn = screen.getByRole("button", { name: "Bold" });
    expect(boldBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("Bold button aria-pressed is false when isActive returns false", () => {
    const { editor } = makeMockEditor(() => false);
    render(<FormatButtons editor={editor} />);
    const boldBtn = screen.getByRole("button", { name: "Bold" });
    expect(boldBtn.getAttribute("aria-pressed")).toBe("false");
  });
});

// ---------------------------------------------------------------------------
// Structure: all 5 buttons and the separator are rendered
// ---------------------------------------------------------------------------

describe("FormatButtons — rendered structure", () => {
  it("renders exactly 5 buttons: Bold, Italic, Heading, Quote, List", () => {
    const { editor } = makeMockEditor();
    render(<FormatButtons editor={editor} />);
    expect(screen.getByRole("button", { name: "Bold" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Italic" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Heading" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Quote" })).toBeDefined();
    expect(screen.getByRole("button", { name: "List" })).toBeDefined();
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });
});
