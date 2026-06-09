/**
 * Auto-snapshot wiring — scene-leave and app-close triggers.
 * Extracted from App.tsx to stay within the 300-line file limit.
 */
import { useCallback, useEffect } from "react";
import * as Y from "yjs";

import { snapAutoCapture } from "./App.snapshots";

/**
 * Register a Tauri onCloseRequested handler.
 * onCloseRequested awaits async handlers before calling destroy(), so the
 * snapshot write completes before the window is destroyed.
 * Returns the unlisten fn, or null when outside a Tauri context.
 */
async function registerTauriCloseSnap(
  handler: () => Promise<void>,
): Promise<(() => void) | null> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return await getCurrentWindow().onCloseRequested(async () => {
      await handler();
    });
  } catch {
    return null; // dev browser — no Tauri context
  }
}

/**
 * Combined auto-snapshot hook for two boundaries:
 *
 *   Scene nav-away — wraps handleSelectScene so the LEAVING scene's content
 *   is snapshotted before the new scene loads. Uses the leaving scene's id
 *   captured at call time (not the new scene's id — Fix 2 discipline).
 *
 *   App close — registers Tauri onCloseRequested (async, fully awaited) and a
 *   beforeunload fallback (fire-and-forget; async write may not complete before
 *   process exit — known limitation).
 *
 * Both paths call snapAutoCapture which skips the DB write when content is
 * unchanged since the last snapshot (dedup). Prune (Fix 4) is separate.
 *
 * Returns a wrapped handleSelectScene that callers should use in place of the
 * original. Re-created each render alongside handleSelectScene itself.
 */
export function useAutoSnapHooks(
  selectedSceneId: string | null,
  doc: Y.Doc | null,
  handleSelectScene: (sceneId: string) => void,
): (sceneId: string) => void {
  const handleSnap = useCallback(async () => {
    if (selectedSceneId && doc) {
      await snapAutoCapture({ sceneId: selectedSceneId, doc })
        .catch((e: unknown) => console.error("[auto-snap] app-close failed", e));
    }
  }, [selectedSceneId, doc]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    void registerTauriCloseSnap(handleSnap).then((fn) => {
      if (cancelled) { fn?.(); } else { unlisten = fn; }
    });
    function onBeforeUnload() { void handleSnap(); }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      cancelled = true;
      unlisten?.();
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [handleSnap]);

  return function handleWithAutoSnap(newSceneId: string): void {
    if (selectedSceneId && doc && selectedSceneId !== newSceneId) {
      void snapAutoCapture({ sceneId: selectedSceneId, doc }).catch(
        (e: unknown) => console.error("[auto-snap] scene-leave failed", e),
      );
    }
    handleSelectScene(newSceneId);
  };
}
