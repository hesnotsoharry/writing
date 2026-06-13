import { describe, expect, it } from "vitest";

import type { AiMessageRecord, ConversationRecord, VerbKey } from "../features/ai/ai.types";
import { buildHistory } from "../features/ai/AssistantPanel.hooks";

// Regression guard for the Phase F multi-turn wiring bug (caught at review):
// the send path passes the PRE-send convos snapshot, whose messages are exactly
// the prior completed turns. A `.slice(0, -2)` once stripped the most recent real
// turn (turn 2 → empty history, turn 3 → missing turn 2). buildHistory must return
// the prior turns unsliced. The verb-prompt oracle could not catch this — it calls
// buildMessages directly with caller-provided history, bypassing this wiring.

const VERB: VerbKey = "brainstorm";

function msg(id: string, role: "you" | "ai", text: string, streaming = false): AiMessageRecord {
  return { id, role, verb: VERB, when: "now", text, ctx: null, streaming };
}

function convo(id: string, messages: AiMessageRecord[]): ConversationRecord {
  return { id, title: "t", verb: VERB, when: "now", messages };
}

describe("buildHistory", () => {
  it("returns a single completed turn unsliced (the regression)", () => {
    const convos = [convo("c1", [msg("m1", "you", "q1"), msg("m2", "ai", "a1")])];
    expect(buildHistory(convos, "c1")).toEqual([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
    ]);
  });

  it("returns all prior turns in order for a multi-turn conversation", () => {
    const convos = [
      convo("c1", [
        msg("m1", "you", "q1"),
        msg("m2", "ai", "a1"),
        msg("m3", "you", "q2"),
        msg("m4", "ai", "a2"),
      ]),
    ];
    const out = buildHistory(convos, "c1");
    expect(out).toHaveLength(4);
    expect(out[2]).toEqual({ role: "user", content: "q2" });
    expect(out[3]).toEqual({ role: "assistant", content: "a2" });
  });

  it("maps roles you→user and ai→assistant", () => {
    const convos = [convo("c1", [msg("m1", "you", "hi"), msg("m2", "ai", "yo")])];
    const out = buildHistory(convos, "c1");
    expect(out[0].role).toBe("user");
    expect(out[1].role).toBe("assistant");
  });

  it("filters out an in-flight streaming message", () => {
    const convos = [convo("c1", [msg("m1", "you", "q1"), msg("m2", "ai", "", true)])];
    expect(buildHistory(convos, "c1")).toEqual([{ role: "user", content: "q1" }]);
  });

  it("returns empty history for an unknown conversation id", () => {
    expect(buildHistory([convo("c1", [msg("m1", "you", "q1")])], "nope")).toEqual([]);
  });
});
