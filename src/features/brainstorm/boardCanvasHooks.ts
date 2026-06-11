/**
 * boardCanvasHooks — Phase 6 promote callbacks extracted from BoardCanvas.tsx
 * to keep BoardCanvas.tsx under the 300-line file limit.
 *
 * Exports:
 *   - DocToNodesCallbacks  (interface — also holds `tree` for label resolution)
 *   - resolveDestLabel     (pure helper used by docToNodes)
 *   - BoardCallbacksParams (interface for useBoardCallbacks)
 *   - useBoardCallbacks    (hook — wires promote + navigation into callbacksRef)
 */
import { useCallback, useEffect, useRef } from "react";
import * as Y from "yjs";

import type { AppView } from "../../App.state";
import type { BinderTree } from "../../binder/buildTree";
import type { SceneDocStore } from "../../db/sceneDocStore";
import { SqliteBinderStore } from "../../db/sqliteBinderStore";
import type { Entity, StoryBibleStore } from "../../db/storyBibleStore";
import { noteBodyToSceneDoc } from "../quickcapture/promoteNoteToScene";
import { clearCardGraduation, getCardText, markCardGraduated } from "./boardDoc";

// ── Module-level promote store ─────────────────────────────────────────────────

const binderStore = new SqliteBinderStore();

// ── DocToNodesCallbacks ───────────────────────────────────────────────────────

/**
 * Callbacks + binder tree bundled for docToNodes — updated via callbacksRef.
 * Including `tree` here (rather than as a separate param) keeps docToNodes at
 * 4 params or fewer (max-params: 4 constraint).
 */
export interface DocToNodesCallbacks {
  tree: BinderTree | undefined;
  onSendToScene?: (cardId: string) => void;
  onPromoteToScene?: (cardId: string) => void;
  onPromoteToEntity?: (cardId: string, entityType: string) => void;
  onNavigateToDestination?: (kind: "scene" | "entity", id: string) => void;
  /** F7: restore a graduated card to editable state. */
  onClearGraduation?: (cardId: string) => void;
}

// ── resolveDestLabel ──────────────────────────────────────────────────────────

/** Resolve a human-readable label for a graduated card's destination. */
export function resolveDestLabel(
  meta: { graduated?: boolean; destinationKind?: "scene" | "entity"; destinationId?: string },
  entities: Entity[],
  tree: BinderTree | undefined,
): string | undefined {
  if (!meta.graduated || !meta.destinationId) return undefined;
  if (meta.destinationKind === "scene") {
    const scenes = tree ? [...tree.chapters.flatMap((ch) => ch.scenes), ...tree.shortPieces] : [];
    return scenes.find((s) => s.id === meta.destinationId)?.title ?? "Scene";
  }
  if (meta.destinationKind === "entity") {
    return entities.find((e) => e.id === meta.destinationId)?.name ?? "Entity";
  }
  return undefined;
}

// ── createEntityByType ────────────────────────────────────────────────────────

interface CreateEntitySpec {
  projectId: string;
  type: string;
  name: string;
  notes: string | null;
}

async function createEntityByType(
  store: StoryBibleStore,
  { projectId, type, name, notes }: CreateEntitySpec,
): Promise<{ id: string }> {
  if (type === "character") return store.createCharacter(projectId, name, notes);
  if (type === "location") return store.createLocation(projectId, name, notes);
  return store.createEntity(projectId, type, name, notes);
}

// ── usePromote ────────────────────────────────────────────────────────────────

interface UsePromoteParams {
  doc: Y.Doc; sceneDocStore: SceneDocStore; storyBibleStore?: StoryBibleStore;
  projectId?: string; onTreeChanged?: () => void; onSelectScene?: (id: string) => void;
  onViewChange?: (view: AppView) => void; onOpenEntry?: (id: string, kind: string) => void;
}

