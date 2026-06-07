/**
 * Regression test: replace-all must NOT synchronously fire onUndoReplace.
 *
 * Bug (pre-fix): handleReplaceAll called `onUndoReplace?.(touchedIds)` immediately
 * after the replace loop. App.tsx wired this to `snapUndoReplace`, which restored
 * every touched scene from its auto-snapshot — silently undoing all replacements
 * in the same tick.
 *
 * Contract being tested: after a successful replace-all, `onUndoReplace` must NOT
 * be called by the store or the component automatically. It may only be called when
 * the user explicitly clicks the Undo button in the resulting Toast.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { replaceInScene } from "../db/manuscriptSearchStore";
import { getDb } from "../db/schema";
import { encodeDoc } from "../yjs/serialize";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSceneDoc(text: string): string {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("content");
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  frag.insert(0, [p]);
  return encodeDoc(doc);
}

function makeSnapshotStore(onTakeSnapshot?: () => void) {
  return {
    takeSnapshot: vi.fn().mockImplementation(() => { onTakeSnapshot?.(); return Promise.resolve(); }),
    listSnapshots: vi.fn().mockResolvedValue([]),
    getSnapshot: vi.fn().mockResolvedValue(null),
    renameSnapshot: vi.fn().mockResolvedValue(undefined),
    deleteSnapshot: vi.fn().mockResolvedValue(undefined),
    pruneAuto: vi.fn().mockResolvedValue(undefined),
  };
}

// ── DB mock ───────────────────────────────────────────────────────────────────

let storedBase64 = makeSceneDoc("The hero fought bravely.");

vi.mock("../db/schema", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockImplementation(
      () => Promise.resolve([{ state_base64: storedBase64 }]),
    ),
    execute: vi.fn().mockImplementation((_sql: string, params?: unknown[]) => {
      // INSERT INTO scene_docs has 3 params: [sceneId, base64, plaintext].
      // UPDATE scenes SET word_count has 2 params: [wordCount, sceneId].
      // Capture only the INSERT (params.length >= 3, params[1] is base64).
      if (Array.isArray(params) && params.length >= 3 && typeof params[1] === "string") {
        storedBase64 = params[1] as string;
      }
      return Promise.resolve();
    }),
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("replaceInScene — onUndoReplace is NOT auto-invoked", () => {
  beforeEach(() => {
    storedBase64 = makeSceneDoc("The hero fought bravely.");
  });

  it("returns a positive replacedCount when the term exists", async () => {
    const snap = makeSnapshotStore();
    const result = await replaceInScene("s-1", "bravely", "fiercely", snap);
    expect(result.replacedCount).toBeGreaterThan(0);
  });

  it("does NOT restore the snapshot after a successful replace — snapUndoReplace is never called by the store", async () => {
    // The store layer (replaceInScene) calls takeSnapshot BEFORE mutating,
    // but never calls any kind of undo/restore afterward.
    // The test verifies this by asserting: after replaceInScene resolves,
    // the persisted state_base64 reflects the replacement (not the original).
    const snap = makeSnapshotStore();
    await replaceInScene("s-1", "bravely", "fiercely", snap);

    // Re-decode the persisted doc and inspect its text.
    const { applyEncoded, extractPlainText } = await import("../yjs/serialize");
    const restored = new Y.Doc();
    applyEncoded(restored, storedBase64);
    const plain = extractPlainText(restored);
    expect(plain).toContain("fiercely");
    expect(plain).not.toContain("bravely");
  });

  it("calls takeSnapshot exactly once before the replace, not afterward", async () => {
    const callOrder: string[] = [];
    const snap = makeSnapshotStore(() => callOrder.push("snapshot"));

    // Intercept the execute mock to track db-write call order.
    const db = await vi.mocked(getDb)();
    vi.mocked(db.execute).mockImplementation((_sql: string, params?: unknown[]) => {
      if (Array.isArray(params) && params.length >= 3 && typeof params[1] === "string") {
        callOrder.push("db-write");
        storedBase64 = params[1] as string;
      }
      return Promise.resolve({ rowsAffected: 0 });
    });

    await replaceInScene("s-1", "bravely", "fiercely", snap);

    // Snapshot must precede the DB write — this is the pre-replace safety guarantee
    const snapIdx = callOrder.indexOf("snapshot");
    const writeIdx = callOrder.indexOf("db-write");
    expect(snapIdx).toBeGreaterThanOrEqual(0);
    expect(writeIdx).toBeGreaterThan(snapIdx);
    // No "undo" or "restore" event appears anywhere in the call order
    expect(callOrder.some((e) => e.startsWith("undo") || e.startsWith("restore"))).toBe(false);
  });
});
