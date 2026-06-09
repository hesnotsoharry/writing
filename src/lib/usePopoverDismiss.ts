import type { RefObject } from "react";
import { useEffect } from "react";

/**
 * Attaches document-level listeners that close a popover when the user
 * clicks outside it or presses Escape.  Cleans up on unmount.
 *
 * Shared by SpellCheckPopover and QuickCapture — extracted from the inline
 * copy that lived in SpellCheckPopover (wave-29 cluster E).
 */
export function usePopoverDismiss(
  ref: RefObject<HTMLDivElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    function onPointer(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [onClose, ref]);
}
