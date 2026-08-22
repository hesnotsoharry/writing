/**
 * useWhatsNew — post-update "What's new" popup, shown at most once per
 * version. Runs a one-time check on mount (StrictMode-safe via hasRunRef),
 * reads/writes `writing.lastSeenVersion`, and never blocks launch.
 *
 * `blocked` (true while an update-available modal is showing) gates only the
 * *rendering* of the popup, not the underlying decision — if a version's
 * notes are ready while blocked, they simply wait; the popup never stacks on
 * top of UpdateModal.
 */
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useRef, useState } from "react";

import { changelogMarkdown } from "./changelogSource";
import { decideWhatsNew, readLastSeenVersion, writeLastSeenVersion } from "./whatsNew";

export interface WhatsNewState {
  open: boolean;
  version: string | null;
  notes: string | null;
  dismiss: () => void;
}

export function useWhatsNew(blocked: boolean): WhatsNewState {
  const [version, setVersion] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;
    getVersion()
      .then((current) => {
        const decision = decideWhatsNew({
          currentVersion: current,
          lastSeenVersion: readLastSeenVersion(),
          changelogMarkdown,
        });
        if (decision.kind === "storeNow") {
          writeLastSeenVersion(current);
        } else if (decision.kind === "show") {
          setVersion(current);
          setNotes(decision.notes);
        }
      })
      .catch((err: unknown) => console.error("[whatsNew] version check failed", err));
  }, []);

  function dismiss(): void {
    if (version) writeLastSeenVersion(version);
    setVersion(null);
    setNotes(null);
  }

  return { open: notes !== null && !blocked, version, notes, dismiss };
}
