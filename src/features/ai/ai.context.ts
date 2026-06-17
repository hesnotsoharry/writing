/**
 * AI context assembly — client-side (Decision 4).
 *
 * `assembleContext` — verb-aware multi-source assembly. Applies both
 * D4 privacy filters (persistent exclude_from_ai flag + per-ask offEntityNames)
 * as the single auditable gate before anything is sent to the proxy.
 *
 * Pure async functions — testable with mocked store calls.
 */
import type * as Y from "yjs";

import type { StoryBibleStore } from "../../db/storyBibleStore";
import { AI_SCENE_HIDDEN_PLACEHOLDER, extractAiSafeText } from "../../yjs/serialize";
import type {
  AiCtxConfig,
  AssembledContext,
  EntitySummary,
  ManuscriptAbout,
  VerbKey,
} from "./ai.types";

// ── Caps ──────────────────────────────────────────────────────────────────────

/** Max scene plain-text characters sent in context (~500 output tokens). */
export const SCENE_EXCERPT_CHARS = 2000;

/** Max entity notes characters per entity in the context block. */
export const ENTITY_NOTES_CHARS = 200;

// ── Phase E assembly input ────────────────────────────────────────────────────

export interface AssembleContextInput {
  verb: VerbKey;
  cfg: AiCtxConfig;
  sceneTitle: string;
  sceneId: string | null;
  doc: Y.Doc | null;
  store: StoryBibleStore;
  projectId: string | null;
  selectionText?: string | null;
}

// ── Re-export AssembledContext so callers can import from one place ───────────
export type { AssembledContext };

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Filter raw entity groups to EntitySummary[], applying D4 privacy filters.
 * Exported so the display path (chips / context picker) uses the IDENTICAL
 * filter as assembleContext — parity by construction.
 *
 * @param groups  Raw SceneEntityGroup[] from store.loadSceneEntities.
 * @param offEntityNames  Combined off-list: aiCtx.offEntityNames ++ neverNames.
 */
export function filterAiEntities(
  groups: Awaited<ReturnType<StoryBibleStore["loadSceneEntities"]>>,
  offEntityNames: string[],
): EntitySummary[] {
  const offSet = new Set(offEntityNames.map((n) => n.toLowerCase()));
  return groups.flatMap((g) =>
    g.entities
      .filter((e) => e.exclude_from_ai !== true)
      .filter((e) => !offSet.has(e.name.toLowerCase()))
      .map((e) => ({
        type: g.type,
        name: e.name,
        keyFacts: (e.notes ?? "").slice(0, ENTITY_NOTES_CHARS).trim(),
      })),
  );
}

/** Build the spoiler-boundary instruction line (must contain the boundary id). */
function buildBoundaryLine(boundary: string | null): string | null {
  if (!boundary) return null;
  return `Treat this conversation as if you have not read past ${boundary}: do not reference or reveal events, revelations, or character arcs that occur after that point.`;
}

/** Fetch title + capped text for a list of extra scene ids.
 * Per-scene exclusion gate: if a scene's exclude_from_ai flag is set,
 * the placeholder is substituted — real prose never enters the result. */
async function loadExtraSceneExcerpts(
  store: StoryBibleStore,
  ids: string[],
): Promise<{ title: string; excerpt: string }[]> {
  const results: { title: string; excerpt: string }[] = [];
  for (const id of ids) {
    try {
      const [excluded, row] = await Promise.all([
        store.getSceneExcludedFromAi(id),
        store.getSceneText(id),
      ]);
      if (row) {
        results.push({
          title: row.title,
          excerpt: excluded ? AI_SCENE_HIDDEN_PLACEHOLDER : row.text.slice(0, SCENE_EXCERPT_CHARS),
        });
      }
    } catch {
      // Non-fatal: skip missing extra scenes.
    }
  }
  return results;
}

/** Fetch manuscript About when requested; return null otherwise. */
async function fetchAbout(
  store: StoryBibleStore,
  projectId: string | null,
  include: boolean,
): Promise<ManuscriptAbout | null> {
  if (!include || !projectId) return null;
  try {
    return await store.getManuscriptAbout(projectId);
  } catch {
    return null;
  }
}

// ── Phase E assembly ──────────────────────────────────────────────────────────

/**
 * Assemble the full AI context for any verb.
 * Privacy guarantee (D4): both entity-exclusion filters are applied here —
 * `exclude_from_ai` (persistent shield) and `cfg.offEntityNames` (per-ask).
 * The assembled object is what is sent to the proxy; nothing shielded escapes.
 */
export async function assembleContext(
  input: AssembleContextInput,
): Promise<AssembledContext> {
  const { cfg, sceneTitle, sceneId, doc, store, projectId, selectionText } = input;

  // Scene-level exclusion gate (W53 Phase 2 — security-critical).
  // Check BEFORE extracting prose so no real text is ever materialized into context.
  const isSceneExcluded = sceneId != null
    ? await store.getSceneExcludedFromAi(sceneId)
    : false;
  const rawSceneText = (!isSceneExcluded && doc) ? extractAiSafeText(doc) : "";
  const sceneExcerptTruncated = !isSceneExcluded && rawSceneText.length > SCENE_EXCERPT_CHARS;
  const sceneExcerpt = isSceneExcluded
    ? AI_SCENE_HIDDEN_PLACEHOLDER
    : rawSceneText.slice(0, SCENE_EXCERPT_CHARS);

  const rawGroups = sceneId
    ? await store.loadSceneEntities(sceneId).catch(() => [])
    : [];
  const entitySummaries = filterAiEntities(rawGroups, cfg.offEntityNames);

  const [about, extraScenes] = await Promise.all([
    fetchAbout(store, projectId, cfg.about),
    loadExtraSceneExcerpts(store, cfg.extraSceneIds),
  ]);

  return {
    sceneTitle,
    sceneExcerpt,
    sceneExcerptTruncated,
    extraScenes,
    entitySummaries,
    about,
    selectionText: selectionText ?? null,
    boundaryLine: buildBoundaryLine(cfg.boundary),
  };
}
