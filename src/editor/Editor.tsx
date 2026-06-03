import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent,useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import * as Y from "yjs";

export function Editor({ doc }: { doc: Y.Doc }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc, field: "content" }),
    ],
  });

  return (
    <div style={{ maxWidth: 720, margin: "48px auto", padding: "0 24px" }}>
      <EditorContent editor={editor} />
    </div>
  );
}
