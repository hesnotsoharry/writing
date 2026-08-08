import { describe, expect, it } from "vitest";

import {
  MAX_BRIDGE_ID_LENGTH,
  type MobileEditorBridgeMessage,
  parseNativeMessage,
  parseWebViewMessage,
  serializeBridgeMessage,
} from "../../sync/mobileEditorBridgeProtocol";

const messages = {
  ready: { v: 1, type: "ready", sessionId: "session-a" },
  hydrate: {
    v: 1,
    type: "hydrate",
    sessionId: "session-a",
    sceneId: "scene-a",
    seq: 1,
    update: "AQID",
  },
  update: {
    v: 1,
    type: "update",
    sessionId: "session-a",
    sceneId: "scene-a",
    seq: 2,
    update: "BAU=",
  },
  replace: {
    v: 1,
    type: "replace",
    sessionId: "session-a",
    sceneId: "scene-a",
    seq: 3,
    update: "Bg==",
  },
  flush: { v: 1, type: "flush", sessionId: "session-a", sceneId: "scene-a", seq: 4 },
  ack: {
    v: 1,
    type: "ack",
    sessionId: "session-a",
    sceneId: "scene-a",
    seq: 5,
    ackType: "update",
  },
  error: {
    v: 1,
    type: "error",
    sessionId: "session-a",
    sceneId: "scene-a",
    seq: 6,
    code: "apply-failed",
    recoverable: true,
  },
} satisfies Record<string, MobileEditorBridgeMessage>;

const directionCases = [
  ["ready", messages.ready, true, false],
  ["hydrate", messages.hydrate, false, true],
  ["update", messages.update, true, true],
  ["replace", messages.replace, false, true],
  ["flush", messages.flush, false, true],
  ["ack", messages.ack, true, true],
  ["error", messages.error, true, true],
] as const;

describe("mobile editor bridge directions", () => {
  it.each(directionCases)("parses %s only in its allowed direction", (_, message, web, native) => {
    const raw = JSON.stringify(message);
    expect(parseWebViewMessage(raw) !== null).toBe(web);
    expect(parseNativeMessage(raw) !== null).toBe(native);
  });
});

describe("mobile editor bridge hostile input", () => {
  it.each(["", "{", "null", "[]", "true", "42", '"ready"'])(
    "rejects malformed or non-object JSON: %s",
    (raw) => {
      expect(parseWebViewMessage(raw)).toBeNull();
      expect(parseNativeMessage(raw)).toBeNull();
    },
  );

  it.each([
    { ...messages.ready, extra: true },
    { ...messages.update, extra: true },
    { ...messages.error, detail: "prose must not cross the bridge" },
  ])("rejects unknown keys", (message) => {
    expect(parseWebViewMessage(JSON.stringify(message))).toBeNull();
    expect(parseNativeMessage(JSON.stringify(message))).toBeNull();
  });

  it.each([
    { ...messages.ready, v: 2 },
    { ...messages.ready, type: 1 },
    { ...messages.ready, sessionId: 1 },
    { ...messages.update, sceneId: false },
    { ...messages.update, update: 7 },
    { ...messages.error, recoverable: "yes" },
  ])("rejects version and field type violations", (message) => {
    expect(parseWebViewMessage(JSON.stringify(message))).toBeNull();
    expect(parseNativeMessage(JSON.stringify(message))).toBeNull();
  });

  it.each(["", "   ", "x".repeat(MAX_BRIDGE_ID_LENGTH + 1)])(
    "rejects blank or oversized session IDs",
    (sessionId) => {
      const raw = JSON.stringify({ ...messages.ready, sessionId });
      expect(parseWebViewMessage(raw)).toBeNull();
    },
  );

  it.each(["", "\t", "x".repeat(MAX_BRIDGE_ID_LENGTH + 1)])(
    "rejects blank or oversized scene IDs",
    (sceneId) => {
      const raw = JSON.stringify({ ...messages.update, sceneId });
      expect(parseNativeMessage(raw)).toBeNull();
    },
  );

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1"])(
    "rejects invalid sequences: %s",
    (seq) => {
      const raw = JSON.stringify({ ...messages.update, seq });
      expect(parseWebViewMessage(raw)).toBeNull();
      expect(parseNativeMessage(raw)).toBeNull();
    },
  );

  it.each(["A", "A===", "AQ=", "AQID=", "AQ-ID", "AQ ID", "AQID\n"])(
    "rejects invalid standard base64: %s",
    (update) => {
      const raw = JSON.stringify({ ...messages.update, update });
      expect(parseWebViewMessage(raw)).toBeNull();
      expect(parseNativeMessage(raw)).toBeNull();
    },
  );

  it.each(["ready", "invalid", 1, null])("rejects invalid ACK types", (ackType) => {
    expect(parseNativeMessage(JSON.stringify({ ...messages.ack, ackType }))).toBeNull();
  });

  it.each(["unknown", "apply_failed", 1, null])("rejects invalid error codes", (code) => {
    expect(parseWebViewMessage(JSON.stringify({ ...messages.error, code }))).toBeNull();
  });

  it("validates optional error fields when present", () => {
    const withoutOptionals = {
      v: 1,
      type: "error",
      sessionId: "session-a",
      code: "invalid-message",
      recoverable: false,
    };
    expect(parseWebViewMessage(JSON.stringify(withoutOptionals))).toEqual(withoutOptionals);
    expect(parseNativeMessage(JSON.stringify({ ...withoutOptionals, seq: 0 }))).toBeNull();
    expect(parseNativeMessage(JSON.stringify({ ...withoutOptionals, sceneId: " " }))).toBeNull();
  });
});

describe("mobile editor bridge serialization", () => {
  it.each(directionCases)("round-trips %s without changing its wire value", (_, message, web, native) => {
    const raw = serializeBridgeMessage(message);
    const parsed = web ? parseWebViewMessage(raw) : parseNativeMessage(raw);
    expect(parsed).toEqual(message);
    expect(native || web).toBe(true);
  });

  it.each([
    [messages.ready, '{"v":1,"type":"ready","sessionId":"session-a"}'],
    [messages.hydrate, '{"v":1,"type":"hydrate","sessionId":"session-a","sceneId":"scene-a","seq":1,"update":"AQID"}'],
    [messages.update, '{"v":1,"type":"update","sessionId":"session-a","sceneId":"scene-a","seq":2,"update":"BAU="}'],
    [messages.replace, '{"v":1,"type":"replace","sessionId":"session-a","sceneId":"scene-a","seq":3,"update":"Bg=="}'],
    [messages.flush, '{"v":1,"type":"flush","sessionId":"session-a","sceneId":"scene-a","seq":4}'],
    [messages.ack, '{"v":1,"type":"ack","sessionId":"session-a","sceneId":"scene-a","seq":5,"ackType":"update"}'],
    [messages.error, '{"v":1,"type":"error","sessionId":"session-a","sceneId":"scene-a","seq":6,"code":"apply-failed","recoverable":true}'],
  ] as const)("pins the exact %s JSON field names", (message, expected) => {
    expect(serializeBridgeMessage(message)).toBe(expected);
  });
});
