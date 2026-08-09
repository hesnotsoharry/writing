import type { IconName } from "../../components/iconPaths";

export type VerbKey = "ask" | "brainstorm" | "critique" | "betaread" | "proofread";

// ── Managed models ────────────────────────────────────────────────────────────
// IDs MUST match the server's MANAGED_MODELS constant exactly — proxy validates them.

export type ManagedModel =
  // Current generation
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-5"
  | "claude-opus-5"
  | "gpt-5.4-mini"
  | "gpt-5.6-luna"
  | "gpt-5.6-terra"
  | "gpt-5.6-sol"
  | "z-ai/glm-5.2"
  // Legacy — superseded but still served; kept selectable at the bottom of each group
  | "claude-sonnet-4-6"
  | "claude-opus-4-8"
  | "gpt-5.4"
  | "gpt-5.5";

export const DEFAULT_MODEL: ManagedModel = "claude-haiku-4-5-20251001";

export interface ModelDef {
  label: string;
  provider: "claude" | "chatgpt" | "glm";
  tier: "standard" | "premium";
  /** Superseded by a newer model. Sorts to the bottom of its picker group and is marked there. */
  legacy?: boolean;
}

export const AI_MODELS: Record<ManagedModel, ModelDef> = {
  "claude-haiku-4-5-20251001": { label: "Haiku 4.5",      provider: "claude",  tier: "standard" },
  "claude-sonnet-5":           { label: "Sonnet 5",       provider: "claude",  tier: "standard" },
  "gpt-5.4-mini":              { label: "GPT-5.4 mini",   provider: "chatgpt", tier: "standard" },
  "gpt-5.6-luna":              { label: "GPT-5.6 Luna",   provider: "chatgpt", tier: "standard" },
  "gpt-5.6-terra":             { label: "GPT-5.6 Terra",  provider: "chatgpt", tier: "standard" },
  "z-ai/glm-5.2":              { label: "GLM-5.2",        provider: "glm",     tier: "standard" },
  "claude-opus-5":             { label: "Opus 5",         provider: "claude",  tier: "premium"  },
  "gpt-5.6-sol":               { label: "GPT-5.6 Sol",    provider: "chatgpt", tier: "premium"  },
  // Legacy
  "claude-sonnet-4-6":         { label: "Sonnet 4.6",     provider: "claude",  tier: "standard", legacy: true },
  "gpt-5.4":                   { label: "GPT-5.4",        provider: "chatgpt", tier: "standard", legacy: true },
  "claude-opus-4-8":           { label: "Opus 4.8",       provider: "claude",  tier: "premium",  legacy: true },
  "gpt-5.5":                   { label: "GPT-5.5",        provider: "chatgpt", tier: "premium",  legacy: true },
};

/**
 * Picker order: standard models (grouped by provider) first, premium last.
 * Within every group, current models come first and legacy models sit at the bottom.
 * ModelPop filters this array by provider/tier and preserves its order, so this list
 * alone controls placement — there is no second ordering rule in the component.
 */
export const AI_MODEL_ORDER: readonly ManagedModel[] = [
  // Claude — standard
  "claude-haiku-4-5-20251001", "claude-sonnet-5", "claude-sonnet-4-6",
  // ChatGPT — standard
  "gpt-5.4-mini", "gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.4",
  // GLM — standard
  "z-ai/glm-5.2",
  // Premium (all providers, current then legacy)
  "claude-opus-5", "gpt-5.6-sol", "claude-opus-4-8", "gpt-5.5",
];

/**
 * Per-model cost in credit units per token, mirrored from the server RATES table
 * (marketing/functions/_lib/credits.ts). Only input/output are needed for the
 * client-side reply estimate — cache rates are irrelevant to the "~N replies" cue.
 * Keep in sync with the server if rates change; the estimate is explicitly approximate ("~").
 */
export const MODEL_RATES: Record<ManagedModel, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.1,    output: 0.5 },
  "claude-sonnet-5":           { input: 0.3,    output: 1.5 },
  "claude-opus-5":             { input: 0.5,    output: 2.5 },
  "gpt-5.4-mini":              { input: 0.075,  output: 0.45 },
  "gpt-5.6-luna":              { input: 0.1,    output: 0.6 },
  "gpt-5.6-terra":             { input: 0.25,   output: 1.5 },
  "gpt-5.6-sol":               { input: 0.5,    output: 3.0 },
  "z-ai/glm-5.2":              { input: 0.0966, output: 0.3036 },
  // Legacy — priced identically to their current-generation successors.
  "claude-sonnet-4-6":         { input: 0.3,    output: 1.5 },
  "claude-opus-4-8":           { input: 0.5,    output: 2.5 },
  "gpt-5.4":                   { input: 0.25,   output: 1.5 },
  "gpt-5.5":                   { input: 0.5,    output: 3.0 },
};

/**
 * A static "typical request" token profile used to translate a credit-unit balance
 * into an approximate per-model reply count. Real cost varies by verb + context;
 * this is a launch-time approximation (per W50 Locked Decision 4).
 */
export const TYPICAL_REQUEST = { inputTokens: 6000, outputTokens: 800 } as const;

/**
 * Client mirror of the server TRIAL_ALLOWANCE constant
 * (marketing/functions/_lib/credits.ts — keep in sync if the server value changes).
 * Used to display a concrete reply estimate in the consent walkthrough step 3 and
 * wherever UI copy needs to state the free trial's included budget.
 */
export const TRIAL_ALLOWANCE_UNITS = 150_000;

export interface VerbDef {
  label: string;
  icon: IconName;
  action: string;
  blurb: string;
  placeholder: string;
  starters: readonly string[];
}

export const AI_VERB_ORDER: readonly VerbKey[] = ["brainstorm", "critique", "betaread", "proofread"];

export const AI_VERBS: Record<VerbKey, VerbDef> = {
  ask: {
    label: "Ask", icon: "feather", action: "Ask",
    blurb: "Ask anything — grounded in your manuscript",
    placeholder: "Ask anything about your story…",
    starters: [
      "Why might this scene feel slow?",
      "What's a stronger word than 'walked' here?",
      "How do other writers handle a midpoint reversal?",
    ],
  },
  brainstorm: {
    label: "Brainstorm", icon: "zap", action: "Brainstorm",
    blurb: "Think out loud with a partner who knows the book",
    placeholder: "What are you wondering about?",
    starters: [
      "What could Tomas know that keeps him quiet but not lying?",
      "Three ways the spring tide could trap someone besides Maren",
      "Why would Edda hide the second keeper from everyone?",
    ],
  },
  critique: {
    label: "Critique", icon: "target", action: "Critique",
    blurb: "Honest craft feedback on what's on the page",
    placeholder: "What should I look hard at?",
    starters: [
      "Does this opening earn its quiet, or is it just slow?",
      "Is the letter doing too much expository work?",
    ],
  },
  betaread: {
    label: "Beta read", icon: "book", action: "Beta read",
    blurb: "A first reader's reactions, beat by beat",
    placeholder: "What do you want a reader's eye on?",
    starters: [
      "Read this scene cold — where do you lean in, where do you drift?",
      "Do you trust Tomas at the end of this scene?",
    ],
  },
  proofread: {
    label: "Proofread", icon: "check", action: "Proofread",
    blurb: "Typos, grammar, consistency — never style",
    placeholder: "Anything in particular to watch for? (optional)",
    starters: [
      "Check this scene",
      "Check tense and UK spellings",
    ],
  },
};

