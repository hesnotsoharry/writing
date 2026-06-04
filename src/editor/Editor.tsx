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
    editorProps: {
      attributes: { class: "prose" },
    },
  });

  return (
    <div className="canvas-scroll">
      <div className="canvas-wrap">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
