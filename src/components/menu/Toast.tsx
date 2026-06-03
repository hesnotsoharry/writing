import { useEffect } from "react";

import { Icon } from "../Icon";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ToastDescriptor {
  label: string;
  /** Whether to show an Undo button alongside the dismiss button. */
  undo?: boolean;
}

export interface ToastProps {
  toast: ToastDescriptor | null;
  onUndo: () => void;
  onClose: () => void;
}

// ── Toast ──────────────────────────────────────────────────────────────────

/** Auto-dismissing notification bar. Calls `onClose` after 5 000 ms. */
export function Toast({ toast, onUndo, onClose }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onClose, 5000);
    return () => clearTimeout(id);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="toast-wrap">
      <div className="toast">
        <span>{toast.label}</span>
        {toast.undo && (
          <button className="undo" onClick={onUndo}>
            Undo
          </button>
        )}
        <button className="tx" onClick={onClose}>
          <Icon name="x" style={{ width: 13, height: 13 }} />
        </button>
      </div>
    </div>
  );
}