function usePromote({
  doc, sceneDocStore, storyBibleStore, projectId, onTreeChanged, onSelectScene, onViewChange, onOpenEntry,
}: UsePromoteParams) {
  const handlePromoteToScene = useCallback((cardId: string) => {
    if (!projectId) return;
    const text = getCardText(doc, cardId);
    const title = text.split("\n")[0].slice(0, 40) || "New Scene";
    binderStore.createScene({ projectId, folderId: null, title })
      .then(async (sceneId) => {
        await sceneDocStore.save(sceneId, noteBodyToSceneDoc(text), null);
        markCardGraduated(doc, cardId, { kind: "scene", id: sceneId });
        onTreeChanged?.();
        onSelectScene?.(sceneId);
        onViewChange?.("editor");
      })
      .catch((e: unknown) => console.error("[BoardCanvas] promoteToScene failed", e));
  }, [doc, sceneDocStore, projectId, onTreeChanged, onSelectScene, onViewChange]);
  const handlePromoteToEntity = useCallback((cardId: string, entityType: string) => {
    if (!storyBibleStore || !projectId) return;
    const text = getCardText(doc, cardId);
    const lines = text.split("\n");
    const name = lines[0].slice(0, 120) || "New Entity";
    // Card body (after the name line) carries over as the entity's notes — provenance.
    const notes = lines.slice(1).join("\n").trim() || null;
    createEntityByType(storyBibleStore, { projectId, type: entityType, name, notes })
      .then((entity) => {
        markCardGraduated(doc, cardId, { kind: "entity", id: entity.id });
        window.dispatchEvent(new Event("focus"));
        onOpenEntry?.(entity.id, entityType);
      })
      .catch((e: unknown) => console.error("[BoardCanvas] promoteToEntity failed", e));
  }, [doc, storyBibleStore, projectId, onOpenEntry]);
  return { handlePromoteToScene, handlePromoteToEntity };
}

// ── useBoardCallbacks ─────────────────────────────────────────────────────────

export interface BoardCallbacksParams {
  doc: Y.Doc; sceneDocStore: SceneDocStore; storyBibleStore?: StoryBibleStore;
  projectId?: string; tree?: BinderTree;
  onSendToSceneRef: { current: ((cardId: string) => void) | undefined };
  entitiesRef: { current: Entity[] };
  onSelectScene?: (sceneId: string) => void; onOpenEntry?: (id: string, kind: string) => void;
  onViewChange?: (view: AppView) => void; onTreeChanged?: () => void;
}

export function useBoardCallbacks({
  doc, sceneDocStore, storyBibleStore, projectId, tree, onSendToSceneRef, entitiesRef,
  onSelectScene, onOpenEntry, onViewChange, onTreeChanged,
}: BoardCallbacksParams) {
  const callbacksRef = useRef<DocToNodesCallbacks>({ tree: undefined });
  const { handlePromoteToScene, handlePromoteToEntity } = usePromote({
    doc, sceneDocStore, storyBibleStore, projectId, onTreeChanged, onSelectScene, onViewChange, onOpenEntry,
  });
  const handleNavigateToDestination = useCallback(
    (kind: "scene" | "entity", id: string) => {
      if (kind === "scene") { onSelectScene?.(id); onViewChange?.("editor"); }
      else {
        const entityType = entitiesRef.current.find((e) => e.id === id)?.type ?? "character";
        onOpenEntry?.(id, entityType);
      }
    },
    [onSelectScene, onViewChange, onOpenEntry, entitiesRef],
  );
  const handleClearGraduation = useCallback(
    (cardId: string) => { clearCardGraduation(doc, cardId); },
    [doc],
  );
  useEffect(() => {
    callbacksRef.current = {
      tree,
      onSendToScene: onSendToSceneRef.current,
      onPromoteToScene: handlePromoteToScene,
      onPromoteToEntity: handlePromoteToEntity,
      onNavigateToDestination: handleNavigateToDestination,
      onClearGraduation: handleClearGraduation,
    };
  }, [tree, onSendToSceneRef, handlePromoteToScene, handlePromoteToEntity,
    handleNavigateToDestination, handleClearGraduation]);
  return { callbacksRef };
}
