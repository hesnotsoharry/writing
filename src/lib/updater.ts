import { check, type Update } from "@tauri-apps/plugin-updater";
import { useEffect, useRef } from "react";

export type UpdateCheckResult = "upToDate" | "found" | "checkError" | "installError";
// "installError" is surfaced via UpdateModal's onInstallError callback;
// runUpdateCheck no longer returns it. Kept in the union for API stability.

export type { Update };

/**
 * Check for an app update. If one is found, calls onUpdateFound with the
 * Update object instead of prompting natively. Returns "found" | "upToDate" |
 * "checkError". "installError" is now modal-owned (see UpdateModal).
 * Never throws. Safe to call in non-Tauri contexts.
 */
export async function runUpdateCheck(
  onUpdateFound?: (update: Update) => void,
): Promise<UpdateCheckResult> {
  let update;
  try {
    update = await check();
  } catch (err) {
    console.error("[updater] check failed", err);
    return "checkError";
  }
  if (!update) return "upToDate";
  onUpdateFound?.(update);
  return "found";
}

/**
 * Run a one-time silent update check on app startup.
 * StrictMode-safe: hasCheckedRef ensures the check fires only once
 * even when React double-invokes effects in development mode.
 * No state is set synchronously in the effect body.
 */
export function useStartupUpdateCheck(
  onUpdateFound: (update: Update) => void,
): void {
  const hasCheckedRef = useRef(false);
  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    // onUpdateFound is state.setPendingUpdate — a stable React dispatch reference.
    // Empty deps are intentional: startup-only gate, runs at most once per mount.
    void runUpdateCheck(onUpdateFound);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
