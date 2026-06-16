/**
 * W46 Component-2 judge transport — codex exec (Decision 12: $0 on subscription).
 *
 * Implements the scorer's `JudgeFn` contract: (prompt) => Promise<string>.
 * Shells out to `codex exec` and returns ONLY the agent's final message,
 * captured via `--output-last-message <file>` so none of codex's session
 * chrome (header, token footer, skills-loader log noise) pollutes the parse.
 *
 * The judge model is whatever codex runs on the subscription (gpt-5.4 as of
 * 2026-06-15). Bias note for the consumer: a GPT judge rating GPT outputs is
 * same-architecture (possible leniency); rating Claude outputs is cross-arch
 * (clean). The harness-on-vs-off DELTA is judge-bias-robust (same model, same
 * judge, both sides); cross-MODEL slop comparison is where own-arch bias bites.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CODEX_TIMEOUT_MS = 180_000;

/** Run `codex exec`, capture the final agent message via -o, return its text. */
export const codexJudge = async (prompt: string): Promise<string> => {
  const dir = mkdtempSync(join(tmpdir(), "w46-judge-"));
  const outFile = join(dir, "last.txt");
  try {
    const res = spawnSync(
      "codex",
      ["exec", "--ephemeral", "-s", "read-only", "-o", outFile, "-"],
      { input: prompt, encoding: "utf8", shell: true, timeout: CODEX_TIMEOUT_MS, maxBuffer: 1024 * 1024 * 16 },
    );
    if (res.error) throw res.error;
    if (res.status !== 0) {
      throw new Error(`codex exec exited ${res.status}: ${(res.stderr ?? "").slice(0, 400)}`);
    }
    return readFileSync(outFile, "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
