/**
 * AssistantPanel.slot.ts — AiSlot-specific state handlers (Wave 35 Phase H).
 * Not part of the public module boundary; consumed only by AssistantPanel.tsx.
 */
import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from "react";

import { QUICK_NOTES_CHANGED_EVENT } from "../../lib/settings";
import { SqliteQuickNoteStore } from "../quickcapture/SqliteQuickNoteStore";
import { AI_REPLAY_EVENT, setStoredTweak } from "../settings/settings.store";

/** Saves body to quick notes or falls back to clipboard when no project is active. */
async function saveOrCopyNote(
  body: string,
  projectId: string | null,
  onToast: (msg: string) => void,
): Promise<void> {
  if (!projectId) {
    try {
      await navigator.clipboard.writeText(body);
      onToast("Copied to clipboard");
    } catch {
      onToast("Couldn't copy to clipboard");
    }
    return;
  }
  const store = new SqliteQuickNoteStore();
  try {
    await store.create(projectId, body);
    window.dispatchEvent(new CustomEvent(QUICK_NOTES_CHANGED_EVENT));
    onToast("Saved to notes");
  } catch {
    onToast("Couldn't save the note");
  }
}

export function useAiSlotHandlers(
  projectId: string | null,
  setOverlay: Dispatch<SetStateAction<"consent" | "context" | null>>,
  setInspTab: Dispatch<SetStateAction<"scene" | "assistant">>,
) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onToast = useCallback((msg: string) => {
    if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);
  const onSaveNote = useCallback(
    (body: string) => { void saveOrCopyNote(body, projectId, onToast); },
    [projectId, onToast],
  );
  const handleEnable = useCallback(() => {
    setStoredTweak("aiConsentGiven", true);
    setStoredTweak("aiEnabled", true);
    setOverlay(null);
    setInspTab("assistant");
  }, [setOverlay, setInspTab]);
  useEffect(() => {
    const h = () => { setOverlay("consent"); };
    window.addEventListener(AI_REPLAY_EVENT, h);
    return () => window.removeEventListener(AI_REPLAY_EVENT, h);
  }, [setOverlay]);
  return { toast, onToast, onSaveNote, handleEnable };
}
