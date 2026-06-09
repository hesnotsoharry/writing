/**
 * snapAutoCapture.test.ts
 *
 * Contract: snapAutoCapture writes an auto-snapshot iff the scene's content
 * has changed since its last snapshot (trim-normalised plain-text comparison).
 *
 * Four cases:
 *   1. No previous snapshot exists → always write.
 *   2. Content differs from last snapshot → write.
 *   3. Content matches last snapshot (dedup) → skip (no DB write).
 *   4. Doc is empty → skip (no DB write).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { snapAutoCapture, snapshotStore } from "../App.snapshots";
import type { Snapshot } from "../db/snapshotStore";
import { getTweak } from "../features/settings/settings.store";
import { encodeDoc } from "../yjs/serialize";

// Mock the settings module so snapAutoCapture can read snapshotAutoLimit
// without needing localStorage (test environment is Node, not jsdom).
vi.mock("../features/settings/settings.store", () => ({
  getTweak: vi.fn(() => 25),
  TWEAK_DEFAULTS: { snapshotAutoLimit: 25 },
}));

/** Build a Y.Doc whose "content" XmlFragment has a single paragraph with the given text. */
function docWithText(text: string): Y.Doc {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("content");
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  frag.insert(0, [p]);
  return doc;
}

function makeMeta(sceneId: string, id = "snap-1"): Snapshot {
  return { id, sceneId, label: null, wordCount: 5, createdAt: Date.now(), kind: "auto" };
}

describe("snapAutoCapture", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes a new auto-snapshot when no previous snapshot exists", async () => {
    const doc = docWithText("hello world");
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);
    const takeSnapshot = vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeMeta("s1"));
    vi.spyOn(snapshotStore, "pruneAuto").mockResolvedValue();

    await snapAutoCapture({ sceneId: "s1", doc });

    expect(takeSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      sceneId: "s1", kind: "auto", label: null,
    }));
  });

  it("writes a new auto-snapshot when content differs from the last snapshot", async () => {
    const doc = docWithText("updated content here");
    const prevDoc = docWithText("original content");
    const lastSnap = makeMeta("s1");
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([lastSnap]);
    vi.spyOn(snapshotStore, "getSnapshot").mockResolvedValue({
      meta: lastSnap, stateBase64: encodeDoc(prevDoc),
    });
    const takeSnapshot = vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeMeta("s1"));
    vi.spyOn(snapshotStore, "pruneAuto").mockResolvedValue();

    await snapAutoCapture({ sceneId: "s1", doc });

    expect(takeSnapshot).toHaveBeenCalledOnce();
  });

  it("skips the DB write when content matches the last snapshot (dedup)", async () => {
    const sharedText = "the quick brown fox";
    const doc = docWithText(sharedText);
    const lastDoc = docWithText(sharedText);
    const lastSnap = makeMeta("s1");
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([lastSnap]);
    vi.spyOn(snapshotStore, "getSnapshot").mockResolvedValue({
      meta: lastSnap, stateBase64: encodeDoc(lastDoc),
    });
    const takeSnapshot = vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeMeta("s1"));

    await snapAutoCapture({ sceneId: "s1", doc });

    expect(takeSnapshot).not.toHaveBeenCalled();
  });

  it("skips the DB write when the doc is empty", async () => {
    const doc = new Y.Doc(); // no content
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);
    const takeSnapshot = vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeMeta("s1"));

    await snapAutoCapture({ sceneId: "s1", doc });

    expect(takeSnapshot).not.toHaveBeenCalled();
  });

  it("calls pruneAuto with the configured limit after writing a new auto-snapshot", async () => {
    vi.mocked(getTweak).mockReturnValue(2);
    const doc = docWithText("new content to capture");
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);
    vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeMeta("s1"));
    const pruneAuto = vi.spyOn(snapshotStore, "pruneAuto").mockResolvedValue();

    await snapAutoCapture({ sceneId: "s1", doc });

    expect(pruneAuto).toHaveBeenCalledWith("s1", 2);
  });

  it("skips pruneAuto when snapshotAutoLimit is 0 (unlimited)", async () => {
    vi.mocked(getTweak).mockReturnValue(0);
    const doc = docWithText("content that would trigger a write");
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);
    vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeMeta("s1"));
    const pruneAuto = vi.spyOn(snapshotStore, "pruneAuto").mockResolvedValue();

    await snapAutoCapture({ sceneId: "s1", doc });

    expect(pruneAuto).not.toHaveBeenCalled();
  });
});
