/**
 * W46 Component-2 judge transport — Claude Opus via `claude -p` headless.
 *
 * The cross-architecture counterpart to judge.codex.ts (gpt-5.4). Together they
 * form the Decision-12 panel: each subject family gets at least one judge from a
 * DIFFERENT architecture (Opus reads GPT outputs unbiased; GPT reads Claude
 * outputs unbiased), diluting the own-architecture bias a single judge carries.
 *
 * `claude -p` prints ONLY the final assistant message to stdout (no session
 * chrome), so unlike codex no --output-last-message file is needed. Prompt is
 * passed via stdin to avoid shell-quoting the multi-paragraph output text.
 *
 * Funding: runs on the Claude `-p` credit allowance (150/mo as of 2026-06-15),
 * not metered API. Bias note: an Opus judge rating Claude outputs is same-arch;
 * the panel mean is what neutralizes this, not either judge alone.
 */

import { spawnSync } from "node:child_process";

const CLAUDE_TIMEOUT_MS = 180_000;

/** Run `claude -p --model opus`, return its (already clean) stdout text. */
export const opusJudge = async (prompt: string): Promise<string> => {
  const res = spawnSync(
    "claude",
    ["-p", "--model", "opus"],
    { input: prompt, encoding: "utf8", shell: true, timeout: CLAUDE_TIMEOUT_MS, maxBuffer: 1024 * 1024 * 16 },
  );
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`claude -p exited ${res.status}: ${(res.stderr ?? "").slice(0, 400)}`);
  }
  return res.stdout;
};
