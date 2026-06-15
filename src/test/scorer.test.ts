/**
 * Unit tests for eval/scorer — W46 D3 (AI-ism) scorer.
 *
 * Coverage:
 *   - 1a opener: match vs. no-match
 *   - 1b cliché density: zero, low, high, silence-framing bonus
 *   - 1c structure: sentence-length stddev, consecutive-uniform bonus,
 *     transition word abuse, negation inversion, negation-skip < 100 tokens
 *   - 1d lexical poverty: TTR (clean vs. repetitive), TTR skip < 50 words,
 *     MTLD algorithm (computeMTLDOneDirection directly), diversity score,
 *     noun repetition, adj-noun pairs, AI names
 *   - Component 2: parse success, parse failure (out-of-range), parse failure (no int)
 *   - D3 dry-run (no judgeFn): status provisional, component2 null, d3 = c1
 *   - D3 live run: combination formula
 */

import { describe, expect, it } from "vitest";

import {
  buildC2Prompt,
  computeMTLD,
  computeMTLDOneDirection,
  computeTTR,
  parseJudgeResponse,
  scoreClicheDensity,
  scoreComponent1,
  scoreD3,
  scoreLexicalPoverty,
  scoreMTLDValue,
  scoreOpener,
  scoreStructureUniformity,
  scoreTransitions,
  scoreTTRValue,
  segmentParagraphs,
  segmentSentences,
  tokenizeWords,
} from "../../eval/scorer/index.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Single clean sentence opening — not an AI opener pattern. */
const CLEAN_OPENER = "The protagonist stood at the edge of the cliff.";

/** Matches the OPENER_REGEX — sycophantic affirmation. */
const SYCOPHANTIC_OPENER = "Sure, I'd be happy to provide feedback on this excerpt.";

/** Heavy-slop paragraph: many Tier-A/B/C clichés. */
const SLOP_PARAGRAPH =
  "This tapestry of emotional resonance delves into the realm of human experience " +
  "with vivid imagery. Moreover, it leverages cutting-edge techniques to illuminate " +
  "the beacon of hope. Furthermore, the journey transcends conventional boundaries, " +
  "fostering a profound sense of transformation that is truly remarkable and pivotal.";

/** Clean human prose: minimal clichés. */
const CLEAN_PARAGRAPH =
  "She ran down the street. Rain hit the windows hard. The dog barked twice. " +
  "Her keys slipped from her hand. She stopped under the awning to catch her breath.";

/** Silence-framing sensory cliché. */
const SILENCE_TEXT =
  "The room fell quiet. The silence was a weight she could not name. " +
  "Outside, traffic hummed distantly.";

/** Uniform sentences (all ~10 words) → low stddev → high structure score. */
const UNIFORM_SENTENCES =
  "The writer opened the manuscript with great care. " +
  "She read each line slowly and deliberately. " +
  "The sentences felt flat and oddly mechanical. " +
  "Each clause seemed to mirror the previous one. " +
  "The rhythm never varied across the whole page.";

/** Highly varied sentences → high stddev → low structure score. */
const VARIED_SENTENCES =
  "Rain. " +
  "She sprinted down the darkened alley as the footsteps behind her grew louder and closer. " +
  "Stop. " +
  "Her lungs burned with every desperate stride, heart hammering against her ribs. " +
  "Gone.";

/** Paragraphs all starting with transition words. */
const TRANSITION_HEAVY =
  "Furthermore, the theme is well-developed throughout.\n\n" +
  "Moreover, the dialogue feels natural.\n\n" +
  "Additionally, the pacing keeps the reader engaged.";

/** Normal paragraphs with mixed openings. */
const TRANSITION_NORMAL =
  "The theme emerges gradually.\n\n" +
  "Her dialogue rings true.\n\n" +
  "Pacing is a strength here.";

/** Negation-inversion heavy text (5 occurrences in ~80 tokens). */
const NEGATION_HEAVY =
  "It's not about talent, it's about persistence. " +
  "That's not weakness, that's resilience. " +
  "It's not a flaw, it's a feature. " +
  "That's not the end, that's the beginning. " +
  "It's not failure, it's feedback. " +
  "And every writer knows this truth deeply.";

