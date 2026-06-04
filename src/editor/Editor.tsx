import "./proofread.css";

import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { type MutableRefObject,useCallback, useEffect } from "react";
import * as Y from "yjs";

import type { BinderTree } from "../binder/buildTree";
import type { SqliteStoryBibleStore } from "../db/sqliteStoryBibleStore";
import { normalizeStatus, STATUS_META } from "../lib/status";
import { EditorHeader } from "./EditorHeader";
import ProofreadExtension from "./extensions/ProofreadExtension";
import { FormatBubble } from "./FormatBubble";
import { SpellCheckPopover, useSpellCheckPopover } from "./SpellCheckPopover";
import { useLiveWordCount } from "./useLiveWordCount";
import type { FlipState, LeafContent } from "./usePageFlip";
import { findSceneWithChapter } from "./usePageFlip";
import { useSceneLinkCounts } from "./useSceneLinkCounts";

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
  flip: FlipState | null;
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

// ---------------------------------------------------------------------------
// Hook — bundles TipTap + spell-popover setup. Page-flip lives in EditorPane
// (App.content.tsx) so it survives the doc=null unmount/remount on scene switch.
// ---------------------------------------------------------------------------

interface EditorCoreState {
  editor: ReturnType<typeof useEditor>;
  visible: boolean;
  popoverProps: ReturnType<typeof useSpellCheckPopover>["popoverProps"];
}

/**
 * useEditorCore — sets up TipTap, spell-check popover, and registers
 * `captureProse` into the ref provided by the parent (EditorPane) so the
 * page-flip can snapshot the outgoing prose even after a re-render cycle.
 */
function useEditorCore(
  doc: Y.Doc,
  captureProseRef: MutableRefObject<() => string>,
): EditorCoreState {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc, field: "content" }),
      ProofreadExtension,
    ],
    editorProps: { attributes: { class: "prose" } },
  });
  const { visible, popoverProps } = useSpellCheckPopover(editor);
  const captureProse = useCallback(
    () => editor?.view?.dom?.innerHTML ?? "",
    [editor],
  );
  // Keep the shared ref in sync with the latest captureProse callback so
  // EditorPane's usePageFlip always snapshots the current editor DOM.
  // useEffect (not inline) to avoid writing to a ref during render.
  useEffect(() => {
    captureProseRef.current = captureProse;
  }, [captureProse, captureProseRef]);
  return { editor, visible, popoverProps };
}

// ---------------------------------------------------------------------------
// CanvasWrap — inner .canvas-wrap content (extracted to keep Editor ≤40 lines)
// ---------------------------------------------------------------------------

function CanvasWrap({
  editor,
  activeScene,
  liveWords,
  characters,
  locations,
  visible,
  popoverProps,
}: {
  editor: ReturnType<typeof useEditor>;
  activeScene: ReturnType<typeof findSceneWithChapter>;
  liveWords: number;
  characters: number;
  locations: number;
  visible: boolean;
  popoverProps: ReturnType<typeof useSpellCheckPopover>["popoverProps"];
}) {
  return (
    <div className="canvas-wrap">
      {activeScene && (
        <EditorHeader
          chapterTitle={activeScene.chapterTitle}
          title={activeScene.scene.title}
          status={normalizeStatus(activeScene.scene.status)}
          words={liveWords}
          characters={characters}
          locations={locations}
        />
      )}
      <EditorContent editor={editor} className="editor-content-mount" />
      {editor && <FormatBubble editor={editor} />}
      {visible && <SpellCheckPopover {...popoverProps} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Editor({
  doc,
  tree,
  selectedSceneId,
  storyBibleStore,
  linksVersion,
  flip,
  onAnimationEnd,
  captureProseRef,
}: {
  doc: Y.Doc;
  tree: BinderTree;
  selectedSceneId: string | null;
  storyBibleStore: SqliteStoryBibleStore;
  linksVersion: number;
  flip: FlipState | null;
  onAnimationEnd: (key: number) => void;
  captureProseRef: MutableRefObject<() => string>;
}) {
  const { editor, visible, popoverProps } =
    useEditorCore(doc, captureProseRef);
  const liveWords = useLiveWordCount(doc);
  const { characters, locations } = useSceneLinkCounts(storyBibleStore, selectedSceneId, linksVersion);
  const activeScene = findSceneWithChapter(tree, selectedSceneId);
  return (
    <div className="canvas-scroll">
      <CanvasWrap
        editor={editor}
        activeScene={activeScene}
        liveWords={liveWords}
        characters={characters}
        locations={locations}
        visible={visible}
        popoverProps={popoverProps}
      />
      {flip && <PageFlipLeaf key={flip.key} flip={flip} onAnimationEnd={onAnimationEnd} />}
    </div>
  );
}
