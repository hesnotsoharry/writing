/**
 * Component 2 — LLM-Judge Cliché Density (W46 design §2, rig v2).
 *
 * Pure transport-injected interface: no SDK imports, no network calls.
 * The `judgeFn` parameter carries all model-call machinery; the scorer
 * only builds the prompt and parses the integer 0–10 response.
 *
 * Scale: 0–10 (rig v2 upgrade from 0–4 for finer discrimination).
 * D3 combination uses normalizeC2ToC1Scale() to convert back to 0–4.
 *
 * Operations:
 *   1. buildC2Prompt        — construct verbatim prompt (0–10 scale)
 *   2. parseJudgeResponse   — extract integer score + one-sentence reasoning
 *   3. scoreComponent2      — orchestrate the above; handle parse failures
 *   4. normalizeC2ToC1Scale — convert 0–10 judge score to 0–4 for D3 combine
 */

import type { Component2Result, JudgeFn } from "./types.ts";

/**
 * Build the exact Component-2 prompt from design §2 (verbatim template).
 * The model is asked for one-sentence reasoning BEFORE the integer score.
 */
export function buildC2Prompt(text: string): string {
  return (
    "Rate the cliché density of the following creative writing assistant output " +
    "on a 0-10 scale: 0 = completely free of clichéd feedback phrases and generic " +
    "observations; 10 = dominated by generic observations that any reader could have " +
    "offered without reading the text carefully. Consider: does the assistant use " +
    "stock phrases to describe writing quality? Are its observations specific to this " +
    "text or applicable to any text in the genre?\n\n" +
    text +
    "\n\nBefore your score, explain your reasoning in one sentence."
  );
}

/**
 * Parse the judge's raw response text into a numeric score (0–10) and
 * the one-sentence reasoning that preceded it.
 *
 * Strategy (in order):
 *   1. If the response contains "N/10" or "N out of 10", take the LAST such N.
 *   2. Else take the LAST standalone integer matching /\b(10|[0-9])\b/g.
 *   3. Clamp result to [0, 10].
 * Returns `score: null` on parse failure.
 *
 * Rationale: the old \b([0-4])\b strategy breaks on "7/10" — it would grab
 * the 10. The explicit N/10 + N-out-of-10 pattern takes priority.
 */
export function parseJudgeResponse(response: string): { score: number | null; reasoning: string } {
  const trimmed = response.trim();

  // Strategy 1: explicit "N/10" or "N out of 10" pattern — take the LAST match
  const fracPattern = /(\d{1,2})\s*(?:\/|out\s+of)\s*10\b/gi;
  const fracMatches = [...trimmed.matchAll(fracPattern)];
  if (fracMatches.length > 0) {
    const lastFrac = fracMatches[fracMatches.length - 1];
    const raw = parseInt(lastFrac[1], 10);
    const score = Math.max(0, Math.min(10, raw));
    const scorePos = lastFrac.index ?? trimmed.length;
    const rawReasoning = trimmed.slice(0, scorePos).trim().replace(/[.,!?]+$/, "").trim();
    const reasoning = rawReasoning.length > 0 ? rawReasoning : trimmed;
    return { score, reasoning };
  }

  // Strategy 2: last standalone integer 0–10
  const intPattern = /\b(10|[0-9])\b/g;
  const intMatches = [...trimmed.matchAll(intPattern)];
  if (intMatches.length === 0) return { score: null, reasoning: trimmed };

  const lastInt = intMatches[intMatches.length - 1];
  const raw = parseInt(lastInt[1], 10);
  const score = Math.max(0, Math.min(10, raw));
  const scorePos = lastInt.index ?? trimmed.length;
  const rawReasoning = trimmed.slice(0, scorePos).trim().replace(/[.,!?]+$/, "").trim();
  const reasoning = rawReasoning.length > 0 ? rawReasoning : trimmed;

  return { score, reasoning };
}

/**
 * Score Component 2: call `judgeFn` with the built prompt, parse the response.
 * On parse failure (no 0–10 integer found), returns a provisional result with
 * `parseFailure: true` and score 5 (neutral mid-band on 0–10, not penalizing).
 */
export async function scoreComponent2(text: string, judgeFn: JudgeFn): Promise<Component2Result> {
  const prompt = buildC2Prompt(text);
  const raw = await judgeFn(prompt);
  const { score, reasoning } = parseJudgeResponse(raw);

  if (score === null) {
    return {
      score: 5,
      reasoning: reasoning,
      parseFailure: true,
    };
  }

  return {
    score,
    reasoning,
    parseFailure: false,
  };
}

/** Normalize a 0–10 judge score to Component-1's 0–4 scale for D3 combination. */
export function normalizeC2ToC1Scale(c2: number): number {
  return c2 * (4 / 10);
}
