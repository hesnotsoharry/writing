import { invoke } from "@tauri-apps/api/core";

export type SuggestionKind = "replace" | "remove" | "insert_after";

export interface GrammarSuggestion {
  kind: SuggestionKind;
  text: string;
}

export type ProblemKind = "spelling" | "grammar" | "style";

export interface GrammarProblem {
  start: number;
  end: number;
  message: string;
  kind: ProblemKind;
  suggestions: GrammarSuggestion[];
}

export async function lintText(text: string): Promise<GrammarProblem[]> {
  return invoke<GrammarProblem[]>("lint_text", { text });
}

/**
 * Open a file or directory in the system's default application (Explorer on
 * Windows, Finder on macOS). Consumed by Lane 21's "Reveal in folder" button.
 */
export async function openPath(path: string): Promise<void> {
  return invoke<void>("open_path", { path });
}
