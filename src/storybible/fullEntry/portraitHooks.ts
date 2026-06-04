/**
 * Portrait state and flow hooks for FullEntry.
 * Kept in a separate file so FullEntry.tsx stays under the 300-line limit.
 */

import { useState } from "react";

import type { EntityWithPortrait, StoryBibleStore } from "../../db/storyBibleStore";
import { deletePortraitFile, pickAndSavePortrait } from "./portraitService";

// ── usePortraitState ──────────────────────────────────────────────────────────

/**
 * Manages the local portraitPath state for the hero.
 * Seeded from initialPath at first render. The call site must supply a
 * `key={entity.id}` on FullEntry so the state resets when the entity changes
 * (avoids setState-in-effect, which the project lint forbids).
 */
export function usePortraitState(initialPath: string | null) {
  const [portraitPath, setPortraitPath] = useState<string | null>(initialPath);
  return { portraitPath, setPortraitPath };
}

// ── usePortraitFlows ──────────────────────────────────────────────────────────

export interface PortraitFlowOpts {
  entity: EntityWithPortrait;
  storeType: "character" | "location";
  store: StoryBibleStore | undefined;
  portraitPath: string | null;
  setPortraitPath: (p: string | null) => void;
}

/**
 * Returns portrait-flow callbacks, all guarded against absent store.
 * kind→type mapping is done by the caller before passing storeType.
 */
export function usePortraitFlows(opts: PortraitFlowOpts) {
  const { entity, storeType, store, portraitPath, setPortraitPath } = opts;

  async function handlePortraitAdd() {
    if (!store) return;
    const path = await pickAndSavePortrait(entity.id);
    if (path === null) return; // user cancelled
    await store.setPortrait(storeType, entity.id, path);
    setPortraitPath(path);
  }

  async function handlePortraitRemove() {
    if (!store) return;
    const oldPath = portraitPath;
    await store.clearPortrait(storeType, entity.id);
    setPortraitPath(null);
    if (oldPath) await deletePortraitFile(oldPath);
  }

  async function handlePortraitError() {
    if (!store) return;
    // Stale file — already gone; clear the DB path only, do NOT unlink.
    await store.clearPortrait(storeType, entity.id);
    setPortraitPath(null);
  }

  return { handlePortraitAdd, handlePortraitRemove, handlePortraitError };
}
