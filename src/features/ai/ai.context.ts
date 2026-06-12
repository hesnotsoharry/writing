/**
 * Brainstorm context assembly — client-side (Decision 4).
 *
 * Gathers the current scene's plain text and linked entity summaries,
 * applies caps, and returns a BrainstormContext ready for the prompt template.
 * Pure async function — testable with mocked store calls.
 */
import type * as Y from "yjs";

import type { StoryBibleStore } from "../../db/storyBibleStore";
import { extractPlainText } from "../../yjs/serialize";
import type { BrainstormContext, EntitySummary } from "./prompts/brainstorm";

// ── Caps ──────────────────────────────────────────────────────────────────────

/** Max scene plain-text characters sent in context (~500 output tokens). */
export const SCENE_EXCERPT_CHARS = 2000;

/** Max entity notes characters per entity in the context block. */
export const ENTITY_NOTES_CHARS = 200;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssemblyInput {
  sceneTitle: string;
  doc: Y.Doc | null;
  sceneId: string | null;
  store: StoryBibleStore;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadEntitySummaries(
  store: StoryBibleStore,
  sceneId: string | null,
): Promise<EntitySummary[]> {
  if (!sceneId) return [];
  try {
    const groups = await store.loadSceneEntities(sceneId);
    return groups.flatMap((g) =>
      g.entities.map((e) => ({
        type: g.type,
        name: e.name,
        keyFacts: (e.notes ?? "").slice(0, ENTITY_NOTES_CHARS).trim(),
      })),
    );
  } catch (err: unknown) {
    console.error("[ai.context] loadSceneEntities failed", err);
    return [];
  }
}

// ── Assembly ──────────────────────────────────────────────────────────────────

/**
 * Assemble a BrainstormContext from the active scene's doc + store entities.
 * All content stays local — the assembled object is what's sent to the proxy.
 */
export async function assembleBrainstormContext(
  input: AssemblyInput,
): Promise<BrainstormContext> {
  const { sceneTitle, doc, sceneId, store } = input;
  const rawText = doc ? extractPlainText(doc) : "";
  const sceneExcerpt = rawText.slice(0, SCENE_EXCERPT_CHARS);
  const entitySummaries = await loadEntitySummaries(store, sceneId);
  return { sceneTitle, sceneExcerpt, entitySummaries };
}
