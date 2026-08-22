import { SHORT_PIECES_TITLE } from "./binderTree";

export const DEFAULT_SCENE_TITLE = "Untitled scene";
export const DEFAULT_CHAPTER_TITLE = "New chapter";
export const DEFAULT_PROJECT_TITLE = "Untitled project";

export type CreateKind = "scene" | "chapter" | "project";

export interface CreateFolderOption {
  id: string;
  title: string;
}

export interface FolderChoice {
  id: string | null;
  title: string;
}

export interface CreatePromptRequest {
  kind: CreateKind;
  impliedFolderId?: string | null;
}

export interface CreatePromptResult {
  title: string;
  folderId: string | null;
}

export interface ResolveFolderInput {
  /** Chapter implied by the control that opened the prompt. `null` is Short pieces. */
  impliedId?: string | null;
  /** User's picker value. `null` is Short pieces. Omitted means they have not picked. */
  pickedId?: string | null;
  knownIds: readonly string[];
}

export interface CommitCreateInput {
  kind: CreateKind;
  titleInput: string;
  impliedFolderId?: string | null;
  pickedFolderId?: string | null;
  knownIds: readonly string[];
}

/** Placeholder shown in the prompt — also the title written when input is empty. */
export function defaultTitleFor(kind: CreateKind): string {
  if (kind === "scene") return DEFAULT_SCENE_TITLE;
  if (kind === "chapter") return DEFAULT_CHAPTER_TITLE;
  return DEFAULT_PROJECT_TITLE;
}

/**
 * Empty or whitespace input never wins: the placeholder is the title that
 * gets written. A typed name is trimmed. The fallback itself is the last
 * non-blank value, so this cannot produce a blank row.
 */
export function resolveCreateTitle(input: string, fallback: string): string {
  const typed = input.trim();
  if (typed !== "") return typed;
  const placeholder = fallback.trim();
  return placeholder === "" ? DEFAULT_SCENE_TITLE : placeholder;
}

function isSelectableFolder(id: string | null, knownIds: readonly string[]): boolean {
  return id === null || knownIds.includes(id);
}

/**
 * Picker value wins when it names a real chapter or Short pieces. Otherwise
 * the invocation's implied chapter is used (including Short pieces). A
 * missing or stale implication falls back to the first chapter, then Short
 * pieces when the project has none.
 */
export function resolveTargetFolderId(input: ResolveFolderInput): string | null {
  if (input.pickedId !== undefined && isSelectableFolder(input.pickedId, input.knownIds)) {
    return input.pickedId;
  }
  if (input.impliedId !== undefined && isSelectableFolder(input.impliedId, input.knownIds)) {
    return input.impliedId;
  }
  return input.knownIds[0] ?? null;
}

/** Chapters first, then the project-root Short pieces bucket (`folder_id` null). */
export function buildFolderChoices(folders: readonly CreateFolderOption[]): FolderChoice[] {
  return [
    ...folders.map(({ id, title }) => ({ id, title })),
    { id: null, title: SHORT_PIECES_TITLE },
  ];
}

export function commitCreatePrompt(input: CommitCreateInput): CreatePromptResult {
  return {
    title: resolveCreateTitle(input.titleInput, defaultTitleFor(input.kind)),
    folderId: resolveTargetFolderId({
      impliedId: input.impliedFolderId,
      pickedId: input.pickedFolderId,
      knownIds: input.knownIds,
    }),
  };
}
