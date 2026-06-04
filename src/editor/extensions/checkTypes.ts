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
   * Replacement suggestions for the popover list. For spelling these are plain
   * strings from `nspell.suggest()`. Phase 5 extends grammar to typed
   * GrammarSuggestion objects; for now both paths use strings.
   */
  suggestions: string[];
}