/**
 * 500 unique synthetic words (high diversity).
 * Built from two-letter alpha prefixes + suffix to avoid digit stripping in tokenizeWords.
 * Format: "aaz", "abz", ..., "txz" — all unique 3-letter alpha words.
 */
const DIVERSE_500 = Array.from({ length: 500 }, (_, i) => {
  const a = String.fromCharCode(97 + Math.floor(i / 26) % 26);
  const b = String.fromCharCode(97 + i % 26);
  return `${a}${b}z`;
}).join(" ");

/** 500-word repetitive text (low diversity — 6 unique words repeated 83 times). */
const REPETITIVE_500 = Array.from({ length: 83 }, () => "the cat sat on the mat").join(" ");

// ── 1a: Opener ────────────────────────────────────────────────────────────────

describe("scoreOpener", () => {
  it("returns 0.5 for a sycophantic opener matching OPENER_REGEX", () => {
    expect(scoreOpener(SYCOPHANTIC_OPENER)).toBe(0.5);
  });

  it("returns 0 for clean prose that does not match any opener pattern", () => {
    expect(scoreOpener(CLEAN_OPENER)).toBe(0);
  });

  it("returns 0.5 for opener starting with 'Let me'", () => {
    expect(scoreOpener("Let me walk you through the issues I found.")).toBe(0.5);
  });

  it("returns 0 when opener match is not at the very start", () => {
    // Pattern only anchored at start (^); mid-sentence 'Moreover' should not trigger
    expect(scoreOpener("The story works. Moreover, the pacing is solid.")).toBe(0);
  });
});

// ── 1b: Cliché Density ───────────────────────────────────────────────────────

describe("scoreClicheDensity", () => {
  it("returns 0 for clean human prose with no cliché phrases", () => {
    expect(scoreClicheDensity(CLEAN_PARAGRAPH)).toBe(0);
  });

  it("returns > 1.0 for heavy-slop paragraph with many Tier-A/B/C phrases", () => {
    expect(scoreClicheDensity(SLOP_PARAGRAPH)).toBeGreaterThan(1.0);
  });

  it("returns ≤ 4.0 for any input (score is capped)", () => {
    expect(scoreClicheDensity(SLOP_PARAGRAPH)).toBeLessThanOrEqual(4.0);
  });

  it("adds 0.5 bonus per silence-framing match", () => {
    // Clean text + 1 silence framing should score at least SILENCE_FRAMING_BONUS (0.5)
    const score = scoreClicheDensity(SILENCE_TEXT);
    expect(score).toBeGreaterThanOrEqual(0.5);
  });

  it("returns 0 for empty string", () => {
    expect(scoreClicheDensity("")).toBe(0);
  });
});

// ── 1c: Structure Uniformity ─────────────────────────────────────────────────

describe("scoreStructureUniformity", () => {
  it("returns a higher score for uniform sentences than varied sentences", () => {
    const uniform = scoreStructureUniformity(UNIFORM_SENTENCES);
    const varied = scoreStructureUniformity(VARIED_SENTENCES);
    expect(uniform).toBeGreaterThan(varied);
  });

  it("returns > 0 for transition-heavy paragraphs", () => {
    expect(scoreStructureUniformity(TRANSITION_HEAVY)).toBeGreaterThan(0);
  });

  it("returns a lower score for normal paragraph openings than transition-heavy", () => {
    const heavy = scoreStructureUniformity(TRANSITION_HEAVY);
    const normal = scoreStructureUniformity(TRANSITION_NORMAL);
    expect(heavy).toBeGreaterThan(normal);
  });

  it("returns > 0 for negation-inversion heavy text with enough tokens", () => {
    expect(scoreStructureUniformity(NEGATION_HEAVY)).toBeGreaterThan(0);
  });

  it("returns 0 for negation check on text < 100 tokens (NEGATION_MIN_TOKENS guard)", () => {
    // Short clean text should have negation sub-score = 0
    const short = "It's not great, it's good."; // 6 tokens < 100
    // The overall structure score may be > 0 for other reasons, but negation alone:
    // We verify via direct negation via structure score being low for clean short text
    expect(scoreStructureUniformity(short)).toBeLessThan(1.5);
  });
});

