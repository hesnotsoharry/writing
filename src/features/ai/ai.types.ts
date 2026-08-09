import type { VerbKey } from "./ai.catalog";

export * from "./ai.catalog";

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
