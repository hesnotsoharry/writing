export interface AiSelectionSnapshot {
  sceneId: string;
  aiSafeText: string;
  wordCount: number;
  aiExcluded: boolean;
  rect: { x: number; y: number; width: number; height: number } | null;
}

export type SelectionCommand = "toggle-bold" | "toggle-italic" | "link-entity" | "copy" | "toggle-ai-exclude";

interface SelectionBridgeState {
  snapshot: AiSelectionSnapshot;
  command(command: SelectionCommand): void;
}

let current: SelectionBridgeState | null = null;

export function registerAiSelection(
  snapshot: AiSelectionSnapshot,
  command: (command: SelectionCommand) => void,
): () => void {
  current = { snapshot, command };
  return () => { if (current?.snapshot === snapshot) current = null; };
}

export function readAiSelection(sceneId: string): AiSelectionSnapshot | null {
  return current?.snapshot.sceneId === sceneId ? current.snapshot : null;
}

export function runSelectionCommand(sceneId: string, command: SelectionCommand): boolean {
  if (current?.snapshot.sceneId !== sceneId) return false;
  current.command(command);
  return true;
}
