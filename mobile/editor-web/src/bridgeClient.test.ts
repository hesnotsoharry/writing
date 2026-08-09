import {
  type AckMessage,
  MOBILE_EDITOR_BRIDGE_VERSION,
  type NativeToWebViewMessage,
  parseWebViewMessage,
  serializeBridgeMessage,
  type WebViewToNativeMessage,
} from "@writersnook/sync/mobileEditorBridgeProtocol";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import * as Y from "yjs";

import {
  EDITOR_UI_VERSION,   type EditorSelectionState,
parseWebEditorUiMessage, serializeEditorUiMessage,
} from "../../src/features/editor/editorUiProtocol";
import { type BridgeClient,createBridgeClient } from "./bridgeClient";

const SESSION_ID = "test-session";
const SCENE_ID = "scene-1";

function toBase64(update: Uint8Array): string {
  let binary = "";
  for (const byte of update) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fullState(text = ""): string {
  const doc = new Y.Doc();
  if (text) doc.getText("test").insert(0, text);
  return toBase64(Y.encodeStateAsUpdate(doc));
}

function hydrate(seq = 1, text = ""): NativeToWebViewMessage {
  return {
    v: MOBILE_EDITOR_BRIDGE_VERSION,
    type: "hydrate",
    sessionId: SESSION_ID,
    sceneId: SCENE_ID,
    seq,
    update: fullState(text),
  };
}

function ackUpdate(seq: number): AckMessage {
  return {
    v: MOBILE_EDITOR_BRIDGE_VERSION,
    type: "ack",
    sessionId: SESSION_ID,
    sceneId: SCENE_ID,
    seq,
    ackType: "update",
  };
}

function parsedMessages(post: Mock<(message: string) => void>): WebViewToNativeMessage[] {
  return post.mock.calls.flatMap(([raw]) => {
    const parsed = typeof raw === "string" ? parseWebViewMessage(raw) : null;
    return parsed ? [parsed] : [];
  });
}

describe("createBridgeClient", () => {
  let client: BridgeClient;
  let post: Mock<(message: string) => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    post = vi.fn<(message: string) => void>();
    client = createBridgeClient({ sessionId: SESSION_ID, postMessage: post });
  });

  afterEach(() => {
    client.destroy();
    vi.useRealTimers();
  });

  it("announces ready and hydrates the document before notifying its mount subscriber", () => {
    expect(parsedMessages(post)[0]).toEqual({
      v: MOBILE_EDITOR_BRIDGE_VERSION,
      type: "ready",
      sessionId: SESSION_ID,
    });
    let observedText = "not-called";
    client.subscribe(() => {
      const snapshot = client.getSnapshot();
      observedText = snapshot.hydrated ? snapshot.doc.getText("test").toString() : "not-hydrated";
    });

    client.receive(serializeBridgeMessage(hydrate(1, "hydrated")));

    expect(observedText).toBe("hydrated");
    const messages = parsedMessages(post);
    expect(messages[messages.length - 1]).toMatchObject({ type: "ack", ackType: "hydrate" });
  });

  it("retains the initial theme when it arrives before the editor UI binds", () => {
    client.receive(serializeBridgeMessage(hydrate()));
    post.mockClear();
    const theme = {
      v: EDITOR_UI_VERSION, type: "editor-theme" as const, sessionId: SESSION_ID,
      sceneId: SCENE_ID, seq: 1, colors: { theme: "dark", character: "#cf7853" },
    };

    client.receive(serializeEditorUiMessage(theme));

    expect(parseWebEditorUiMessage(post.mock.calls[0][0] as string))
      .toMatchObject({ type: "editor-ui-ack", ackType: "theme", seq: 1 });
    const handler = vi.fn();
    client.bindEditorUi(handler);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(theme);
  });

  it("merges a 500 ms batch and holds the next batch behind one in-flight update", () => {
    client.receive(serializeBridgeMessage(hydrate()));
    post.mockClear();
    const text = client.getSnapshot().doc.getText("local");
    text.insert(0, "a");
    text.insert(1, "b");

    vi.advanceTimersByTime(499);
    expect(parsedMessages(post)).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(parsedMessages(post)).toHaveLength(1);

    text.insert(2, "c");
    vi.advanceTimersByTime(500);
    expect(parsedMessages(post)).toHaveLength(1);
    client.receive(serializeBridgeMessage(ackUpdate(1)));
    expect(parsedMessages(post)).toHaveLength(2);
    expect(parsedMessages(post)[1]).toMatchObject({ type: "update", seq: 2 });
  });

  it("applies remote updates with echo suppression", () => {
    client.receive(serializeBridgeMessage(hydrate()));
    post.mockClear();
    const remote = new Y.Doc();
    remote.getText("remote").insert(0, "server");
    const message: NativeToWebViewMessage = {
      v: MOBILE_EDITOR_BRIDGE_VERSION,
      type: "update",
      sessionId: SESSION_ID,
      sceneId: SCENE_ID,
      seq: 2,
      update: toBase64(Y.encodeStateAsUpdate(remote)),
    };

    client.receive(serializeBridgeMessage(message));
    vi.advanceTimersByTime(500);

    expect(client.getSnapshot().doc.getText("remote").toString()).toBe("server");
    expect(parsedMessages(post)).toEqual([expect.objectContaining({ type: "ack", ackType: "update" })]);
  });

  it("drains local work before acknowledging flush", () => {
    client.receive(serializeBridgeMessage(hydrate()));
    post.mockClear();
    client.getSnapshot().doc.getText("local").insert(0, "last batch");
    const flush: NativeToWebViewMessage = {
      v: MOBILE_EDITOR_BRIDGE_VERSION,
      type: "flush",
      sessionId: SESSION_ID,
      sceneId: SCENE_ID,
      seq: 2,
    };

    client.receive(serializeBridgeMessage(flush));
    expect(parsedMessages(post).map((message) => message.type)).toEqual(["update"]);
    client.receive(serializeBridgeMessage(ackUpdate(1)));
    const messages = parsedMessages(post);
    expect(messages[messages.length - 1]).toMatchObject({ type: "ack", ackType: "flush", seq: 2 });
  });

  it("replaces with a fresh document and increments the editor remount key", () => {
    client.receive(serializeBridgeMessage(hydrate(1, "old")));
    const before = client.getSnapshot();
    const replace: NativeToWebViewMessage = {
      v: MOBILE_EDITOR_BRIDGE_VERSION,
      type: "replace",
      sessionId: SESSION_ID,
      sceneId: SCENE_ID,
      seq: 2,
      update: fullState("new"),
    };

    client.receive(serializeBridgeMessage(replace));
    const after = client.getSnapshot();

    expect(after.doc).not.toBe(before.doc);
    expect(after.editorKey).toBe(before.editorKey + 1);
    expect(after.doc.getText("test").toString()).toBe("new");
  });

  it("keeps selection reports behind one in-flight UI ACK", () => {
    client.receive(serializeBridgeMessage(hydrate()));
    post.mockClear();
    const selection: EditorSelectionState = {
      bold: false, italic: false, blockquote: false, aiExcluded: false,
      collapsed: false, from: 1, to: 2, aiSafeText: "a", rect: null,
    };
    client.reportSelection(selection);
    client.reportSelection({ ...selection, bold: true });
    expect(post).toHaveBeenCalledTimes(1);
    const first = parseWebEditorUiMessage(post.mock.calls[0][0] as string);
    expect(first).toMatchObject({ type: "selection-state", seq: 1, bold: false });

    client.receive(serializeEditorUiMessage({
      v: EDITOR_UI_VERSION, type: "editor-ui-ack", sessionId: SESSION_ID,
      sceneId: SCENE_ID, seq: 1, ackType: "selection",
    }));
    expect(post).toHaveBeenCalledTimes(2);
    expect(parseWebEditorUiMessage(post.mock.calls[1][0] as string))
      .toMatchObject({ type: "selection-state", seq: 2, bold: true });
  });

  it("queues a linked-entity tap behind selection and releases it after the ACK", () => {
    client.receive(serializeBridgeMessage(hydrate()));
    post.mockClear();
    const selection: EditorSelectionState = {
      bold: false, italic: false, blockquote: false, aiExcluded: false,
      collapsed: false, from: 1, to: 2, aiSafeText: "a", rect: null,
    };
    client.reportSelection(selection);
    client.reportAutoLinkTap({
      entityId: "entity-1", entityType: "character",
      rect: { x: 10, y: 20, width: 30, height: 12 },
    });
    expect(post).toHaveBeenCalledOnce();
    client.receive(serializeEditorUiMessage({
      v: EDITOR_UI_VERSION, type: "editor-ui-ack", sessionId: SESSION_ID,
      sceneId: SCENE_ID, seq: 1, ackType: "selection",
    }));
    expect(parseWebEditorUiMessage(post.mock.calls[1][0] as string)).toMatchObject({
      type: "auto-link-tap", seq: 2, entityId: "entity-1", entityType: "character",
      rect: { x: 10, y: 20, width: 30, height: 12 },
    });
  });

  it("ACKs ordered UI commands and rejects gaps and wrong sessions", () => {
    client.receive(serializeBridgeMessage(hydrate()));
    post.mockClear();
    const handler = vi.fn();
    client.bindEditorUi(handler);
    const command = {
      v: EDITOR_UI_VERSION, type: "editor-command" as const, sessionId: SESSION_ID,
      sceneId: SCENE_ID, seq: 1, command: "toggle-bold" as const,
    };
    client.receive(serializeEditorUiMessage({ ...command, seq: 2 }));
    client.receive(serializeEditorUiMessage({ ...command, sessionId: "stale" }));
    expect(handler).not.toHaveBeenCalled();
    client.receive(serializeEditorUiMessage(command));
    expect(handler).toHaveBeenCalledOnce();
    expect(parseWebEditorUiMessage(post.mock.calls[0][0] as string))
      .toMatchObject({ type: "editor-ui-ack", ackType: "command", seq: 1 });
    client.receive(serializeEditorUiMessage(command));
    expect(handler).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledTimes(2);
  });
});
