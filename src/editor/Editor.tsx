import "./proofread.css";

import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent,useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import * as Y from "yjs";

import ProofreadExtension from "./extensions/ProofreadExtension";
import { SpellCheckPopover, useSpellCheckPopover } from "./SpellCheckPopover";

export function Editor({ doc }: { doc: Y.Doc }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc, field: "content" }),
      ProofreadExtension,
    ],
    editorProps: {
      attributes: { class: "prose" },
    },
  });

  const { visible, popoverProps } = useSpellCheckPopover(editor);

  return (
    <div className="canvas-scroll">
      <div className="canvas-wrap">
        <EditorContent editor={editor} />
        {visible && <SpellCheckPopover {...popoverProps} />}
      </div>
    </div>
  );
}
