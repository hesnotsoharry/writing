/**
 * Minimal toast context for binder components.
 *
 * Provides a `useBinderToast()` hook that returns a `(message: string) => void`
 * fire-and-forget function. The corresponding `<BinderToastProvider>` mounts in
 * Binder.tsx in Phase 3; this phase only wires the context so components compile
 * and tests pass without a provider in scope.
 *
 * The context default is a no-op so `useBinderToast()` is safe in environments
 * where no provider is mounted (e.g. isolated unit tests).
 */
import { createContext, useContext, useState } from "react";

import type { ToastDescriptor } from "../components/menu/Toast";
import { Toast } from "../components/menu/Toast";

// ── Context ────────────────────────────────────────────────────────────────

type ShowToast = (message: string) => void;

const BinderToastContext = createContext<ShowToast>(() => {});

// ── Provider ───────────────────────────────────────────────────────────────

interface BinderToastProviderProps {
  children: React.ReactNode;
}

export function BinderToastProvider({ children }: BinderToastProviderProps) {
  const [toast, setToast] = useState<ToastDescriptor | null>(null);

  function showToast(message: string) {
    setToast({ label: message });
  }

  function handleClose() {
    setToast(null);
  }

  return (
    <BinderToastContext.Provider value={showToast}>
      {children}
      <Toast toast={toast} onUndo={handleClose} onClose={handleClose} />
    </BinderToastContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

/** Returns a function that shows a brief toast notification. */
export function useBinderToast(): ShowToast {
  return useContext(BinderToastContext);
}
