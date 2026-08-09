import { describe, expect, it, vi } from "vitest";

import {
  EDITOR_UI_VERSION,   type EditorSelectionMessage,
parseNativeEditorUiMessage, serializeEditorUiMessage,
} from "./editorUiProtocol";
import { NativeEditorUiController } from "./nativeEditorUi";

const selection: EditorSelectionMessage = {
  v: EDITOR_UI_VERSION, type: "selection-state", sessionId: "session", sceneId: "scene",
  seq: 1, bold: false, italic: false, blockquote: false, aiExcluded: false,
  collapsed: false, from: 1, to: 2, aiSafeText: "a", rect: null,
};

describe("NativeEditorUiController", () => {
  it("queues the latest focus state behind theme using one-in-flight ACKs", () => {
    const messages: string[] = [];
    const controller = new NativeEditorUiController("scene", { postMessage: (raw) => messages.push(raw) }, vi.fn());
    controller.focus({ enabled: true, dimParagraphs: true, typewriter: false, activeParagraph: 8 });
    controller.start("session", { theme: "dark" });
    expect(messages).toHaveLength(1);
    controller.receive(serializeEditorUiMessage({ v: EDITOR_UI_VERSION, type: "editor-ui-ack",
      sessionId: "session", sceneId: "scene", seq: 1, ackType: "theme" }));
    expect(parseNativeEditorUiMessage(messages[1])).toMatchObject({
      type: "editor-focus", seq: 2, enabled: true, activeParagraph: 8,
    });
  });

  it("keeps commands behind one in-flight ACK", () => {
    const messages: string[] = [];
    const controller = new NativeEditorUiController("scene", { postMessage: (raw) => messages.push(raw) }, vi.fn());
    controller.start("session", { theme: "light" });
    controller.command("toggle-bold");
    expect(messages).toHaveLength(1);
    controller.receive(serializeEditorUiMessage({
      v: EDITOR_UI_VERSION, type: "editor-ui-ack", sessionId: "session",
      sceneId: "scene", seq: 1, ackType: "theme",
    }));
    expect(messages).toHaveLength(2);
    expect(parseNativeEditorUiMessage(messages[1])).toMatchObject({
      type: "editor-command", command: "toggle-bold", seq: 2,
    });
  });

  it("accepts one ordered selection, re-ACKs replay, and rejects gaps and wrong sessions", () => {
    const messages: string[] = [];
    const onSelection = vi.fn();
    const controller = new NativeEditorUiController(
      "scene", { postMessage: (raw) => messages.push(raw) }, onSelection,
    );
    controller.start("session", {});
    messages.length = 0;
    controller.receive(serializeEditorUiMessage({ ...selection, seq: 2 }));
    controller.receive(serializeEditorUiMessage({ ...selection, sessionId: "stale" }));
    expect(onSelection).not.toHaveBeenCalled();
    controller.receive(serializeEditorUiMessage(selection));
    controller.receive(serializeEditorUiMessage(selection));
    expect(onSelection).toHaveBeenCalledOnce();
    expect(messages).toHaveLength(2);
  });
});
