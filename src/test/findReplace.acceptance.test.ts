/**
 * findReplace.acceptance.test.ts — ORCHESTRATOR-OWNED acceptance test for Wave 28 Phase 1.
 *
 * ⚠️ Implementers (Claude OR Codex): DO NOT MODIFY THIS FILE. It expresses the boundary contract
 * for Find & Replace from the consumer's perspective. Your job is to make it pass without editing it.
 *
 * Contract: replacing text in a scene must (a) preserve the inline marks of the rest of the document,
 * (b) preserve the mark of the replaced span itself, (c) reach text nested inside list/blockquote
 * structures (search is recursive, so replace must be too), (d) work across paragraphs, and
 * (e) honor whole-word matching including non-ASCII letters.
 *
 * NOTE: the replace-all "self-undo" bug (UI wiring) is verified by the live CDP smoke for this phase,
 * not here.
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

type DeltaOp = { insert?: unknown; attributes?: Record<string, unknown> };

// ── Doc builders ───────────────────────────────────────────────────────────────

/** "The <b>hero</b> fought bravely" — "hero" is bold. */
function makeDocWithBold(): string {
  const doc = new Y.Doc();
  const para = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.applyDelta([
    { insert: "The " },
    { insert: "hero", attributes: { bold: true } },
    { insert: " fought bravely" },
  ]);
  para.insert(0, [t]);
  doc.getXmlFragment("content").insert(0, [para]);
  return encodeDoc(doc);
}

/** One paragraph per line. */
function makeDocParagraphs(lines: string[]): string {
  const doc = new Y.Doc();
  const paras = lines.map((line) => {
    const p = new Y.XmlElement("paragraph");
    const t = new Y.XmlText();
    t.insert(0, line);
    p.insert(0, [t]);
    return p;
  });
  doc.getXmlFragment("content").insert(0, paras);
  return encodeDoc(doc);
}

/** A bullet list: bulletList > listItem > paragraph > XmlText (TipTap's nested shape). */
function makeDocWithList(text: string): string {
  const doc = new Y.Doc();
  const list = new Y.XmlElement("bulletList");
  const item = new Y.XmlElement("listItem");
  const para = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  para.insert(0, [t]);
  item.insert(0, [para]);
  list.insert(0, [item]);
  doc.getXmlFragment("content").insert(0, [list]);
  return encodeDoc(doc);
}

// ── Inspection helpers (kept to max-depth 3) ───────────────────────────────────

function tryDecodeDoc(p: unknown): Y.Doc | null {
  if (typeof p !== "string" || p.length < 8) return null;
  try {
    const d = new Y.Doc();
    applyEncoded(d, p);
    return extractPlainText(d).trim().length > 0 ? d : null;
  } catch {
    return null;
  }
}

/** Recover the persisted scene doc from the execute log, param-order agnostic. */
function persistedDoc(): Y.Doc | null {
  for (let i = executeLog.length - 1; i >= 0; i--) {
    const e = executeLog[i];
    if (!e.sql.includes("scene_docs")) continue;
    const hit = e.params.map(tryDecodeDoc).find((d) => d !== null);
    if (hit) return hit;
  }
  return null;
}

function pushBoldFromText(node: Y.XmlText, out: string[]): void {
  for (const op of node.toDelta() as DeltaOp[]) {
    if (op.attributes?.bold && typeof op.insert === "string") out.push(op.insert);
  }
}

function collectBold(el: Y.XmlElement | Y.XmlFragment, out: string[]): void {
  el.forEach((child) => {
    if (child instanceof Y.XmlText) pushBoldFromText(child, out);
    else if (child instanceof Y.XmlElement) collectBold(child, out);
  });
}

/** Text of every bold-marked run anywhere in the doc (recurses nested elements). */
function boldRuns(doc: Y.Doc): string[] {
  const out: string[] = [];
  collectBold(doc.getXmlFragment("content"), out);
  return out;
}

function mockSceneDoc(base64: string): void {
  selectHandler = (sql) => (sql.includes("FROM scene_docs") ? [{ state_base64: base64 }] : []);
}

// ── Acceptance tests ─────────────────────────────────────────────────────────

describe("Wave 28 P1 acceptance — Find & Replace preserves formatting & reaches all content", () => {
  beforeEach(() => {
    selectHandler = () => [];
    executeLog.length = 0;
  });

  it("preserves an untouched bold run when replacing other text in the paragraph", async () => {
    mockSceneDoc(makeDocWithBold());
    const { replacedCount } = await replaceInScene("s-1", "bravely", "fiercely", new InMemorySnapshotStore());
    expect(replacedCount).toBe(1);
    const doc = persistedDoc();
    expect(doc).not.toBeNull();
    expect(extractPlainText(doc!)).toContain("fiercely");
    expect(extractPlainText(doc!)).not.toContain("bravely");
    expect(boldRuns(doc!)).toContain("hero");
  });

  it("keeps the replaced span's own bold mark when replacing a bold word", async () => {
    mockSceneDoc(makeDocWithBold());
    await replaceInScene("s-1", "hero", "champion", new InMemorySnapshotStore());
    const doc = persistedDoc();
    expect(doc).not.toBeNull();
    expect(extractPlainText(doc!)).toContain("champion");
    expect(boldRuns(doc!)).toContain("champion");
  });

  it("replaces text nested inside a bullet list (search is recursive — replace must be too)", async () => {
    mockSceneDoc(makeDocWithList("Here be a dragon hoard"));
    const { replacedCount } = await replaceInScene("s-1", "dragon", "wyrm", new InMemorySnapshotStore());
    expect(replacedCount).toBe(1);
    const doc = persistedDoc();
    expect(doc).not.toBeNull();
    expect(extractPlainText(doc!)).toContain("wyrm");
    expect(extractPlainText(doc!)).not.toContain("dragon");
  });

  it("replaces a match in a later paragraph without disturbing earlier ones", async () => {
    mockSceneDoc(makeDocParagraphs(["First chapter opens quietly.", "The hero departs at dawn."]));
    await replaceInScene("s-1", "departs", "returns", new InMemorySnapshotStore());
    const doc = persistedDoc();
    expect(doc).not.toBeNull();
    const text = extractPlainText(doc!);
    expect(text).toContain("returns");
    expect(text).not.toContain("departs");
    expect(text).toContain("First chapter opens quietly.");
  });

  it("honors whole-word matching for non-ASCII letters", async () => {
    mockSceneDoc(makeDocParagraphs(["I adore café mornings."]));
    const { replacedCount } = await replaceInScene(
      "s-1",
      "café",
      "tea",
      new InMemorySnapshotStore(),
      { wholeWord: true },
    );
    expect(replacedCount).toBe(1);
    const doc = persistedDoc();
    expect(doc).not.toBeNull();
    expect(extractPlainText(doc!)).toContain("tea");
    expect(extractPlainText(doc!)).not.toContain("café");
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
