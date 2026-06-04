// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import type { SceneStatus } from "../lib/status";
import {
  normalizeStatus,
  STATUS_META,
  STATUS_ORDER,
} from "../lib/status";

// ── normalizeStatus ────────────────────────────────────────────────────────────

describe("normalizeStatus", () => {
  it("passes 'blank' through unchanged", () => {
    expect(normalizeStatus("blank")).toBe("blank");
  });

  it("passes 'outline' through unchanged", () => {
    expect(normalizeStatus("outline")).toBe("outline");
  });

  it("passes 'draft' through unchanged", () => {
    expect(normalizeStatus("draft")).toBe("draft");
  });

  it("passes 'revise' through unchanged", () => {
    expect(normalizeStatus("revise")).toBe("revise");
  });

  it("passes 'final' through unchanged", () => {
    expect(normalizeStatus("final")).toBe("final");
  });

  it("maps legacy 'done' to 'final'", () => {
    expect(normalizeStatus("done")).toBe("final");
  });

  it("maps unknown string to 'blank'", () => {
    expect(normalizeStatus("in-progress")).toBe("blank");
  });

  it("maps empty string to 'blank'", () => {
    expect(normalizeStatus("")).toBe("blank");
  });

  it("is case-sensitive — 'DRAFT' maps to 'blank'", () => {
    expect(normalizeStatus("DRAFT")).toBe("blank");
  });
});

// ── STATUS_ORDER ──────────────────────────────────────────────────────────────

describe("STATUS_ORDER", () => {
  it("has exactly 5 entries in the canonical order", () => {
    expect(STATUS_ORDER).toStrictEqual([
      "blank",
      "outline",
      "draft",
      "revise",
      "final",
    ]);
  });
});

// ── STATUS_META ────────────────────────────────────────────────────────────────

describe("STATUS_META", () => {
  it("has an entry for every status in STATUS_ORDER", () => {
    for (const s of STATUS_ORDER) {
      expect(STATUS_META[s]).toBeDefined();
    }
  });

  it("final.isFinal is true", () => {
    expect(STATUS_META.final.isFinal).toBe(true);
  });

  it("all non-final statuses have isFinal false", () => {
    const nonFinal: SceneStatus[] = ["blank", "outline", "draft", "revise"];
    for (const s of nonFinal) {
      expect(STATUS_META[s].isFinal).toBe(false);
    }
  });

  it("blank dot is 'var(--ink-4)'", () => {
    expect(STATUS_META.blank.dot).toBe("var(--ink-4)");
  });

  it("final dot is 'var(--good)'", () => {
    expect(STATUS_META.final.dot).toBe("var(--good)");
  });

  it("draft dot is 'var(--accent)'", () => {
    expect(STATUS_META.draft.dot).toBe("var(--accent)");
  });

  it("revise dot is the literal hex '#6a86a8'", () => {
    expect(STATUS_META.revise.dot).toBe("#6a86a8");
  });

  it("labels match the canon spec", () => {
    expect(STATUS_META.blank.label).toBe("To write");
    expect(STATUS_META.outline.label).toBe("Outlined");
    expect(STATUS_META.draft.label).toBe("Drafting");
    expect(STATUS_META.revise.label).toBe("Revising");
    expect(STATUS_META.final.label).toBe("Final");
  });
});
