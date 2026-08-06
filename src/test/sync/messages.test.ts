import { describe, expect, it } from "vitest";

import {
  boardChannel,
  isInnerMessage,
  parseChannel,
  sceneChannel,
} from "../../sync/messages";

describe("sync inner messages", () => {
  it("recognizes protocol message variants", () => {
    expect(isInnerMessage({
      t: "hello",
      device: "device-a",
      docs: [{ c: "scene:one", sv: "AQID", at: null }],
    })).toBe(true);
    expect(isInnerMessage({ t: "diff", c: "scene:one", u: "AQID" })).toBe(true);
    expect(isInnerMessage({ t: "live", c: "board:one", u: "AQID" })).toBe(true);
  });

  it("rejects malformed protocol messages", () => {
    expect(isInnerMessage({ t: "hello", device: "device-a", docs: [{}] })).toBe(false);
    expect(isInnerMessage({ t: "diff", c: "scene:one" })).toBe(false);
    expect(isInnerMessage(null)).toBe(false);
  });
});

describe("sync channels", () => {
  it("creates and parses scene and board channels", () => {
    expect(sceneChannel("scene-id")).toBe("scene:scene-id");
    expect(boardChannel("board-id")).toBe("board:board-id");
    expect(parseChannel("scene:scene-id")).toEqual({ kind: "scene", id: "scene-id" });
    expect(parseChannel("board:board-id")).toEqual({ kind: "board", id: "board-id" });
  });

  it("rejects unsupported or empty channels", () => {
    expect(parseChannel("meta:project-id")).toBeNull();
    expect(parseChannel("scene:")).toBeNull();
    expect(parseChannel("scene")).toBeNull();
  });
});
