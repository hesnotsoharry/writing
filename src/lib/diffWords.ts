/**
 * diffWords — pure word-level LCS diff.
 *
 * Ported directly from the canon prototype (snapshots.jsx) as specified in
 * SNAPSHOTS-SPEC.md §"Diff util". Framework-free; no external library.
 *
 * The diff computes the Longest Common Subsequence over whitespace-normalized
 * word arrays. "added" words are in `to` but not `from`; "removed" words are
 * in `from` but not `to`. Same words pass through unchanged.
 *
 * Usage (SNAPSHOTS-SPEC.md integration contract):
 *   diffWords(snapshotText, currentText) → DiffToken[]
 *   diffCounts(snapshotText, currentText) → { added: number; removed: number }
 */

export interface DiffToken {
  t: "same" | "add" | "del";
  v: string;
}

/** Build the bottom-up LCS suffix DP table for two word arrays. */
function buildLcs(a: string[], b: string[]): number[][] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

/** Trace the LCS DP table and emit diff tokens. */
function traceLcs(a: string[], b: string[], dp: number[][]): DiffToken[] {
  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ t: "same", v: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ t: "del", v: a[i] });
      i++;
    } else {
      out.push({ t: "add", v: b[j] });
      j++;
    }
  }
  while (i < a.length) out.push({ t: "del", v: a[i++] });
  while (j < b.length) out.push({ t: "add", v: b[j++] });
  return out;
}

/**
 * Compute a word-level diff between two strings.
 * `from` is the older text (snapshot); `to` is the newer text (current).
 * Returns tokens tagged "same", "add" (in to but not from), or "del" (in from but not to).
 */
export function diffWords(aStr: string, bStr: string): DiffToken[] {
  const a = (aStr || "").split(/\s+/).filter(Boolean);
  const b = (bStr || "").split(/\s+/).filter(Boolean);
  return traceLcs(a, b, buildLcs(a, b));
}

/** Summarize the diff as added/removed word counts. */
export function diffCounts(
  from: string,
  to: string
): { added: number; removed: number } {
  const tokens = diffWords(from, to);
  return {
    added: tokens.filter((x) => x.t === "add").length,
    removed: tokens.filter((x) => x.t === "del").length,
  };
}
