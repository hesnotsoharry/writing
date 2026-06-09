import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "../../components/Icon";
import { QUICK_NOTES_CHANGED_EVENT } from "../../lib/settings";
import { usePopoverDismiss } from "../../lib/usePopoverDismiss";
import { SqliteQuickNoteStore } from "./SqliteQuickNoteStore";

const defaultStore = new SqliteQuickNoteStore();

interface QuickCaptureProps {
  onClose: () => void;
  activeProjectId: string | null;
  setHasQuickItems: Dispatch<SetStateAction<boolean>>;
  store?: Pick<SqliteQuickNoteStore, "create">;
}

interface QuickCaptureFooterProps {
  canCapture: boolean;
  onClose: () => void;
  onCapture: () => Promise<void>;
}

function QuickCaptureFooter({
  canCapture,
  onClose,
  onCapture,
}: QuickCaptureFooterProps) {
  return (
    <div className="qc-foot">
      <span className="hint">Saves to Quick notes</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          type="button"
          disabled={!canCapture}
          onClick={() => void onCapture()}
        >
          <Icon name="check" className="ic" /> Capture
        </button>
      </div>
    </div>
  );
}

interface UseCaptureHandlerArgs {
  val: string;
  activeProjectId: string | null;
  setHasQuickItems: Dispatch<SetStateAction<boolean>>;
  store: Pick<SqliteQuickNoteStore, "create">;
  onClose: () => void;
}

function useCaptureHandler({
  val,
  activeProjectId,
  setHasQuickItems,
  store,
  onClose,
}: UseCaptureHandlerArgs) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canCapture =
    val.trim().length > 0 && activeProjectId !== null && !isSubmitting;

  async function handleCapture() {
    if (isSubmitting || !canCapture || activeProjectId === null) return;
    setIsSubmitting(true);
    try {
      await store.create(activeProjectId, val.trim());
      setHasQuickItems(true);
      window.dispatchEvent(new CustomEvent(QUICK_NOTES_CHANGED_EVENT));
      onClose();
    } catch (e) {
      console.error("[quickcapture] capture failed", e);
    } finally {
      setIsSubmitting(false);
    }
  }

  return { canCapture, handleCapture };
}

export function QuickCapture({
  onClose,
  activeProjectId,
  setHasQuickItems,
  store = defaultStore,
}: QuickCaptureProps) {
  const [val, setVal] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);
  usePopoverDismiss(popRef, onClose);

  const { canCapture, handleCapture } = useCaptureHandler({
    val, activeProjectId, setHasQuickItems, store, onClose,
  });

  return (
    <div className="qc-pop" ref={popRef}>
      <div className="qc-head">
        <Icon name="zap" className="ic" />
        <span className="t">Quick capture</span>
        <span className="kbd">⌘K</span>
      </div>
      <textarea
        ref={textareaRef}
        className="qc-area"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Jot a stray thought — it lands in this project's inbox, you keep your place…"
      />
      <QuickCaptureFooter
        canCapture={canCapture}
        onClose={onClose}
        onCapture={handleCapture}
      />
    </div>
  );
}