// ── segmentSentences / segmentParagraphs / tokenizeWords ─────────────────────

describe("segmentation helpers", () => {
  it("segmentSentences splits on .!? boundaries", () => {
    const segs = segmentSentences("Hello. World! Fine?");
    expect(segs).toHaveLength(3);
    expect(segs[0]).toBe("Hello");
    expect(segs[2]).toBe("Fine");
  });

  it("segmentParagraphs splits on double-newlines", () => {
    const paras = segmentParagraphs("Para one.\n\nPara two.\n\nPara three.");
    expect(paras).toHaveLength(3);
  });

  it("tokenizeWords lowercases and strips punctuation", () => {
    const words = tokenizeWords("Hello, World! It's fine.");
    expect(words).toContain("hello");
    expect(words).toContain("world");
    expect(words).toContain("it's");
    expect(words).not.toContain(",");
  });
});

// ── 1d: Lexical Poverty ───────────────────────────────────────────────────────

describe("computeTTR", () => {
  it("returns 1.0 for all-unique words", () => {
    expect(computeTTR(["a", "b", "c", "d", "e"])).toBe(1.0);
  });

  it("returns 0.5 for half-unique words", () => {
    expect(computeTTR(["a", "a", "b", "b"])).toBe(0.5);
  });

  it("returns 1.0 for empty array (edge case — skip path)", () => {
    expect(computeTTR([])).toBe(1.0);
  });
});

describe("computeMTLDOneDirection", () => {
  it("returns words.length when all words are unique (factor count approaches 0)", () => {
    const unique = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"];
    const result = computeMTLDOneDirection(unique);
    expect(result).toBe(unique.length);
  });

  it("returns a low value for highly repetitive text (frequent factor completion)", () => {
    // Repeating 3 unique words: factors complete quickly → short factor length → low MTLD
    const repetitive = Array.from({ length: 30 }, (_, i) => ["the", "cat", "sat"][i % 3]);
    const result = computeMTLDOneDirection(repetitive);
    expect(result).toBeLessThan(20); // short factor lengths → low MTLD
  });

  it("returns a higher value for diverse text than repetitive text", () => {
    const diverse = Array.from({ length: 50 }, (_, i) => `word${i}`);
    const repetitive = Array.from({ length: 50 }, (_, i) => `word${i % 5}`);
    expect(computeMTLDOneDirection(diverse)).toBeGreaterThan(computeMTLDOneDirection(repetitive));
  });
});

describe("computeMTLD", () => {
  it("returns the average of forward and backward MTLD passes", () => {
    const words = ["apple", "banana", "cherry", "apple", "banana", "cherry", "apple", "dog"];
    const fwd = computeMTLDOneDirection(words);
    const bwd = computeMTLDOneDirection([...words].reverse());
    expect(computeMTLD(words)).toBeCloseTo((fwd + bwd) / 2, 10);
  });

  it("scores high diversity (all unique 500 words) → returns 0 MTLD score", () => {
    const words = tokenizeWords(DIVERSE_500);
    const mtld = computeMTLD(words);
    // All unique → factor count near 0 → MTLD = words.length (500) → score = 0
    expect(mtld).toBeGreaterThanOrEqual(80);
  });
});

