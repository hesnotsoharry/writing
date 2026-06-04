/**
 * grammarMapping.test.ts — node environment (no jsdom)
 *
 * Tests the two extractable grammar helpers in ProofreadExtension:
 *   1. grammarProblemsToCheckResults — offset mapping + spelling-kind filter
 *   2. fetchGrammarResults           — graceful degradation when lintText rejects
 *
 * These helpers are pure (no editor mount needed) — exactly the boundary the
 * design identified as unit-testable. Engine-dependent cases (T2 harper
 * false-flags, T6 live toggle) require the real harper runtime + a mounted
 * editor; they are manual-smoke-only and noted at the bottom.
 *
 * Mock order matters: vi.mock calls are hoisted by Vitest before any import
 * resolution, so these stubs prevent the ?url Vite asset imports in
 * dictionary.ts and the @tauri-apps/api/core invoke import in ipc.ts from
 * blowing up in the Node test environment.
 */

import { vi } from "vitest";

// Stub the dictionary module — prevents the ?url asset chain from resolving.
vi.mock("../lib/dictionary", () => ({
  getSpeller: vi.fn(),
}));

// Stub @tauri-apps/api/core — prevents ipc.ts's `invoke` import from failing.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Stub ipc.ts itself so fetchGrammarResults tests control lintText directly.
vi.mock("../lib/ipc", () => ({
  lintText: vi.fn(),
}));

import { Schema } from "prosemirror-model";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTextIndex } from "../editor/extensions/buildTextIndex";
import {
  fetchGrammarResults,
  grammarProblemsToCheckResults,
} from "../editor/extensions/ProofreadExtension";
import type { GrammarProblem } from "../lib/ipc";

// ---------------------------------------------------------------------------
// Minimal ProseMirror schema (mirrors buildTextIndex.test.ts).
// ---------------------------------------------------------------------------

const testSchema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: {
      content: "text*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM() {
        return ["p", 0] as ["p", 0];
      },
    },
    text: { group: "inline" },
  },
});

function makeDoc(...paragraphTexts: string[]) {
  return testSchema.node(
    "doc",
    null,
    paragraphTexts.map((text) =>
      testSchema.node("paragraph", null, text ? [testSchema.text(text)] : []),
    ),
  );
}

// ---------------------------------------------------------------------------
// grammarProblemsToCheckResults
// ---------------------------------------------------------------------------

describe("grammarProblemsToCheckResults", () => {
  it("maps char offsets to correct PM positions for a single-paragraph doc", () => {
    // Doc: "Hello world" — PM pos 1 = 'H', pos 11 = 'd'.
    const doc = makeDoc("Hello world");
    const { plain, segments } = buildTextIndex(doc);

    // Fake problem covering "world" (char 6–11 in plain).
    const problems: GrammarProblem[] = [
      {
        start: 6,
        end: 11,
        message: "Avoid this word",
        kind: "style",
        suggestions: [{ kind: "replace", text: "earth" }],
      },
    ];

    const results = grammarProblemsToCheckResults(problems, segments, true);

    expect(results).toHaveLength(1);
    // PM pos 1 = first char of para1; "world" starts at char 6 → PM pos 7.
    expect(results[0].from).toBe(7);
    expect(results[0].to).toBe(12);
    expect(results[0].type).toBe("style");
    expect(results[0].message).toBe("Avoid this word");
    expect(results[0].suggestions).toEqual([{ kind: "replace", text: "earth" }]);

    // Silence the unused variable warning — plain is needed by charOffsetToPmPos
    // internally but we verify via the returned PM positions above.
    expect(plain.length).toBeGreaterThan(0);
  });

  it("maps char offsets correctly across a 2-paragraph doc (accounts for PM boundary tokens)", () => {
    // Para1: "He go to" (8 chars), para2: "the store" (9 chars)
    // plain = "He go to\nthe store"
    // PM layout:
    //   pos 0  = doc open
    //   pos 1  = para1 open / first char 'H'
    //   pos 9  = end of para1 text (after 'o')
    //   pos 10 = para1 close
    //   pos 11 = para2 open / first char 't'
    //   pos 19 = end of para2 text
    // plain "the store" starts at char offset 9 (after \n separator).
    // "store" is at plain offset 13–18.
    const doc = makeDoc("He go to", "the store");
    const { plain, segments } = buildTextIndex(doc);

    // Problem on "store" — plain offsets 13–18.
    const problems: GrammarProblem[] = [
      {
        start: 13,
        end: 18,
        message: "Avoid passive voice",
        kind: "grammar",
        suggestions: [{ kind: "replace", text: "a store" }],
      },
    ];

    const results = grammarProblemsToCheckResults(problems, segments, true);

    expect(results).toHaveLength(1);
    // Para2 text starts at PM pos 11. "store" is 4 chars into para2 text → PM pos 15.
    // end is PM pos 20 (5 chars: s-t-o-r-e).
    expect(results[0].from).toBe(15);
    expect(results[0].to).toBe(20);
    expect(results[0].type).toBe("grammar");

    expect(plain).toContain("store");
  });

  it("filters out problems whose kind is 'spelling' (nspell owns spelling — no double-underline)", () => {
    const doc = makeDoc("Teh quick brown fox");
    const { segments } = buildTextIndex(doc);

    const problems: GrammarProblem[] = [
      // This is a harper spelling-bucket lint — must be filtered.
      {
        start: 0,
        end: 3,
        message: "Possible spelling error",
        kind: "spelling",
        suggestions: [{ kind: "replace", text: "The" }],
      },
      // This style problem must pass through when styleHintsEnabled is true.
      {
        start: 4,
        end: 9,
        message: "Adverb overuse",
        kind: "style",
        suggestions: [],
      },
    ];

    const results = grammarProblemsToCheckResults(problems, segments, true);

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("style");
  });

  it("filters out 'style' problems when styleHintsEnabled is false (writing.styleHints default OFF)", () => {
    const doc = makeDoc("Teh quick brown fox");
    const { segments } = buildTextIndex(doc);

    const problems: GrammarProblem[] = [
      {
        start: 4,
        end: 9,
        message: "Adverb overuse",
        kind: "style",
        suggestions: [],
      },
      {
        start: 10,
        end: 15,
        message: "Passive voice",
        kind: "grammar",
        suggestions: [],
      },
    ];

    // styleHintsEnabled=false: style problem filtered out, grammar passes through.
    const results = grammarProblemsToCheckResults(problems, segments, false);

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("grammar");
  });

  it("includes 'style' problems when styleHintsEnabled is true", () => {
    const doc = makeDoc("Teh quick brown fox");
    const { segments } = buildTextIndex(doc);

    const problems: GrammarProblem[] = [
      {
        start: 4,
        end: 9,
        message: "Adverb overuse",
        kind: "style",
        suggestions: [],
      },
    ];

    // styleHintsEnabled=true: style problem passes through.
    const results = grammarProblemsToCheckResults(problems, segments, true);

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("style");
  });

  it("returns empty array when all problems are spelling-kind", () => {
    const doc = makeDoc("Teh fox");
    const { segments } = buildTextIndex(doc);

    const problems: GrammarProblem[] = [
      { start: 0, end: 3, message: "Spelling", kind: "spelling", suggestions: [] },
    ];

    expect(grammarProblemsToCheckResults(problems, segments, false)).toHaveLength(0);
  });

  it("carries suggestions array through to the CheckResult unchanged", () => {
    const doc = makeDoc("He go to the store");
    const { segments } = buildTextIndex(doc);

    const suggestions = [
      { kind: "replace" as const, text: "goes" },
      { kind: "remove" as const, text: "" },
    ];
    const problems: GrammarProblem[] = [
      { start: 3, end: 5, message: "Verb agreement", kind: "grammar", suggestions },
    ];

    const results = grammarProblemsToCheckResults(problems, segments, false);

    expect(results[0].suggestions).toEqual(suggestions);
  });
});

