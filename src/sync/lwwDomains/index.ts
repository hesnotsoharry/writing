import type { DbClient } from "../../db/dbClient";
import type { LwwDomainRegistry } from "../lww/registry";
import { createAiConversationsAdapter } from "./aiConversations";
import { createSqlDomainAdapter, type SqlDomainDefinition } from "./sqlDomain";

export { AI_CONVERSATIONS_SYNC_SETTING_KEY, createLwwLocalBridges } from "./localBridges";
export type { AiConversationWriteBridge, DomainWriteBridge, PublishLocalRow } from "./types";

const DEFINITIONS: readonly SqlDomainDefinition[] = [
  { domain: "goals", table: "goals", key: "id", columns: [
    "id", "project_id", "goal_type", "target", "enabled", "created_at", "config_json", "updated_at",
  ] },
  { domain: "quick_notes", table: "quick_notes", key: "id", columns: [
    "id", "project_id", "body", "created_at", "filed", "source", "state",
  ] },
  // Replicate the immutable archive row only. Restore crosses scene docs and epochs
  // and belongs to the archive feature phase.
  { domain: "archive", table: "archive", key: "id", columns: [
    "id", "project_id", "kind", "original_id", "title", "sub", "state_base64", "archived_at",
  ] },
  // Receiving this projection never touches scene_docs. Restore is a separate,
  // epoch-bumping operation owned by the snapshots feature phase.
  { domain: "scene_snapshots", table: "scene_snapshots", key: "id", columns: [
    "id", "scene_id", "label", "state_base64", "word_count", "created_at", "kind",
  ] },
  { domain: "boards", table: "boards", key: "id", columns: [
    "id", "project_id", "title", "sort",
  ] },
  { domain: "manuscript_about", table: "manuscript_about", key: "project_id", columns: [
    "project_id", "synopsis", "genre", "tone", "pov", "notes",
  ] },
];

export interface LwwDomainRegistrations {
  aiConversationsEnabled(): boolean;
  setAiConversationsEnabled(enabled: boolean): void;
  dispose(): void;
}

export function registerLwwDomains(
  registry: LwwDomainRegistry,
  db: DbClient,
  options: { aiConversationsEnabled?: boolean } = {},
): LwwDomainRegistrations {
  const unregister = DEFINITIONS.map((definition) =>
    registry.register(createSqlDomainAdapter(db, definition)));
  let aiUnregister: (() => void) | null = null;
  const setAiConversationsEnabled = (enabled: boolean): void => {
    if (enabled && !aiUnregister) aiUnregister = registry.register(createAiConversationsAdapter(db));
    if (!enabled && aiUnregister) { aiUnregister(); aiUnregister = null; }
  };
  setAiConversationsEnabled(options.aiConversationsEnabled ?? false);
  return {
    aiConversationsEnabled: () => aiUnregister !== null,
    setAiConversationsEnabled,
    dispose: () => { aiUnregister?.(); unregister.forEach((remove) => remove()); },
  };
}
