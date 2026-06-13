import { describe, expect, it } from "vitest";

import type { AiMessage } from "../features/ai/ai.client";
import type { AssembledContext } from "../features/ai/ai.types";
import { buildMessages, VERB_MAX_TOKENS } from "../features/ai/prompts";

// Orchestrator-authored Phase F acceptance test (Wave 35) — the verb-template
// "harness pass". Implementer builds critique/betaread/proofread builders + a
// `buildMessages(verb, ctx, ask, history)` dispatcher + `VERB_MAX_TOKENS`, and
// may NOT modify this file. The per-verb output contracts (section headers,
// EDIT|/NOTE| line formats) are LOCKED design copy from the handoff Phase 5 —
// they are pinned here deliberately.

const CTX: AssembledContext = {
  sceneTitle: "Chapter One",
  sceneExcerpt: "The tide came in fast across the causeway.",
  extraScenes: [],
  entitySummaries: [{ type: "character", name: "Maren", keyFacts: "the keeper" }],
  about: {
    synopsis: "A keeper guards a tidal causeway.",
    genre: "literary",
    tone: "quiet",
    pov: "first",
    notes: "UK spelling.",
  },
  selectionText: null,
  boundaryLine: "Behave as if you have not read past ch-12; do not reference events beyond it.",
};

const VERBS = ["brainstorm", "critique", "betaread", "proofread"] as const;

describe("VERB_MAX_TOKENS", () => {
  it("caps each verb per the locked contract", () => {
    expect(VERB_MAX_TOKENS.brainstorm).toBe(1024);
    expect(VERB_MAX_TOKENS.critique).toBe(1024);
    expect(VERB_MAX_TOKENS.betaread).toBe(1024);
    expect(VERB_MAX_TOKENS.proofread).toBe(1536);
  });
});

describe("buildMessages — shared skeleton (every verb)", () => {
  for (const verb of VERBS) {
    it(`${verb}: weaves scene, About, and boundary into the system prompt`, () => {
      const out = buildMessages(verb, CTX, "my ask");
      expect(out.system).toContain("Chapter One");
      // About block rides along for grounding.
      expect(out.system).toContain("A keeper guards a tidal causeway.");
      // Spoiler boundary line is present for every verb when set.
      expect(out.system).toContain("ch-12");
      // The user's ask is the final message.
      expect(out.messages[out.messages.length - 1]).toEqual({ role: "user", content: "my ask" });
    });
  }
});

describe("buildMessages — per-verb output-format discipline", () => {
  it("brainstorm asks for a few short paragraphs", () => {
    expect(buildMessages("brainstorm", CTX, "x").system).toMatch(/paragraph/i);
  });

  it("critique pins exactly the three locked section headers", () => {
    const sys = buildMessages("critique", CTX, "x").system;
    expect(sys).toContain("What's working");
    expect(sys).toContain("Questions to sit with");
    expect(sys).toContain("If I pushed on one thing");
  });

  it("beta read frames a first-person reader", () => {
    expect(buildMessages("betaread", CTX, "x").system).toMatch(/reader/i);
  });

  it("proofread constrains output to EDIT| / NOTE| lines and forbids style edits", () => {
    const sys = buildMessages("proofread", CTX, "x").system;
    expect(sys).toContain("EDIT|");
    expect(sys).toContain("NOTE|");
    expect(sys).toMatch(/never|not|no\b/i); // a prohibition on stylistic edits
    expect(sys.toLowerCase()).toContain("style");
  });
});

describe("buildMessages — multi-turn history", () => {
  it("prepends prior turns before the new ask", () => {
    const history: AiMessage[] = [
      { role: "user", content: "first question" },
      { role: "assistant", content: "first answer" },
    ];
    const out = buildMessages("brainstorm", CTX, "follow-up question", history);
    expect(out.messages).toHaveLength(3);
    expect(out.messages[0]).toEqual({ role: "user", content: "first question" });
    expect(out.messages[1]).toEqual({ role: "assistant", content: "first answer" });
    expect(out.messages[2]).toEqual({ role: "user", content: "follow-up question" });
  });

  it("works with no history (single-turn)", () => {
    const out = buildMessages("critique", CTX, "solo ask");
    expect(out.messages).toHaveLength(1);
    expect(out.messages[0]).toEqual({ role: "user", content: "solo ask" });
  });
});

// ── Wave 37 Phase 1 — anti-sycophancy principles assertions ───────────────────
// These are STRUCTURAL assertions only. Behavioral quality (non-sycophantic
// output) is verified by the deferred live CDP smoke at wave-end — NOT by these
// tests. Unit tests cannot observe model output.

describe("buildMessages — shared <principles> block present in every verb (Wave 37 P1)", () => {
  for (const verb of VERBS) {
    it(`${verb}: system prompt contains the shared <principles> opening tag`, () => {
      const sys = buildMessages(verb, CTX, "x").system;
      expect(sys).toContain("<principles>");
    });

    it(`${verb}: system prompt contains the 'Do NOT open' prohibition`, () => {
      const sys = buildMessages(verb, CTX, "x").system;
      expect(sys).toContain("Do NOT open");
    });

    it(`${verb}: system prompt contains the specificity requirement`, () => {
      const sys = buildMessages(verb, CTX, "x").system;
      expect(sys).toContain("specific named line");
    });
  }

  it("critique retains all three locked section headers alongside the <principles> block", () => {
    const sys = buildMessages("critique", CTX, "x").system;
    expect(sys).toContain("<principles>");
    expect(sys).toContain("What's working");
    expect(sys).toContain("Questions to sit with");
    expect(sys).toContain("If I pushed on one thing");
  });

  it("brainstorm includes the non-conventional-option instruction", () => {
    const sys = buildMessages("brainstorm", CTX, "x").system;
    expect(sys).toContain("non-conventional");
  });

  it("betaread prohibits line-editing and copy-editing", () => {
    const sys = buildMessages("betaread", CTX, "x").system;
    expect(sys).toContain("NOT an editor");
    expect(sys).toContain("Do NOT line-edit");
  });
});
