import "./proofread.css";

import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent,useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback } from "react";
import * as Y from "yjs";

import type { AppView } from "../App.state";
import type { BinderTree } from "../binder/buildTree";
import type { SqliteStoryBibleStore } from "../db/sqliteStoryBibleStore";
import { STATUS_META } from "../lib/status";
import ProofreadExtension from "./extensions/ProofreadExtension";
import { SpellCheckPopover, useSpellCheckPopover } from "./SpellCheckPopover";
import type { LeafContent } from "./usePageFlip";
import { usePageFlip } from "./usePageFlip";

/**
 * LeafPage — renders the outgoing scene metadata on the turning leaf's front face.
 * Mirrors design-reference/shell.jsx:3-17 (LeafPage canon shape).
 * dangerouslySetInnerHTML is acceptable here: the source is our own TipTap editor
 * DOM, not external user input.
 */
function LeafPage({ content }: { content: LeafContent | null }) {
  if (!content) return <div className="leaf-page" />;
  const meta = STATUS_META[content.status];
  const dotColor = meta.dot === "var(--ink-4)" ? "var(--ink-3)" : meta.dot;
  return (
    <div className="leaf-page">
      <div className="scene-eyebrow">
        <span>{content.chapterTitle}</span>
        <span className="sep" />
        <span style={{ color: dotColor }}>{meta.label}</span>
      </div>
      <h1 className="scene-h1">{content.title}</h1>
      <div className="scene-byline">
        <span>{content.words.toLocaleString()} words</span>
      </div>
      {content.proseHTML
        ? <div className="prose" dangerouslySetInnerHTML={{ __html: content.proseHTML }} />
        : null}
    </div>
  );
}

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
          <LeafPage content={flip.outgoing} />
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

  // Snapshot the outgoing scene's rendered HTML just before the swap.
  // Reads the editor's live DOM at effect-run time — see timing caveat in usePageFlip.ts.
  const captureProse = useCallback(
    () => editor?.view?.dom?.innerHTML ?? "",
    [editor],
  );

  const { flip, onAnimationEnd } = usePageFlip({ selectedSceneId, tree, view, captureProse });

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
