/**
 * Scorer types for the W46 D3 (AI-ism) dimension.
 * Implementation: eval/scorer/component1.ts, component2.ts, index.ts.
 */

export interface Component1Breakdown {
  opener: number;
  cliche: number;
  structure: number;
  lexical: number;
}

export interface Component1Result {
  score: number;
  breakdown: Component1Breakdown;
}

export interface Component2Result {
  score: number;
  reasoning: string;
  /** True when the judge response could not be parsed to an integer 0–4. */
  parseFailure: boolean;
}

/** D3 calibration status per design §5c. */
export type D3Status = "provisional" | "calibrated";

/**
 * Divergence log shape per design §5b.
 * All fields are nullable so the struct can be attached to every D3Result
 * even before a human judge rating is available.
 */
export interface DivergenceLog {
  outputId: string | null;
  d3Score: number;
  judgeRating: number | null;
  divergence: number | null;
  c1Breakdown: Component1Breakdown;
  c2Reasoning: string | null;
}

/** D3 score record combining Component 1 + 2 per design §3. */
export interface D3Result {
  /** Combined D3 score (0–4). */
  d3: number;
  component1: Component1Result;
  /** Null in dry-run mode (no judgeFn supplied). */
  component2: Component2Result | null;
  /**
   * Always 'provisional' until post-pilot corpus calibration completes
   * (design §5c). The orchestrator or consumer may promote to 'calibrated'
   * after the tuning protocol in design §4 is run.
   */
  status: D3Status;
  divergenceLog: DivergenceLog;
}

/**
 * Transport-injected judge function (design Decision 12: cost-gate intact).
 * Receives the full prompt built by component2.ts and returns raw model text.
 * No SDK dependency lives in the scorer module itself.
 */
export type JudgeFn = (prompt: string) => Promise<string>;
