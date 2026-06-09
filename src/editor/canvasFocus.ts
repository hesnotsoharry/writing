import type { Editor } from "@tiptap/react";
import type React from "react";

/**
 * Clicking anywhere on the blank editor panel (the whole .canvas-scroll area —
 * gutters included, not just the page sheet) focuses the editor at end.
 * Guards: clicks inside PM's content DOM are PM's to handle; clicks on
 * interactive UI (buttons, menus, popovers) must not steal focus; and a
 * text-selection drag released over the gutter must not collapse to end.
 */
export function makeCanvasFocusHandler(editor: Editor | null) {
  return (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editor) return;
    const t = e.target as HTMLElement;
    if (editor.view.dom.contains(t)) return;
    if (t.closest("button, input, textarea, [role='menu'], [role='dialog']")) return;
    if (window.getSelection()?.isCollapsed === false) return;
    editor.commands.focus("end");
  };
}
