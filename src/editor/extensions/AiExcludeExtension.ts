/**
 * AiExcludeExtension — TipTap v3 Mark that tags a prose range as "hidden from AI."
 *
 * The mark is a boolean on/off (no attributes). Rendered as:
 *   <span class="ai-exclude" data-ai-exclude="true">…</span>
 *
 * Phase 2 reads the Yjs delta `attributes.aiExclude` key to detect hidden runs
 * and replace them with `[passage hidden by author]` before the context strip.
 * The mark name MUST stay `aiExclude` — Phase 2 relies on the exact key.
 *
 * Visual treatment: calm muted shading in app.css (.ai-exclude rule).
 * Persists automatically through the Yjs Collaboration extension (Collaboration
 * serialises every TipTap mark into Yjs delta attributes; no extra registration
 * required — Highlight proves the pattern).
 */

import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  // Extend TipTap's Commands interface so TypeScript resolves
  // editor.chain().focus().toggleAiExclude().run() without any-casts.
  interface Commands<ReturnType> {
    aiExclude: {
      /** Mark the selected range as hidden from AI. */
      setAiExclude: () => ReturnType;
      /** Toggle the hidden-from-AI mark on the selected range. */
      toggleAiExclude: () => ReturnType;
      /** Remove the hidden-from-AI mark from the selected range. */
      unsetAiExclude: () => ReturnType;
    };
  }
}

const AiExcludeExtension = Mark.create({
  name: "aiExclude",

  addOptions() {
    return { HTMLAttributes: {} };
  },

  parseHTML() {
    return [{ tag: "span[data-ai-exclude]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "ai-exclude",
        "data-ai-exclude": "true",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setAiExclude:
        () =>
        ({ commands }) =>
          commands.setMark(this.name),
      toggleAiExclude:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
      unsetAiExclude:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

export default AiExcludeExtension;
