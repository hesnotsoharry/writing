import type { GrammarSuggestion } from "../../lib/ipc";

/**
 * Unified result type shared by the spelling engine (Phase 1) and the grammar
 * IPC bridge (Phase 4+). Decorations are keyed on `type` — "spelling" paints
 * `spell-error`, "grammar" paints `grammar-error`.
 */
export interface CheckResult {
  /** Absolute ProseMirror position of the first character of the flagged range. */
  from: number;
  /** Absolute ProseMirror position immediately after the last character. */
  to: number;
  /** Which engine flagged this — determines decoration CSS class and popover copy. */
  type: "spelling" | "grammar" | "style";
  /** Human-readable explanation shown in the popover header. */
  message: string;
  /**
   * Replacement suggestions for the popover list. Spelling leaves this `[]` —
   * the popover computes nspell suggestions live. Grammar carries typed
   * GrammarSuggestion objects from the IPC result (Decision F).
   */
  suggestions: GrammarSuggestion[];
}
