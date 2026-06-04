import "./proofread.css";

import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent,useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import * as Y from "yjs";

import type { AppView } from "../App.state";
import type { BinderTree } from "../binder/buildTree";
import type { SqliteStoryBibleStore } from "../db/sqliteStoryBibleStore";
import ProofreadExtension from "./extensions/ProofreadExtension";
import { SpellCheckPopover, useSpellCheckPopover } from "./SpellCheckPopover";
import { usePageFlip } from "./usePageFlip";

function PageFlipLeaf({
  flip,
  onAnimationEnd,
}: {
  flip: ReturnType<typeof usePageFlip>["flip"];
  onAnimationEnd: (key: number) => void;
}) {
  if (!flip) return null;
  return (
    <div
      className={"page-turn-layer " + flip.dir}
      onAnimationEnd={() => onAnimationEnd(flip.key)}
    >
      <div className="page-turn-cast" />
      <div className="page-leaf">
        <div className="face front">
          <div className="leaf-page" />
          <div className="leaf-shade" />
        </div>
        <div className="face back" />
      </div>
    </div>
  );
}

export function Editor({
  doc,
  view,
  tree,
  selectedSceneId,
  // storyBibleStore and linksVersion consumed in Phase 3 (header/byline).
  // Kept in the type signature now so the prop-pass compiles end-to-end.
}: {
  doc: Y.Doc;
  view: AppView;
  tree: BinderTree;
  selectedSceneId: string | null;
  storyBibleStore: SqliteStoryBibleStore;
  linksVersion: number;
}) {
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
  const { flip, onAnimationEnd } = usePageFlip({ selectedSceneId, tree, view });

  return (
    <div className="canvas-scroll">
      <div className="canvas-wrap">
        <EditorContent editor={editor} />
        {visible && <SpellCheckPopover {...popoverProps} />}
      </div>
      {flip && <PageFlipLeaf key={flip.key} flip={flip} onAnimationEnd={onAnimationEnd} />}
    </div>
  );
}
