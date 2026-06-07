/**
 * findReplace.acceptance.test.ts — ORCHESTRATOR-OWNED acceptance test for Wave 28 Phase 1.
 *
 * ⚠️ Implementers (Claude OR Codex): DO NOT MODIFY THIS FILE. It expresses the boundary contract
 * for Find & Replace from the consumer's perspective. Your job is to make it pass without editing it.
 *
 * Contract under test: replacing text in a scene MUST preserve the inline formatting (marks) of the
 * rest of the document. The current implementation (`buildDocFromText` in manuscriptSearchStore.ts)
 * rebuilds the Yjs tree from plain text and destroys ALL marks — so the first test below is RED today
 * and must go GREEN after the fix (per the research sidecar: headless replace via @tiptap/y-tiptap's
 * yDocToProsemirror/prosemirrorToYDoc, or equivalent in-place Y.XmlText mark-preserving surgery).
 *
 * NOTE: the replace-all "self-undo" bug (FindReplace.tsx handleReplaceAll → onUndoReplace fired
 * immediately) lives in the UI wiring and is verified by the live CDP smoke for this phase, not here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { InMemorySnapshotStore } from "../db/inMemorySnapshotStore";
import { applyEncoded, encodeDoc, extractPlainText } from "../yjs/serialize";

// ── DB mock (mirrors manuscriptSearch.test.ts) ─────────────────────────────────
type SelectHandler = (sql: string, params: unknown[]) => unknown[];
let selectHandler: SelectHandler = () => [];
const executeLog: { sql: string; params: unknown[] }[] = [];

vi.mock("../db/schema", () => ({
  getDb: async () => ({
    select: async <T>(sql: string, params: unknown[] = []): Promise<T> =>
      selectHandler(sql, params) as T,
    execute: async (sql: string, params: unknown[] = []) => {
      executeLog.push({ sql, params });
    },
  }),
}));

// Import after mocking.
import { replaceInScene } from "../db/manuscriptSearchStore";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build an encoded scene doc: "The <b>hero</b> fought bravely" — "hero" is bold. */
function makeDocWithBold(): string {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("content");
  const para = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.applyDelta([
    { insert: "The " },
    { insert: "hero", attributes: { bold: true } },
    { insert: " fought bravely" },
  ]);
  para.insert(0, [t]);
  frag.insert(0, [para]);
  return encodeDoc(doc);
}

/** Recover the persisted scene doc from the execute log, param-order agnostic. */
function persistedDoc(): Y.Doc | null {
  for (let i = executeLog.length - 1; i >= 0; i--) {
    const e = executeLog[i];
    if (!e.sql.includes("scene_docs")) continue;
    for (const p of e.params) {
      if (typeof p !== "string" || p.length < 8) continue;
      try {
        const d = new Y.Doc();
        applyEncoded(d, p);
        if (extractPlainText(d).trim().length > 0) return d;
      } catch {
        // not the base64 doc param — skip
      }
    }
  }
  return null;
}

/** Collect the text of every bold-marked run in the doc. */
function boldRuns(doc: Y.Doc): string[] {
  const out: string[] = [];
  doc.getXmlFragment("content").forEach((node) => {
    if (!(node instanceof Y.XmlElement)) return;
    node.forEach((child) => {
      if (!(child instanceof Y.XmlText)) return;
      for (const op of child.toDelta() as { insert?: unknown; attributes?: Record<string, unknown> }[]) {
        if (op.attributes?.bold && typeof op.insert === "string") out.push(op.insert);
      }
    });
  });
  return out;
}

function mockSceneDoc(base64: string): void {
  selectHandler = (sql) => (sql.includes("FROM scene_docs") ? [{ state_base64: base64 }] : []);
}

// ── Acceptance tests ─────────────────────────────────────────────────────────

describe("Wave 28 P1 acceptance — Find & Replace preserves formatting", () => {
  beforeEach(() => {
    selectHandler = () => [];
    executeLog.length = 0;
  });

  it("preserves an untouched bold run when replacing other text in the paragraph (RED before fix)", async () => {
    mockSceneDoc(makeDocWithBold());
    const store = new InMemorySnapshotStore();

    const { replacedCount } = await replaceInScene("s-1", "bravely", "fiercely", store);
    expect(replacedCount).toBe(1);

    const doc = persistedDoc();
    expect(doc).not.toBeNull();
    const text = extractPlainText(doc!);
    expect(text).toContain("fiercely");
    expect(text).not.toContain("bravely");
    // The load-bearing assertion: the bold "hero" run must survive the replace.
    expect(boldRuns(doc!)).toContain("hero");
  });

  it("still lands the replacement in the persisted plain text (regression guard)", async () => {
    mockSceneDoc(makeDocWithBold());
    const store = new InMemorySnapshotStore();

    await replaceInScene("s-1", "hero", "champion", store);

    const doc = persistedDoc();
    expect(doc).not.toBeNull();
    expect(extractPlainText(doc!)).toContain("champion");
  });

  it("takes an auto-snapshot before mutating (safety net preserved)", async () => {
    mockSceneDoc(makeDocWithBold());
    const store = new InMemorySnapshotStore();

    await replaceInScene("s-1", "hero", "champion", store);

    const snaps = await store.listSnapshots("s-1");
    expect(snaps).toHaveLength(1);
    expect(snaps[0].kind).toBe("auto");
  });
});
