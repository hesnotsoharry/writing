import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import AiExcludeExtension from "@writersnook/editor/extensions/AiExcludeExtension";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import {
  EDITOR_UI_VERSION, type EditorCommandName, type NativeEditorUiMessage,
} from "../../src/features/editor/editorUiProtocol";
import type { BridgeClient } from "./bridgeClient";
import { attachEditorUi } from "./editorUiBridge";

const editors: Editor[] = [];

function createEditor(): Editor {
  const editor = new Editor({
    content: "<p>hello world</p>",
    extensions: [StarterKit, AiExcludeExtension],
  });
  editors.push(editor);
  return editor;
}

function createClient(): {
  client: BridgeClient;
  command: (name: EditorCommandName) => void;
} {
  let handler: ((message: NativeEditorUiMessage) => void) | null = null;
  const doc = new Y.Doc();
  const client: BridgeClient = {
    getSnapshot: () => ({ doc, editorKey: 0, hydrated: true }),
    getSessionId: () => "session",
    subscribe: () => () => undefined,
    bindEditorUi: (next) => { handler = next; return () => { handler = null; }; },
    reportSelection: vi.fn(),
    reportAutoLinkTap: vi.fn(),
    receive: vi.fn(),
    destroy: () => doc.destroy(),
  };
  return { client, command: (name) => {
    handler?.({
      v: EDITOR_UI_VERSION, type: "editor-command", sessionId: "session",
      sceneId: "scene", seq: 1, command: name,
    });
  } };
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

describe("attachEditorUi selection commands", () => {
  it("applies a mark to the live selection", () => {
    const editor = createEditor();
    const { client, command } = createClient();
    const detach = attachEditorUi(editor, client);
    editor.commands.setTextSelection({ from: 1, to: 6 });

    command("toggle-bold");

    expect(editor.state.doc.rangeHasMark(1, 6, editor.schema.marks.bold)).toBe(true);
    detach();
  });

  it("restores the remembered selection after collapse before applying a mark", () => {
    const editor = createEditor();
    const { client, command } = createClient();
    const detach = attachEditorUi(editor, client);
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.commands.setTextSelection(6);

    command("toggle-ai-exclude");

    expect(editor.state.doc.rangeHasMark(1, 6, editor.schema.marks.aiExclude)).toBe(true);
    detach();
  });

  it("does not apply a remembered range after the document changes", () => {
    const editor = createEditor();
    const { client, command } = createClient();
    const detach = attachEditorUi(editor, client);
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.commands.setTextSelection(6);
    editor.commands.setContent("<p>hi</p>");

    command("toggle-bold");

    expect(editor.getHTML()).toBe("<p>hi</p>");
    expect(editor.state.doc.rangeHasMark(1, 3, editor.schema.marks.bold)).toBe(false);
    detach();
  });
});
