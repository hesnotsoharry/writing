// @vitest-environment jsdom

import { render } from "@testing-library/react";
import type { EditorOptions } from "@tiptap/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

const useEditorMock = vi.hoisted(() => vi.fn());

vi.mock("@tiptap/react", () => ({
  EditorContent: () => <div data-testid="editor-content" />,
  useEditor: useEditorMock,
}));

import { MobileEditorCore } from "../../editor/MobileEditorCore";

function capturedOptions(): EditorOptions {
  const options: unknown = useEditorMock.mock.calls[0]?.[0];
  if (!options || typeof options !== "object") throw new Error("useEditor was not called");
  return options as EditorOptions;
}

describe("MobileEditorCore", () => {
  beforeEach(() => useEditorMock.mockReset().mockReturnValue(null));

  it("pins the mobile collaboration schema without a content option", () => {
    const doc = new Y.Doc();
    render(<MobileEditorCore doc={doc} editable />);

    const options = capturedOptions();
    const names = options.extensions.map((extension) => extension.name);
    expect(names).toEqual([
      "starterKit",
      "collaboration",
      "highlight",
      "placeholder",
      "aiExclude",
      "dropCapGate",
    ]);
    expect(options).not.toHaveProperty("content");
    expect(options.editable).toBe(true);
    expect(options.extensions[0].options.undoRedo).toBe(false);
    expect(options.extensions[1].options).toMatchObject({ document: doc, field: "content" });
  });

  it("guards optional lifecycle callbacks", () => {
    const doc = new Y.Doc();
    expect(() => render(<MobileEditorCore doc={doc} editable={false} />)).not.toThrow();
    const options = capturedOptions();
    expect(() => options.onDestroy?.()).not.toThrow();
  });
});
