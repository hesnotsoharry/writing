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
//
// W48 (2026-06-14) — orchestrator updated the PLACEMENT contract (format-discipline
// assertions unchanged): the volatile scene EXCERPT + truncation notice + selection
// move OUT of the cached `system` prefix INTO the final user turn in `messages`, so
// the Anthropic prompt cache survives scene edits. STABLE grounding stays in `system`:
// role, <principles>, house-style, boundary, About, entities, extra scenes, and the
// scene TITLE (stable while editing a single scene). Implementer must satisfy this
// file without modifying it.

const CTX: AssembledContext = {
  sceneTitle: "Chapter One",
  sceneExcerpt: "The tide came in fast across the causeway.",
  sceneExcerptTruncated: false,
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

describe("buildMessages — stable grounding in system, volatile scene in messages (W48)", () => {
  for (const verb of VERBS) {
    it(`${verb}: stable grounding stays in system; scene excerpt moves to the user turn`, () => {
      const out = buildMessages(verb, CTX, "my ask");
      // STABLE grounding stays in the cached system prefix:
      expect(out.system).toContain("Chapter One"); // scene TITLE is stable during an edit
      expect(out.system).toContain("A keeper guards a tidal causeway."); // About
      expect(out.system).toContain("ch-12"); // spoiler boundary
      // VOLATILE scene excerpt is OUT of system (W48 — so the cache survives edits):
      expect(out.system).not.toContain("The tide came in fast across the causeway.");
      // ...and IS present in the final user message, ahead of the ask:
      const last = out.messages[out.messages.length - 1];
      expect(last.role).toBe("user");
      expect(last.content).toContain("The tide came in fast across the causeway.");
      expect(last.content).toContain("my ask");
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
    // Prior turns are forwarded verbatim (scene context is NOT re-injected into history):
    expect(out.messages[0]).toEqual({ role: "user", content: "first question" });
    expect(out.messages[1]).toEqual({ role: "assistant", content: "first answer" });
    // The new ask is the final user turn; the current scene rides along with it:
    expect(out.messages[2].role).toBe("user");
    expect(out.messages[2].content).toContain("follow-up question");
    expect(out.messages[2].content).toContain("The tide came in fast across the causeway.");
  });

  it("works with no history (single-turn)", () => {
    const out = buildMessages("critique", CTX, "solo ask");
    expect(out.messages).toHaveLength(1);
    expect(out.messages[0].role).toBe("user");
    expect(out.messages[0].content).toContain("solo ask");
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

// ── Wave 37 Phase 2 — scene-excerpt truncation notice ─────────────────────────
// Structural assertions only: the notice string is assembled into the system
// prompt when truncated=true and absent when truncated=false. Behavioral
// quality (model scoping feedback to the visible portion) is deferred to the
// wave-end CDP smoke — cannot be observed at the unit boundary.

const TRUNCATED_CTX: AssembledContext = {
  ...CTX,
  sceneExcerptTruncated: true,
};

describe("buildMessages — scene-excerpt truncation notice (Wave 37 P2 → W48: rides with the excerpt in messages)", () => {
  for (const verb of VERBS) {
    it(`${verb}: user turn contains the truncation notice when sceneExcerptTruncated is true`, () => {
      const out = buildMessages(verb, TRUNCATED_CTX, "x");
      const last = out.messages[out.messages.length - 1].content;
      expect(last).toContain("only the first ~2000 characters");
      expect(last).toContain("do not comment on its ending or overall completeness");
      // The notice travels with the excerpt — NOT in the cached system prefix:
      expect(out.system).not.toContain("only the first ~2000 characters");
    });

    it(`${verb}: user turn does NOT contain the truncation notice when sceneExcerptTruncated is false`, () => {
      const out = buildMessages(verb, CTX, "x");
      const last = out.messages[out.messages.length - 1].content;
      expect(last).not.toContain("only the first ~2000 characters");
    });
  }
});
