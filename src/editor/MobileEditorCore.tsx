import type { Editor } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import Highlight from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type * as Y from "yjs";

import AiExcludeExtension from "./extensions/AiExcludeExtension";
import DropCapGate from "./extensions/DropCapGate";

export interface MobileEditorCoreProps {
  doc: Y.Doc;
  editable: boolean;
  onReady?: (editor: Editor) => void;
  onUpdate?: (editor: Editor) => void;
  onDestroy?: () => void;
}

export function buildMobileEditorExtensions(doc: Y.Doc) {
  return [
    StarterKit.configure({ undoRedo: false }),
    Collaboration.configure({ document: doc, field: "content" }),
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({ emptyEditorClass: "is-editor-empty" }),
    AiExcludeExtension,
    DropCapGate,
  ];
}

export function MobileEditorCore({
  doc,
  editable,
  onReady,
  onUpdate,
  onDestroy,
}: MobileEditorCoreProps) {
  const editor = useEditor({
    extensions: buildMobileEditorExtensions(doc),
    editable,
    editorProps: { attributes: { class: "prose" } },
    onCreate: ({ editor: readyEditor }) => onReady?.(readyEditor),
    onUpdate: ({ editor: updatedEditor }) => onUpdate?.(updatedEditor),
    onDestroy: () => onDestroy?.(),
  });

  return <EditorContent editor={editor} className="editor-content-mount" />;
}
