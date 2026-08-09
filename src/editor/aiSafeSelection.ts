import type { EditorView } from "@tiptap/pm/view";

export * from "./aiSafeSelectionCore";

export const activeEditorRef: { current: EditorView | null } = { current: null };
