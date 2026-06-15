/**
 * Component 2 — LLM-Judge Cliché Density (W46 design §2).
 *
 * Pure transport-injected interface: no SDK imports, no network calls.
 * The `judgeFn` parameter carries all model-call machinery; the scorer
 * only builds the prompt and parses the integer 0–4 response.
 *
 * Operations:
 *   1. buildC2Prompt   — construct verbatim prompt from design §2
 *   2. parseJudgeResponse — extract integer score + one-sentence reasoning
 *   3. scoreComponent2 — orchestrate the above; handle parse failures
 */

import type { Component2Result, JudgeFn } from "./types.ts";

/**
 * Build the exact Component-2 prompt from design §2 (verbatim template).
 * The model is asked for one-sentence reasoning BEFORE the integer score.
 */
export function buildC2Prompt(text: string): string {
  return (
    "Rate the cliché density of the following creative writing assistant output " +
    "on a 0-4 scale: 0 = completely free of clichéd feedback phrases and generic " +
    "observations; 4 = dominated by generic observations that any reader could have " +
    "offered without reading the text carefully. Consider: does the assistant use " +
    "stock phrases to describe writing quality? Are its observations specific to this " +
    "text or applicable to any text in the genre?\n\n" +
    text +
    "\n\nBefore your score, explain your reasoning in one sentence."
  );
}

/**
 * Parse the judge's raw response text into a numeric score (0–4) and
 * the one-sentence reasoning that preceded it.
 *
 * Strategy: find the LAST standalone integer 0–4 in the response (most
 * models put the score at the end). Everything before that is reasoning.
 * Returns `score: null` on parse failure.
 */
export function parseJudgeResponse(response: string): { score: number | null; reasoning: string } {
  const trimmed = response.trim();
  // Match standalone single digits 0–4 (not part of a larger number)
  const scoreMatches = [...trimmed.matchAll(/\b([0-4])\b/g)];
  if (scoreMatches.length === 0) return { score: null, reasoning: trimmed };

  const lastMatch = scoreMatches[scoreMatches.length - 1];
  const score = parseInt(lastMatch[1], 10);
  const scorePos = lastMatch.index ?? trimmed.length;

  const rawReasoning = trimmed.slice(0, scorePos).trim().replace(/[.,!?]+$/, "").trim();
  const reasoning = rawReasoning.length > 0 ? rawReasoning : trimmed;

  return { score, reasoning };
}

/**
 * Score Component 2: call `judgeFn` with the built prompt, parse the response.
 * On parse failure (no 0–4 integer found), returns a provisional result with
 * `parseFailure: true` and score 2 (neutral mid-band, not penalizing).
 */
export async function scoreComponent2(text: string, judgeFn: JudgeFn): Promise<Component2Result> {
  const prompt = buildC2Prompt(text);
  const raw = await judgeFn(prompt);
  const { score, reasoning } = parseJudgeResponse(raw);

  if (score === null) {
    return {
      score: 2,
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
