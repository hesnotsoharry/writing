/**
 * D3 (AI-ism dimension) scorer — W46 design §3.
 *
 * Orchestrates Component 1 (mechanical) + Component 2 (LLM judge) into a
 * single D3Result. The combination formula is:
 *
 *   D3 = (Component1_score + Component2_score) / 2   [equal weight]
 *
 * Dry-run mode (no judgeFn): returns Component-1-only score with
 * `component2: null` and `status: 'provisional'`. D3 equals C1 score in
 * this mode and the divergenceLog notes no C2 data was available.
 *
 * Status is always 'provisional' from this scorer because post-pilot
 * corpus calibration has not yet run (design §5c).
 */

import { scoreComponent2 } from "./component2.ts";
import { scoreComponent1 } from "./component1.ts";
import type { D3Result, DivergenceLog, JudgeFn } from "./types.ts";

/** Build an empty divergence log populated with D3 result fields. */
function buildDivergenceLog(
  d3Score: number,
  c1: D3Result["component1"],
  c2Reasoning: string | null,
): DivergenceLog {
  return {
    outputId: null,
    d3Score,
    judgeRating: null,
    divergence: null,
    c1Breakdown: c1.breakdown,
    c2Reasoning,
  };
}

/**
 * Compute D3 score for a text string.
 *
 * @param text     — the assistant output to score
 * @param judgeFn  — optional transport-injected LLM judge (omit for dry-run)
 *
 * When `judgeFn` is supplied, both components run and D3 is their average.
 * When omitted, only Component 1 runs; D3 equals the C1 score and
 * `component2` is null in the result.
 */
export async function scoreD3(text: string, judgeFn?: JudgeFn): Promise<D3Result> {
  const component1 = scoreComponent1(text);

  if (!judgeFn) {
    const d3 = component1.score;
    return {
      d3,
      component1,
      component2: null,
      status: "provisional",
      divergenceLog: buildDivergenceLog(d3, component1, null),
    };
  }

  const component2 = await scoreComponent2(text, judgeFn);
  const d3 = (component1.score + component2.score) / 2;

  return {
    d3,
    component1,
    component2,
    status: "provisional",
    divergenceLog: buildDivergenceLog(d3, component1, component2.reasoning),
  };
}

export type { Component1Breakdown, Component1Result, Component2Result, D3Result, D3Status, DivergenceLog, JudgeFn } from "./types.ts";
export { scoreComponent1 } from "./component1.ts";
export { buildC2Prompt, parseJudgeResponse, scoreComponent2 } from "./component2.ts";
export {
  computeMTLD,
  computeMTLDOneDirection,
  computeTTR,
  scoreClicheDensity,
  scoreLexicalPoverty,
  scoreMTLDValue,
  scoreOpener,
  scoreStructureUniformity,
  scoreTTRValue,
  scoreTransitions,
  segmentParagraphs,
  segmentSentences,
  tokenizeWords,
} from "./component1.ts";
