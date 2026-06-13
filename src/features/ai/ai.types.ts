import type { IconName } from "../../components/Icon";

export type VerbKey = "brainstorm" | "critique" | "betaread" | "proofread";

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