// ---------------------------------------------------------------------------
// fetchGrammarResults — graceful degradation (Decision G / T5)
// ---------------------------------------------------------------------------

describe("fetchGrammarResults", () => {
  // Pull the mocked lintText reference after vi.mock is hoisted.
  let lintText: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const ipc = await import("../lib/ipc");
    lintText = ipc.lintText as ReturnType<typeof vi.fn>;
    lintText.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves to [] when lintText rejects, without throwing (Decision G graceful degradation)", async () => {
    lintText.mockRejectedValueOnce(new Error("IPC channel broken"));

    const doc = makeDoc("He go to the store");
    const { plain, segments } = buildTextIndex(doc);

    // Must resolve (not reject) and return an empty array.
    const results = await fetchGrammarResults(plain, segments, false);
    expect(results).toEqual([]);
  });

  it("returns mapped CheckResults when lintText resolves successfully", async () => {
    const doc = makeDoc("He go to the store");
    const { plain, segments } = buildTextIndex(doc);

    const mockProblems: GrammarProblem[] = [
      {
        start: 3,
        end: 5,
        message: "Verb agreement",
        kind: "grammar",
        suggestions: [{ kind: "replace", text: "goes" }],
      },
    ];
    lintText.mockResolvedValueOnce(mockProblems);

    const results = await fetchGrammarResults(plain, segments, false);

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("grammar");
    expect(results[0].message).toBe("Verb agreement");
    expect(results[0].suggestions).toEqual([{ kind: "replace", text: "goes" }]);
  });

  it("filters spelling-kind problems even when received from IPC", async () => {
    const doc = makeDoc("Teh store");
    const { plain, segments } = buildTextIndex(doc);

    lintText.mockResolvedValueOnce([
      { start: 0, end: 3, message: "Spelling", kind: "spelling", suggestions: [] },
      { start: 4, end: 9, message: "Style", kind: "style", suggestions: [] },
    ]);

    const results = await fetchGrammarResults(plain, segments, true);

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("style");
  });
});

// ---------------------------------------------------------------------------
// Manual-smoke-only cases (cannot be unit-tested without the real harper engine
// + a mounted TipTap editor):
//
// T2 — harper "code-like false flags" (e.g. camelCase tokens) — requires the
//   actual LintGroup running on real input; cannot mock the engine output
//   without knowing which rules fire.
//
// T6 — live grammar toggle clearing grammar underlines while spelling remains —
//   requires tauri dev (window.addEventListener + real debounce cycle + DOM
//   paint); the timing contract can't be reliably asserted in jsdom.
// ---------------------------------------------------------------------------
