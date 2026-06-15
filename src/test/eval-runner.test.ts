/**
 * W46 P2 eval-runner gate tests.
 *
 * Covers the three PURE pieces of the eval rig (no live API calls):
 *   1. Blinding — known sloppy outputs get their tells stripped per schema
 *   2. Keymap generation — OUT-<hex> → metadata mapping is correct + complete
 *   3. Task param-building — harness-ON T3 calls the real builder (non-empty
 *      system prompt); harness-OFF T3 has empty system; T6 uses the spec prompt
 */

import { describe, expect, it } from "vitest";

import { blind } from "../../eval/blinding.ts";
import { E1_CTX, E1_EXCERPT_TEXT } from "../../eval/excerpts.ts";
import { buildKeymap } from "../../eval/keymap.ts";
import {
  buildAllCells,
  buildT3HarnessOffParams,
  buildT3HarnessOnParams,
  buildT6BlankBoxParams,
  PILOT_MODELS,
  PILOT_N,
} from "../../eval/tasks.ts";

// ── 1. Blinding tests ─────────────────────────────────────────────────────────

describe("blind() — sycophantic openers", () => {
  it("strips a bare 'Sure!' opener and retains substantive content", () => {
    const raw = "Sure! This is a beautifully written passage. The tension here is palpable.";
    const result = blind(raw);
    expect(result.stripped).toBe(true);
    expect(result.strip_removed_word_count).toBeGreaterThan(0);
    expect(result.regenerated).toBe(false);
    expect(result.self_id_failure).toBe(false);
    expect(result.text).not.toMatch(/^Sure/);
    expect(result.text).toContain("The tension here is palpable");
  });

  it("strips 'I'd be happy to' opener", () => {
    const raw = "I'd be happy to give feedback. The opening paragraph sets a strong mood.";
    const result = blind(raw);
    expect(result.text).not.toMatch(/^I'd be happy/);
    expect(result.text).toContain("The opening paragraph");
  });

  it("strips 'Certainly!' opener", () => {
    const raw = "Certainly! Here is my honest feedback on this scene.";
    const result = blind(raw);
    expect(result.text).not.toMatch(/^Certainly/);
  });

  it("leaves clean output unchanged", () => {
    const raw = "The opening paragraph buries its strongest image — the bell — in the middle of a long sentence.";
    const result = blind(raw);
    expect(result.stripped).toBe(false);
    expect(result.strip_removed_word_count).toBe(0);
    expect(result.regenerated).toBe(false);
    expect(result.self_id_failure).toBe(false);
    expect(result.text).toContain("The opening paragraph");
  });
});

describe("blind() — in-body model self-references", () => {
  it("strips 'As Claude,' clause and retains surrounding content", () => {
    const raw = "As Claude, I think the opening paragraph needs work. The pacing is slow.";
    const result = blind(raw);
    expect(result.stripped).toBe(true);
    expect(result.strip_removed_word_count).toBeGreaterThan(0);
    expect(result.regenerated).toBe(false);
    expect(result.text).not.toContain("As Claude");
    expect(result.text).toContain("The pacing is slow");
  });

  it("strips 'As a large language model,' clause", () => {
    const raw = "As a large language model, I notice the dialogue is flat. The subtext is absent.";
    const result = blind(raw);
    expect(result.stripped).toBe(true);
    expect(result.strip_removed_word_count).toBeGreaterThan(0);
    expect(result.regenerated).toBe(false);
    expect(result.text).not.toContain("As a large language model");
    expect(result.text).toContain("The subtext is absent");
  });

  it("detects self_id_failure when 'I' starts a sentence after self-ref stripping", () => {
    // After stripping "As Claude, ", the sentence starts with "I"
    // (openers don't match "As Claude..." so it survives the opener pass,
    // but self-ref patterns strip the "As Claude, " clause, leaving "I think...")
    const raw = "As Claude, I think the pacing here is problematic.";
    const result = blind(raw);
    expect(result.stripped).toBe(true);
    expect(result.self_id_failure).toBe(true);
    expect(result.regenerated).toBe(false);
    // Content MUST be preserved — only the self-ID clause is removed, not the sentence
    expect(result.text).toContain("I think the pacing here is problematic");
    expect(result.text).not.toContain("As Claude");
  });

  it("regression: model self-ID prefix does NOT delete the content sentence (over-strip guard)", () => {
    // The bug: OPENERS matching "As Claude" stripped the WHOLE sentence, erasing content.
    // After the fix, only "As Claude, " is removed; substantive words survive.
    const raw = "As Claude, I think the pacing here is problematic.";
    const result = blind(raw);
    expect(result.text).toContain("pacing");
    expect(result.text).toContain("problematic");
    expect(result.text).not.toBe("");
  });

  it("regression: a legitimate first-person critique opening is NOT whole-sentence-stripped", () => {
    // The bug: bare /^I\b/ in OPENERS nuked the entire first sentence of any
    // first-person critique ("I think...") as if it were sycophantic filler.
    const raw = "I think the strongest element here is the dialogue. However, the pacing drags.";
    const result = blind(raw);
    expect(result.text).toContain("strongest element here is the dialogue");
    expect(result.text).toContain("pacing drags");
  });

  it("still strips genuine first-person FILLER openers (e.g. \"I'd be happy to\")", () => {
    const raw = "I'd be happy to help with that! The opening line lands well.";
    const result = blind(raw);
    expect(result.stripped).toBe(true);
    expect(result.text).not.toContain("happy to help");
    expect(result.text).toContain("opening line lands well");
  });

  it("leak: 'As an AI,' clause is surgically removed and does not survive into blinded output", () => {
    const raw = "As an AI, I find the tension in this scene unconvincing.";
    const result = blind(raw);
    expect(result.text).not.toContain("As an AI");
    expect(result.stripped).toBe(true);
    expect(result.text).toContain("tension");
  });

  it("leak: 'As an assistant,' clause is surgically removed and does not survive into blinded output", () => {
    const raw = "As an assistant, I notice the dialogue could be tightened.";
    const result = blind(raw);
    expect(result.text).not.toContain("As an assistant");
    expect(result.stripped).toBe(true);
    expect(result.text).toContain("dialogue");
  });

  it("leak: 'As ChatGPT,' clause is surgically removed and does not survive into blinded output", () => {
    const raw = "As ChatGPT, I think the ending is abrupt.";
    const result = blind(raw);
    expect(result.text).not.toContain("As ChatGPT");
    expect(result.stripped).toBe(true);
    expect(result.text).toContain("ending");
  });
});

describe("blind() — word-count flagging", () => {
  it("flags outputs where > 20 words were stripped from the preamble", () => {
    // 26-word opener before the real content
    const longOpener =
      "I'd be happy to help you with this. As an AI assistant I want to say that this is truly a wonderfully crafted and deeply moving passage that demonstrates real skill. The tension is palpable.";
    const result = blind(longOpener);
    expect(result.flagged).toBe(true);
    expect(result.stripped).toBe(true);
    expect(result.strip_removed_word_count).toBeGreaterThan(20);
    expect(result.regenerated).toBe(false);
  });

  it("does not flag outputs with a short preamble (≤ 20 words)", () => {
    const short = "Sure! The tension is palpable.";
    const result = blind(short);
    expect(result.flagged).toBe(false);
    expect(result.stripped).toBe(true);
    expect(result.strip_removed_word_count).toBeLessThanOrEqual(20);
    expect(result.regenerated).toBe(false);
  });
});

describe("blind() — typography normalization", () => {
  it("normalizes curly quotes to straight quotes", () => {
    const raw = "“This passage” is compelling.";
    const result = blind(raw);
    expect(result.text).toContain('"This passage"');
    expect(result.text).not.toContain("“");
  });

  it("normalizes em-dashes to double hyphens", () => {
    const raw = "The scene — taut and charged — works well.";
    const result = blind(raw);
    expect(result.text).toContain("--");
    expect(result.text).not.toContain("—");
  });
});

// ── 2. Keymap generation tests ────────────────────────────────────────────────

describe("buildKeymap() — label generation + keymap correctness", () => {
  it("produces exactly 60 entries for the full pilot cell set", () => {
    const specs = buildAllCells("E1");
    const { keymap } = buildKeymap(specs);
    expect(Object.keys(keymap)).toHaveLength(60);
  });

  it("produces 60 unique OUT-<hex> labels", () => {
    const specs = buildAllCells("E1");
    const { labels } = buildKeymap(specs);
    const unique = new Set(labels);
    expect(unique.size).toBe(60);
    for (const label of labels) {
      expect(label).toMatch(/^OUT-[0-9a-f]{4}$/);
    }
  });

  it("each keymap entry has all required fields (model, task, condition, excerpt, sample)", () => {
    const specs = buildAllCells("E1");
    const { keymap } = buildKeymap(specs);
    for (const entry of Object.values(keymap)) {
      expect(typeof entry.model).toBe("string");
      expect(entry.model.length).toBeGreaterThan(0);
      expect(["T3", "T6"]).toContain(entry.task);
      expect(["harness-on", "harness-off", "blank-box"]).toContain(entry.condition);
      expect(entry.excerpt).toBe("E1");
      expect(entry.sample).toBeGreaterThanOrEqual(1);
      expect(entry.sample).toBeLessThanOrEqual(PILOT_N);
    }
  });

  it("covers all 4 pilot models in the keymap", () => {
    const specs = buildAllCells("E1");
    const { keymap } = buildKeymap(specs);
    const models = new Set(Object.values(keymap).map((e) => e.model));
    for (const m of PILOT_MODELS) {
      expect(models.has(m)).toBe(true);
    }
  });
});

// ── 3. Task param-building tests ──────────────────────────────────────────────

describe("buildT3HarnessOnParams() — real harness builder (Decision 8)", () => {
  it("returns a non-empty system prompt from the real buildCritiqueMessages", () => {
    const params = buildT3HarnessOnParams("claude-sonnet-4-6", E1_CTX);
    expect(params.system.length).toBeGreaterThan(0);
  });

  it("system prompt contains the critique verb role line", () => {
    const params = buildT3HarnessOnParams("claude-sonnet-4-6", E1_CTX);
    expect(params.system).toContain("trusted writing partner");
  });

  it("system prompt contains the three locked critique headers", () => {
    const params = buildT3HarnessOnParams("claude-sonnet-4-6", E1_CTX);
    expect(params.system).toContain("### What's working");
    expect(params.system).toContain("### Questions to sit with");
    expect(params.system).toContain("### If I pushed on one thing");
  });

  it("system prompt contains SHARED_PRINCIPLES anti-sycophancy block", () => {
    const params = buildT3HarnessOnParams("claude-sonnet-4-6", E1_CTX);
    expect(params.system).toContain("Do NOT open your response with praise");
  });

  it("user message contains the scene excerpt via volatile block", () => {
    const params = buildT3HarnessOnParams("claude-sonnet-4-6", E1_CTX);
    const userContent = params.messages[0].content;
    // buildVolatileUserBlock prepends "Scene excerpt:\n<text>" to the user turn
    expect(userContent).toContain("Scene excerpt:");
    // The system prompt (not user turn) carries the scene title — check it there
    expect(params.system).toContain("Two Minutes Before Closing");
  });

  it("does not seed Anthropic models (seedSupported = false)", () => {
    const params = buildT3HarnessOnParams("claude-sonnet-4-6", E1_CTX);
    expect(params.seed).toBeUndefined();
  });
});

describe("buildT3HarnessOffParams() — no system prompt", () => {
  it("returns empty string for system (harness-OFF = no system prompt)", () => {
    const params = buildT3HarnessOffParams("claude-sonnet-4-6", E1_EXCERPT_TEXT);
    expect(params.system).toBe("");
  });

  it("user message embeds the excerpt text directly", () => {
    const excerpt = "A short excerpt for testing.";
    const params = buildT3HarnessOffParams("gpt-5.4", excerpt);
    const content = params.messages[0].content;
    expect(content).toContain(excerpt);
    expect(content).toContain("Give me your honest craft feedback on this scene.");
  });

  it("sets seed=42 for OpenAI models (Section 5)", () => {
    const params = buildT3HarnessOffParams("gpt-5.4", "excerpt");
    expect(params.seed).toBe(42);
  });
});

describe("buildT6BlankBoxParams() — Section-1 verbatim blank-box prompt", () => {
  it("returns empty string for system (T6 bypasses harness entirely)", () => {
    const params = buildT6BlankBoxParams("gpt-5.4-mini", E1_EXCERPT_TEXT);
    expect(params.system).toBe("");
  });

  it("user message uses the exact Section-1 T6 template", () => {
    const excerpt = "The café was quiet at closing time.";
    const params = buildT6BlankBoxParams("claude-haiku-4-5-20251001", excerpt);
    const content = params.messages[0].content;
    expect(content).toContain("rewrite the opening paragraph");
    expect(content).toContain("stronger sensory detail");
    expect(content).toContain("author's voice and point of view");
    expect(content).toContain(excerpt);
  });

  it("does not include the T3 ask in T6 messages", () => {
    const params = buildT6BlankBoxParams("gpt-5.4", E1_EXCERPT_TEXT);
    const content = params.messages[0].content;
    expect(content).not.toContain("honest craft feedback");
  });
});