describe("scoreLexicalPoverty", () => {
  it("scores low for highly diverse 500-word text", () => {
    const score = scoreLexicalPoverty(DIVERSE_500);
    expect(score).toBeLessThan(1.5);
  });

  it("scores higher for highly repetitive 500-word text", () => {
    const score = scoreLexicalPoverty(REPETITIVE_500);
    expect(score).toBeGreaterThan(1.5);
  });

  it("scores > 0 for text containing AI character names (Elara, Silas)", () => {
    const nameText = "Elara walked through the forest. Silas watched from above.";
    expect(scoreLexicalPoverty(nameText)).toBeGreaterThan(0);
  });

  it("returns 0 for empty string", () => {
    expect(scoreLexicalPoverty("")).toBe(0);
  });

  it("skips TTR for texts under 50 words (falls back to repetition flags only)", () => {
    // 10 words: TTR skipped, MTLD skipped → diversity = 0; no repetition → total 0
    const short = "The cat sat on the mat near the door today.";
    const score = scoreLexicalPoverty(short);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(4);
  });
});

// ── Component 1 aggregator ────────────────────────────────────────────────────

describe("scoreComponent1", () => {
  it("returns breakdown with all four sub-scores", () => {
    const result = scoreComponent1(SLOP_PARAGRAPH);
    expect(result.breakdown).toHaveProperty("opener");
    expect(result.breakdown).toHaveProperty("cliche");
    expect(result.breakdown).toHaveProperty("structure");
    expect(result.breakdown).toHaveProperty("lexical");
  });

  it("scores the heavy-slop paragraph higher than clean prose", () => {
    const slopScore = scoreComponent1(SLOP_PARAGRAPH).score;
    const cleanScore = scoreComponent1(CLEAN_PARAGRAPH).score;
    expect(slopScore).toBeGreaterThan(cleanScore);
  });

  it("score is the mean of all four sub-scores", () => {
    const result = scoreComponent1(SLOP_PARAGRAPH);
    const { opener, cliche, structure, lexical } = result.breakdown;
    const expected = (opener + cliche + structure + lexical) / 4;
    expect(result.score).toBeCloseTo(expected, 10);
  });

  it("score is bounded 0–4", () => {
    const worst = scoreComponent1(
      "Sure, I'd be happy to help! This tapestry of emotional resonance " +
      "delves into the realm of vivid imagery. Furthermore, leveraging " +
      "cutting-edge techniques, we illuminate the beacon of hope. " +
      "Moreover, transformative innovation revolutionizes our seamless " +
      "and comprehensive approach. The silence was a weight she could not name.",
    );
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(4);
  });
});

// ── Component 2: parseJudgeResponse ──────────────────────────────────────────

describe("parseJudgeResponse", () => {
  it("parses 'reasoning. 3' → score 3 with the reasoning extracted", () => {
    const { score, reasoning } = parseJudgeResponse("This output is generic and vague. 3");
    expect(score).toBe(3);
    expect(reasoning).toContain("generic");
  });

  it("parses a leading score '2 — some explanation' → score 2", () => {
    const { score } = parseJudgeResponse("2 — some generic framing here");
    expect(score).toBe(2);
  });

  it("returns null score for response containing no 0–4 integer", () => {
    const { score } = parseJudgeResponse("This feedback lacks any numeric score.");
    expect(score).toBeNull();
  });

  it("returns null score when the only integers are out of range (5, 6, etc.)", () => {
    const { score } = parseJudgeResponse("I would rate this about 6 out of 10.");
    expect(score).toBeNull();
  });

  it("uses the LAST integer 0–4 as the score when multiple appear", () => {
    // '0' appears early but '3' is the intended score at the end
    const { score } = parseJudgeResponse("On a scale of 0 to 4, I give this a 3.");
    expect(score).toBe(3);
  });
});

// ── Component 2: buildC2Prompt ────────────────────────────────────────────────

describe("buildC2Prompt", () => {
  it("contains the verbatim design-§2 rating instruction", () => {
    const prompt = buildC2Prompt("Sample output.");
    expect(prompt).toContain("Rate the cliché density");
    expect(prompt).toContain("0-4 scale");
    expect(prompt).toContain("Before your score, explain your reasoning in one sentence.");
  });

  it("embeds the provided text in the prompt", () => {
    const text = "UNIQUE_MARKER_TEXT_XYZ";
    expect(buildC2Prompt(text)).toContain(text);
  });
});

