import { describe, expect, it } from "vitest";

import {
  bibleChannel,
  boardChannel,
  isInnerMessage,
  metaChannel,
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
    expect(isInnerMessage({
      t: "row-hello", domain: "notes", project: "p1", rows: [], more: false,
    })).toBe(true);
    expect(isInnerMessage({
      t: "row-hello", domain: "notes", project: "p1", rows: [], more: false,
      sender: "device-b",
    })).toBe(true);
    expect(isInnerMessage({ t: "row", id: "notes:n1", domain: "notes", project: "p1",
      row: "n1", hlc: "000000000001000-000000", device: "a", deleted: false,
      payload: "{}" })).toBe(true);
    expect(isInnerMessage({ t: "row-ack", id: "notes:n1", domain: "notes", row: "n1",
      hlc: "000000000001000-000000", device: "a" })).toBe(true);
    expect(isInnerMessage({ t: "credential-offer", id: "offer-1", managed: {
      aiLicenseKey: "managed-only", aiModel: "model", aiEnabled: true,
    } })).toBe(true);
    expect(isInnerMessage({ t: "credential-ack", id: "offer-1", accepted: true })).toBe(true);
  });

  it("rejects malformed protocol messages", () => {
    expect(isInnerMessage({ t: "hello", device: "device-a", docs: [{}] })).toBe(false);
    expect(isInnerMessage({ t: "diff", c: "scene:one" })).toBe(false);
    expect(isInnerMessage(null)).toBe(false);
    expect(isInnerMessage({ t: "credential-offer", id: "bad", managed: {
      aiLicenseKey: "license", aiTrialKey: "trial", aiModel: "model", aiEnabled: true,
    } })).toBe(false);
    expect(isInnerMessage({ t: "credential-offer", id: "bad", managed: {
      aiLicenseKey: "license", aiModel: "model", aiEnabled: true, byokApiKey: "secret",
    } })).toBe(false);
  });
});

describe("sync channels", () => {
  it("creates and parses scene and board channels", () => {
    expect(sceneChannel("scene-id")).toBe("scene:scene-id");
    expect(boardChannel("board-id")).toBe("board:board-id");
    expect(metaChannel("project-id")).toBe("meta:project-id");
    expect(bibleChannel("project-id")).toBe("bible:project-id");
    expect(parseChannel("scene:scene-id")).toEqual({ kind: "scene", id: "scene-id" });
    expect(parseChannel("board:board-id")).toEqual({ kind: "board", id: "board-id" });
    expect(parseChannel("meta:project-id")).toEqual({ kind: "meta", id: "project-id" });
    expect(parseChannel("bible:project-id")).toEqual({ kind: "bible", id: "project-id" });
  });

  it("rejects unsupported or empty channels", () => {
    expect(parseChannel("other:project-id")).toBeNull();
    expect(parseChannel("scene:")).toBeNull();
    expect(parseChannel("scene")).toBeNull();
  });
});
