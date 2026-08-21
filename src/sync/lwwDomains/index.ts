import type { DbClient } from "../../db/dbClient";
import type { LwwDomainRegistry } from "../lww/registry";
import { createAiConversationsAdapter } from "./aiConversations";
import { createSqlDomainAdapter, type SqlDomainDefinition } from "./sqlDomain";

export { AI_CONVERSATIONS_SYNC_SETTING_KEY, createLwwLocalBridges } from "./localBridges";
export type { AiConversationWriteBridge, DomainWriteBridge, PublishLocalRow } from "./types";

/**
 * `manuscript_about` has no timestamp column, so its seed stamp is 0 and a tie
 * between two devices that both predate sync is broken by device id alone —
 * effectively a coin flip over a whole About page. Announcing only rows that
 * actually say something keeps that flip away from the case that matters: a
 * device holding an untouched blank row can no longer win against one holding
 * real content. The durable fix is an `updated_at` column; see HANDOFF.
 */
const ABOUT_HAS_CONTENT = ["synopsis", "genre", "tone", "pov", "notes"]
  .map((column) => `COALESCE(${column}, '') <> ''`).join(" OR ");

const DEFINITIONS: readonly SqlDomainDefinition[] = [
  { domain: "goals", table: "goals", key: "id", columns: [
    "id", "project_id", "goal_type", "target", "enabled", "created_at", "config_json", "updated_at",
  ], seed: { project: "project_id", stamp: "COALESCE(updated_at, created_at)" } },
  { domain: "quick_notes", table: "quick_notes", key: "id", columns: [
    "id", "project_id", "body", "created_at", "filed", "source", "state",
  ], seed: { project: "project_id", stamp: "created_at" } },
  // Replicate the immutable archive row only. Restore crosses scene docs and epochs
  // and belongs to the archive feature phase.
  { domain: "archive", table: "archive", key: "id", columns: [
    "id", "project_id", "kind", "original_id", "title", "sub", "state_base64", "archived_at",
  ], seed: { project: "project_id", stamp: "archived_at" } },
  // Receiving this projection never touches scene_docs. Restore is a separate,
  // epoch-bumping operation owned by the snapshots feature phase.
  // The seed reaches its project through `scenes`, reproducing exactly the join
  // `publishSnapshotSaved` uses — a snapshot seeded into a different scope than
  // the one it publishes under would be reconciled as two unrelated rows.
  { domain: "scene_snapshots", table: "scene_snapshots", key: "id", columns: [
    "id", "scene_id", "label", "state_base64", "word_count", "created_at", "kind",
  ], seed: {
    project: "scenes.project_id", stamp: "scene_snapshots.created_at",
    from: "scene_snapshots LEFT JOIN scenes ON scenes.id = scene_snapshots.scene_id",
  } },
  { domain: "boards", table: "boards", key: "id", columns: [
    "id", "project_id", "title", "sort",
  ], seed: { project: "project_id" } },
  { domain: "manuscript_about", table: "manuscript_about", key: "project_id", columns: [
    "project_id", "synopsis", "genre", "tone", "pov", "notes",
  ], seed: { project: "project_id", where: ABOUT_HAS_CONTENT } },
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