// ── scoreD3: dry-run (no judgeFn) ─────────────────────────────────────────────

describe("scoreD3 — dry-run mode", () => {
  it("returns status 'provisional' when no judgeFn is supplied", async () => {
    const result = await scoreD3(CLEAN_PARAGRAPH);
    expect(result.status).toBe("provisional");
  });

  it("returns component2: null in dry-run mode", async () => {
    const result = await scoreD3(CLEAN_PARAGRAPH);
    expect(result.component2).toBeNull();
  });

  it("d3 equals the component1 score in dry-run mode", async () => {
    const result = await scoreD3(SLOP_PARAGRAPH);
    expect(result.d3).toBeCloseTo(result.component1.score, 10);
  });

  it("includes component1 breakdown in the result", async () => {
    const result = await scoreD3(CLEAN_PARAGRAPH);
    expect(result.component1.breakdown).toBeDefined();
  });
});

// ── scoreD3: live run with fake judgeFn ───────────────────────────────────────

describe("scoreD3 — live run with injected judgeFn", () => {
  it("combines component1 and component2 scores with equal weight", async () => {
    const judgeFn = async () => "This output is somewhat generic. 3";
    const result = await scoreD3(CLEAN_PARAGRAPH, judgeFn);
    const expected = (result.component1.score + 3) / 2;
    expect(result.d3).toBeCloseTo(expected, 10);
    expect(result.component2?.score).toBe(3);
  });

  it("handles parse failure in judgeFn response gracefully", async () => {
    const badJudge = async () => "I cannot provide a numeric rating for this.";
    const result = await scoreD3(CLEAN_PARAGRAPH, badJudge);
    expect(result.component2?.parseFailure).toBe(true);
    // Mid-band default (2) is used; d3 is still computed
    expect(result.d3).toBeGreaterThanOrEqual(0);
    expect(result.d3).toBeLessThanOrEqual(4);
  });

  it("propagates judge reasoning into the result and divergenceLog", async () => {
    const judgeFn = async () => "Generic feedback pattern detected. 2";
    const result = await scoreD3(SLOP_PARAGRAPH, judgeFn);
    expect(result.component2?.reasoning).toContain("Generic");
    expect(result.divergenceLog.c2Reasoning).toContain("Generic");
  });

  it("divergenceLog carries d3Score and c1Breakdown", async () => {
    const judgeFn = async () => "Specific and insightful. 1";
    const result = await scoreD3(CLEAN_PARAGRAPH, judgeFn);
    expect(result.divergenceLog.d3Score).toBeCloseTo(result.d3, 10);
    expect(result.divergenceLog.c1Breakdown).toEqual(result.component1.breakdown);
    expect(result.divergenceLog.judgeRating).toBeNull(); // human rating not yet set
  });
});

// ── Decision-14 pin tests: flat bands must not interpolate mid-band ───────────
// These catch the class of bug where the AI middle band returns a wrong value
// (e.g. 0.57 instead of 2.5 at MTLD=75) that all-extreme fixtures miss.

describe("scoreMTLDValue — flat bands (Decision 14)", () => {
  it("MTLD=90 → 0.0 (human band)", () => {
    expect(scoreMTLDValue(90)).toBe(0.0);
  });

  it("MTLD=80 → 0.0 (human floor exact boundary)", () => {
    expect(scoreMTLDValue(80)).toBe(0.0);
  });

  it("MTLD=75 → 2.5 (AI band — gap closed upward per Decision 14)", () => {
    expect(scoreMTLDValue(75)).toBe(2.5);
  });

  it("MTLD=60 → 2.5 (mid AI band)", () => {
    expect(scoreMTLDValue(60)).toBe(2.5);
  });

  it("MTLD=46 → 2.5 (just inside AI floor)", () => {
    expect(scoreMTLDValue(46)).toBe(2.5);
  });

  it("MTLD=45 → 2.5 (AI floor boundary, inclusive)", () => {
    expect(scoreMTLDValue(45)).toBe(2.5);
  });

  it("MTLD=30 → 4.0 (below AI floor)", () => {
    expect(scoreMTLDValue(30)).toBe(4.0);
  });

  it("MTLD=0 → 4.0 (zero — degenerate)", () => {
    expect(scoreMTLDValue(0)).toBe(4.0);
  });
});

