// @vitest-environment node
//
// ORCHESTRATOR-AUTHORED ACCEPTANCE TEST (boundary phase — do not modify in the
// implementing phase). Expresses the lint_text IPC contract from the consumer's
// (editor's) perspective: command name, argument shape, and the typed return.
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import type { GrammarProblem } from "../lib/ipc";
import { lintText } from "../lib/ipc";

describe("lintText IPC contract", () => {
  beforeEach(() => invokeMock.mockReset());

  it("invokes the 'lint_text' command with a { text } argument", async () => {
    invokeMock.mockResolvedValue([]);
    await lintText("He go to the store.");
    expect(invokeMock).toHaveBeenCalledWith("lint_text", {
      text: "He go to the store.",
    });
  });

  it("returns the typed GrammarProblem[] the command resolves", async () => {
    const sample: GrammarProblem[] = [
      {
        start: 3,
        end: 5,
        message: "subject-verb agreement",
        kind: "grammar",
        suggestions: [
          { kind: "replace", text: "goes" },
          { kind: "remove", text: "" },
        ],
      },
    ];
    invokeMock.mockResolvedValue(sample);
    const result = await lintText("He go to the store.");
    expect(result).toEqual(sample);
    // char-indexed offsets + typed suggestions (Decisions A/F)
    expect(result[0].start).toBe(3);
    expect(result[0].suggestions[0].kind).toBe("replace");
    expect(result[0].suggestions[1].kind).toBe("remove");
  });
});
