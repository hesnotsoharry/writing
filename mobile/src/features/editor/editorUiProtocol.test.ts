import { describe, expect, it } from "vitest";

import {
  classifyUiSequence, EDITOR_UI_VERSION,   type EditorSelectionMessage, type EditorUiCommand,
MAX_EDITOR_UI_BYTES,
  parseNativeEditorUiMessage, parseWebEditorUiMessage, serializeEditorUiMessage,
} from "./editorUiProtocol";

const command: EditorUiCommand = {
  v: EDITOR_UI_VERSION, type: "editor-command", sessionId: "session", sceneId: "scene",
  seq: 1, command: "toggle-bold",
};
const selection: EditorSelectionMessage = {
  v: EDITOR_UI_VERSION, type: "selection-state", sessionId: "session", sceneId: "scene",
  seq: 1, bold: true, italic: false, blockquote: true, aiExcluded: false,
  collapsed: false, from: 1, to: 4, aiSafeText: "safe", rect: { x: 1, y: 2, width: 3, height: 4 },
};

describe("editor UI protocol hostile-input oracle", () => {
  it("accepts valid direction-specific messages and rejects the opposite direction", () => {
    expect(parseNativeEditorUiMessage(serializeEditorUiMessage(command))).toEqual(command);
    expect(parseWebEditorUiMessage(serializeEditorUiMessage(selection))).toEqual(selection);
    expect(parseWebEditorUiMessage(serializeEditorUiMessage(command))).toBeNull();
    expect(parseNativeEditorUiMessage(serializeEditorUiMessage(selection))).toBeNull();
  });

  it.each([
    "{", JSON.stringify({ ...command, v: 2 }), JSON.stringify({ ...command, seq: 0 }),
    JSON.stringify({ ...command, sessionId: "" }), JSON.stringify({ ...command, extra: true }),
    JSON.stringify({ ...command, command: "unknown" }),
    JSON.stringify({ ...command, command: "link-entity" }),
    JSON.stringify({ ...selection, aiSafeText: "x".repeat(16_001) }),
    JSON.stringify({ ...selection, rect: { x: 0, y: 0, width: "bad", height: 1 } }),
  ])("rejects malformed input %#", (raw) => {
    expect(parseNativeEditorUiMessage(raw)).toBeNull();
    expect(parseWebEditorUiMessage(raw)).toBeNull();
  });

  it("rejects oversized envelopes", () => {
    expect(parseNativeEditorUiMessage(" ".repeat(MAX_EDITOR_UI_BYTES + 1))).toBeNull();
  });

  it("classifies accepted, replayed, out-of-order, and wrong-session messages", () => {
    const expected = { sessionId: "session", sceneId: "scene", seq: 2 };
    expect(classifyUiSequence({ ...expected, seq: 2 }, expected)).toBe("accept");
    expect(classifyUiSequence({ ...expected, seq: 1 }, expected)).toBe("replay");
    expect(classifyUiSequence({ ...expected, seq: 3 }, expected)).toBe("gap");
    expect(classifyUiSequence({ ...expected, sessionId: "stale" }, expected)).toBe("mismatch");
  });
});