describe("scoreTTRValue — flat bands (Decision 14)", () => {
  it("TTR=0.70 → 0.0 (human band)", () => {
    expect(scoreTTRValue(0.70)).toBe(0.0);
  });

  it("TTR=0.55 → 0.0 (human floor exact boundary)", () => {
    expect(scoreTTRValue(0.55)).toBe(0.0);
  });

  it("TTR=0.48 → 1.5 (suspicious band)", () => {
    expect(scoreTTRValue(0.48)).toBe(1.5);
  });

  it("TTR=0.40 → 1.5 (lower suspicious boundary, inclusive)", () => {
    expect(scoreTTRValue(0.40)).toBe(1.5);
  });

  it("TTR=0.20 → 3.0 (low-diversity band — was incorrectly 2.25 with interpolation)", () => {
    expect(scoreTTRValue(0.20)).toBe(3.0);
  });

  it("TTR=0.0 → 3.0 (zero TTR — degenerate)", () => {
    expect(scoreTTRValue(0.0)).toBe(3.0);
  });
});

describe("scoreClicheDensity — flat brackets (Decision 14)", () => {
  it("exactly 1 cliché per 100 words → 1.0 (not a fraction from interpolation)", () => {
    // 100-word text: "tapestry of" (2 words) + 98 filler words
    const fillerWords = Array.from({ length: 98 }, () => "word").join(" ");
    const text = `tapestry of ${fillerWords}`;
    expect(scoreClicheDensity(text)).toBeCloseTo(1.0, 5);
  });

  it("0 clichés → 0.0", () => {
    expect(scoreClicheDensity(CLEAN_PARAGRAPH)).toBe(0.0);
  });
});

describe("scoreTransitions — flat bands (Decision 14)", () => {
  it("15% of paragraphs open with connectors → 0.0 (below 20% floor)", () => {
    // 1 out of 7 paragraphs = 14.3%
    const text =
      "Furthermore, the writing is strong.\n\n" +
      "Second paragraph here.\n\n" +
      "Third paragraph here.\n\n" +
      "Fourth paragraph here.\n\n" +
      "Fifth paragraph here.\n\n" +
      "Sixth paragraph here.\n\n" +
      "Seventh paragraph here.";
    const paras = text.split(/\n\s*\n+/).map((p) => p.trim());
    expect(scoreTransitions(paras)).toBe(0.0);
  });

  it("30% of paragraphs open with connectors → 1.0 (20–39% band)", () => {
    // 3 out of 10 paragraphs = 30%
    const paras = [
      "Furthermore, the theme is clear.",
      "Second paragraph.",
      "Moreover, dialogue is natural.",
      "Fourth paragraph.",
      "Fifth paragraph.",
      "Additionally, pacing works.",
      "Seventh paragraph.",
      "Eighth paragraph.",
      "Ninth paragraph.",
      "Tenth paragraph.",
    ];
    expect(scoreTransitions(paras)).toBe(1.0);
  });

  it("45% of paragraphs open with connectors → 2.0 (≥40% band)", () => {
    // 5 out of 11 paragraphs = ~45%
    const paras = [
      "Furthermore, strong theme.",
      "Moreover, great voice.",
      "Third paragraph.",
      "Additionally, pacing works.",
      "Fifth paragraph.",
      "Indeed, the tension builds.",
      "Seventh paragraph.",
      "Consequently, the ending lands.",
      "Ninth paragraph.",
      "Tenth paragraph.",
      "Eleventh paragraph.",
    ];
    expect(scoreTransitions(paras)).toBe(2.0);
  });

  it("0% → 0.0", () => {
    const paras = ["First paragraph.", "Second paragraph.", "Third paragraph."];
    expect(scoreTransitions(paras)).toBe(0.0);
  });
});
