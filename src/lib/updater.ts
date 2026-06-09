import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { useEffect, useRef } from "react";

export type UpdateCheckResult = "upToDate" | "found" | "checkError" | "installError";

/**
 * Check for an app update. If one is available, ask the user and install.
 * Never throws — errors are caught and returned, with the failing stage kept
 * distinct ("checkError" vs "installError") so the UI doesn't report an
 * install-stage failure as "couldn't check" (which hid the v0.2.2
 * dialog:allow-ask permission bug). Safe to call in non-Tauri contexts.
 */
export async function runUpdateCheck(): Promise<UpdateCheckResult> {
  let update;
  try {
    update = await check();
  } catch (err) {
    console.error("[updater] check failed", err);
    return "checkError";
  }
  if (!update) return "upToDate";
  try {
    const label = update.version ?? "a newer version";
    const yes = await ask(
      `Version ${label} is available. Install and restart now?`,
      { title: "Update available", kind: "info" },
    );
    if (yes) {
      await update.downloadAndInstall();
      await relaunch();
    }
    return "found";
  } catch (err) {
    console.error("[updater] prompt/install failed", err);
    return "installError";
  }
}

/**
 * Run a one-time silent update check on app startup.
 * StrictMode-safe: hasCheckedRef ensures the check fires only once
 * even when React double-invokes effects in development mode.
 * No state is set synchronously in the effect body.
 */
export function useStartupUpdateCheck(): void {
  const hasCheckedRef = useRef(false);
  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    void runUpdateCheck();
  }, []);
}
