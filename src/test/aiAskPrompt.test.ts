/**
 * Tests for buildAskMessages — contracts:
 *   - Persona and style/prose-guard blocks are present in the system prompt
 *   - buildGrounding output is injected (scene title appears in system)
 *   - SHARED_PRINCIPLES is NOT present (critique-shaped, wrong for Ask)
 *   - History is threaded ahead of the user turn
 *   - User question is the final message
 */
import { describe, expect, it } from "vitest";

import type { AiMessage } from "../features/ai/ai.client";
import type { AssembledContext } from "../features/ai/ai.types";
import { ASK_MAX_TOKENS, buildAskMessages } from "../features/ai/prompts/ask";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCtx(overrides?: Partial<AssembledContext>): AssembledContext {
  return {
    sceneTitle: "The Lighthouse Keeper",
    sceneExcerpt: "Maren stood at the threshold, the salt wind pulling at her coat.",
    sceneExcerptTruncated: false,
    extraScenes: [],
    entitySummaries: [{ type: "Character", name: "Maren", keyFacts: "lighthouse keeper" }],
    about: null,
    selectionText: null,
    boundaryLine: null,
    ...overrides,
  };
}

// ── Persona / style / prose blocks ───────────────────────────────────────────

describe("buildAskMessages — system prompt persona and guards", () => {
  it("contains the writing-assistant persona line", () => {
    const { system } = buildAskMessages(makeCtx(), "Why does this scene feel slow?");
    expect(system).toContain("You are a writing assistant embedded directly inside a fiction writer's manuscript");
  });

  it("contains the <style> block with the anti-AI-ism ban", () => {
    const { system } = buildAskMessages(makeCtx(), "Any question");
    expect(system).toContain("<style>");
    expect(system).toContain("delve");
  });

  it("contains the <prose> guard", () => {
    const { system } = buildAskMessages(makeCtx(), "Any question");
    expect(system).toContain("<prose>");
    expect(system).toContain("Do NOT generate story prose");
  });

  it("does NOT include SHARED_PRINCIPLES (critique-shaped block)", () => {
    const { system } = buildAskMessages(makeCtx(), "Any question");
    expect(system).not.toContain("<principles>");
    expect(system).not.toContain("Ground every claim in a specific named line");
  });
});

// ── Grounding injection ───────────────────────────────────────────────────────

describe("buildAskMessages — grounding", () => {
  it("includes the scene title from context in the system prompt", () => {
    const { system } = buildAskMessages(makeCtx(), "Any question");
    expect(system).toContain("The Lighthouse Keeper");
  });

  it("includes the scene excerpt in the system prompt", () => {
    const { system } = buildAskMessages(makeCtx(), "Any question");
    expect(system).toContain("Maren stood at the threshold");
  });

  it("includes entity names from context", () => {
    const { system } = buildAskMessages(makeCtx(), "Any question");
    expect(system).toContain("Maren");
  });
});

// ── Message threading ─────────────────────────────────────────────────────────

describe("buildAskMessages — message array", () => {
  it("user question is the final message when no history", () => {
    const { messages } = buildAskMessages(makeCtx(), "What motivates Maren?");
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: "user", content: "What motivates Maren?" });
  });

  it("history is threaded ahead of the user turn", () => {
    const history: AiMessage[] = [
      { role: "user", content: "First question" },
      { role: "assistant", content: "First answer" },
    ];
    const { messages } = buildAskMessages(makeCtx(), "Follow-up question", history);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({ role: "user", content: "First question" });
    expect(messages[1]).toEqual({ role: "assistant", content: "First answer" });
    expect(messages[2]).toEqual({ role: "user", content: "Follow-up question" });
  });

  it("user question is the last message even with history", () => {
    const history: AiMessage[] = [{ role: "user", content: "First" }, { role: "assistant", content: "Reply" }];
    const { messages } = buildAskMessages(makeCtx(), "New question", history);
    const last = messages[messages.length - 1];
    expect(last.role).toBe("user");
    expect(last.content).toBe("New question");
  });

  it("empty history is treated the same as no history", () => {
    const { messages: noHistory } = buildAskMessages(makeCtx(), "Q");
    const { messages: emptyHistory } = buildAskMessages(makeCtx(), "Q", []);
    expect(noHistory).toEqual(emptyHistory);
  });
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe("ASK_MAX_TOKENS", () => {
  it("is 2048", () => {
    expect(ASK_MAX_TOKENS).toBe(2048);
  });
});
