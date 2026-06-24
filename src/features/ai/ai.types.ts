import type { IconName } from "../../components/Icon";

export type VerbKey = "ask" | "brainstorm" | "critique" | "betaread" | "proofread";

// ── Managed models ────────────────────────────────────────────────────────────
// IDs MUST match the server's MANAGED_MODELS constant exactly — proxy validates them.

export type ManagedModel =
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-6"
  | "claude-opus-4-8"
  | "gpt-5.4-mini"
  | "gpt-5.4"
  | "gpt-5.5"
  | "z-ai/glm-5.2";

export const DEFAULT_MODEL: ManagedModel = "claude-haiku-4-5-20251001";

export interface ModelDef {
  label: string;
  provider: "claude" | "chatgpt" | "glm";
  tier: "standard" | "premium";
}

export const AI_MODELS: Record<ManagedModel, ModelDef> = {
  "claude-haiku-4-5-20251001": { label: "Haiku 4.5",     provider: "claude",  tier: "standard" },
  "claude-sonnet-4-6":         { label: "Sonnet 4.6",   provider: "claude",  tier: "standard" },
  "gpt-5.4-mini":              { label: "GPT-5.4 mini",  provider: "chatgpt", tier: "standard" },
  "gpt-5.4":                   { label: "GPT-5.4",       provider: "chatgpt", tier: "standard" },
  "z-ai/glm-5.2":              { label: "GLM-5.2",       provider: "glm",     tier: "standard" },
  "claude-opus-4-8":           { label: "Claude Opus",   provider: "claude",  tier: "premium"  },
  "gpt-5.5":                   { label: "GPT-5.5",       provider: "chatgpt", tier: "premium"  },
};

/** Picker order: standard models (grouped by provider) first, premium last. */
export const AI_MODEL_ORDER: readonly ManagedModel[] = [
  "claude-haiku-4-5-20251001", "claude-sonnet-4-6",
  "gpt-5.4-mini", "gpt-5.4",
  "z-ai/glm-5.2",
  "claude-opus-4-8", "gpt-5.5",
];

/**
 * Per-model cost in credit units per token, mirrored from the server RATES table
 * (marketing/functions/_lib/credits.ts). Only input/output are needed for the
 * client-side reply estimate — cache rates are irrelevant to the "~N replies" cue.
 * Keep in sync with the server if rates change; the estimate is explicitly approximate ("~").
 */
export const MODEL_RATES: Record<ManagedModel, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.1,   output: 0.5 },
  "claude-sonnet-4-6":         { input: 0.3,   output: 1.5 },
  "claude-opus-4-8":           { input: 0.5,   output: 2.5 },
  "gpt-5.4-mini":              { input: 0.075, output: 0.45 },
  "gpt-5.4":                   { input: 0.25,  output: 1.5 },
  "gpt-5.5":                   { input: 0.5,   output: 3.0 },
  "z-ai/glm-5.2":              { input: 0.095, output: 0.300 },
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

export interface ContextSnapshot {
  sceneId: string;
  sceneTitle: string;
  sceneWords: number;
  entityNames: string[];
  extraSceneTitles: string[];
  selWords: number | null;
  about: boolean;
  boundaryChapterId: string | null;
  boundaryLabel: string | null;
}

export interface AiCtxConfig {
  extraSceneIds: string[];
  offEntityNames: string[];
  about: boolean;
  boundary: string | null;
}

export interface AiMessageRecord {
  id: string;
  role: "you" | "ai";
  verb: VerbKey;
  when: string;
  text: string;
  ctx: ContextSnapshot | null;
  streaming?: boolean;
  creditsCost?: number | null;
}

export interface ConversationRecord {
  id: string;
  title: string;
  verb: VerbKey | null;
  when: string;
  messages: AiMessageRecord[];
}

export interface ManuscriptAbout {
  synopsis: string;
  genre: string;
  tone: string;
  pov: string;
  notes: string;
}

export const EMPTY_ABOUT: ManuscriptAbout = {
  synopsis: "",
  genre: "",
  tone: "",
  pov: "",
  notes: "",
};

export interface ProseSelection {
  text: string;
  words: number;
  rect: DOMRect;
}

export interface AiEstimateResult {
  words: number;
  pct: number;
}

export interface MeterStatus {
  cls: string;
  label: string;
  sub: string;
}

export interface AiSceneRow {
  id: string;
  title: string;
  words: number;
  excludeFromAi?: boolean;
}

export interface AiChapterRow {
  id: string;
  title: string;
  scenes: AiSceneRow[];
}

export interface AiManuscriptTree {
  chapters: AiChapterRow[];
  shortPieces: AiSceneRow[];
}

export interface AiEntity {
  id: string;
  name: string;
}

/** A condensed entity entry sent in the AI context block. */
export interface EntitySummary {
  type: string;
  name: string;
  /** First ENTITY_NOTES_CHARS characters of the entity's notes field. */
  keyFacts: string;
}

/** The assembled context object passed to prompt builders and sent to the AI proxy. */
export interface AssembledContext {
  sceneTitle: string;
  /** Scene plain-text, capped at SCENE_EXCERPT_CHARS. */
  sceneExcerpt: string;
  /**
   * True when the raw scene text exceeded SCENE_EXCERPT_CHARS and was sliced.
   * Prompt builders use this to emit a notice telling the model it has not seen
   * the full scene and should not comment on its ending or completeness.
   */
  sceneExcerptTruncated: boolean;
  /** Extra scene excerpts requested via cfg.extraSceneIds. */
  extraScenes: { title: string; excerpt: string }[];
  /** Filtered entity list (exclude_from_ai + offEntityNames both applied). */
  entitySummaries: EntitySummary[];
  /** Manuscript About fields when cfg.about === true; null otherwise. */
  about: ManuscriptAbout | null;
  /** Selected prose text attached to this ask; null if none. */
  selectionText: string | null;
  /**
   * Instruction telling the model not to reference events past cfg.boundary.
   * Null when no boundary is set.
   */
  boundaryLine: string | null;
}
