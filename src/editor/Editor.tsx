import "./proofread.css";

import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { type MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";

import type { BinderTree } from "../binder/buildTree";
import type { SqliteStoryBibleStore } from "../db/sqliteStoryBibleStore";
import type { AlIndex } from "../lib/alBuildIndex";
import { alBuildIndex } from "../lib/alBuildIndex";
import { readBoolSetting } from "../lib/settings";
import { normalizeStatus, STATUS_META } from "../lib/status";
import { AutoLinkPeek } from "../storybible/AutoLinkPeek";
import { EditorHeader } from "./EditorHeader";
import AutoLinkExtension, { autolinkKey } from "./extensions/AutoLink";
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

const AUTOLINK_SETTING = "writing.autolinkOn";
const DEFAULT_AUTOLINK_TYPES = ["character", "location", "item", "faction", "lore"];

/**
 * useEditorCore — sets up TipTap, spell-check popover, and registers
 * `captureProse` into the ref provided by the parent (EditorPane) so the
 * page-flip can snapshot the outgoing prose even after a re-render cycle.
 */
function useEditorCore(
  doc: Y.Doc,
  captureProseRef: MutableRefObject<() => string>,
  alIndex: AlIndex | null,
): EditorCoreState {
  const autolinkOn = readBoolSetting(AUTOLINK_SETTING, true);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc, field: "content" }),
      ProofreadExtension,
      AutoLinkExtension.configure({
        alIndex,
        autolinkOn,
        autolinkTypes: DEFAULT_AUTOLINK_TYPES,
      }),
    ],
    editorProps: { attributes: { class: "prose" } },
  });

  // When alIndex changes (linksVersion bump), dispatch a meta transaction so
  // the autolink plugin rebuilds its DecorationSet without tearing down the editor.
  useEffect(() => {
    if (!editor) return;
    const newConfig = { alIndex, autolinkOn, autolinkTypes: DEFAULT_AUTOLINK_TYPES };
    editor.view.dispatch(editor.state.tr.setMeta(autolinkKey, newConfig));
  // autolinkOn is read synchronously from localStorage; alIndex identity changes
  // when linksVersion bumps. editor identity only changes on doc swap.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, alIndex]);

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
// useFocusEditorEffects — typewriter scroll + paragraph dimming (decoration only)
// ---------------------------------------------------------------------------

function resolveAnchorEl(sel: Selection): Element | null {
  const anchor = sel.anchorNode;
  if (!anchor) return null;
  return anchor.nodeType === Node.TEXT_NODE
    ? anchor.parentElement
    : (anchor as Element);
}

function applyDimFocus(el: Element, prevRef: React.MutableRefObject<Element | null>) {
  const para = el.closest ? el.closest(".prose p") : null;
  if (para === prevRef.current) return;
  if (prevRef.current) prevRef.current.removeAttribute("data-focused");
  if (para) (para as HTMLElement).setAttribute("data-focused", "");
  prevRef.current = para;
}

/**
 * Attaches a `selectionchange` listener when focus mode is active.
 * Typewriter scroll: respects `prefers-reduced-motion`.
 * Paragraph dimming: adds `data-focused` to the cursor paragraph.
 * Neither effect mutates the Yjs doc or TipTap schema.
 */
function useFocusEditorEffects(focusMode: boolean, typewriterOn: boolean, dimOn: boolean) {
  const prevFocusedParaRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!focusMode || (!typewriterOn && !dimOn)) return;
    const prefersReduced = (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) ?? false;

    function handleSelection() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const el = resolveAnchorEl(sel);
      if (!el) return;
      if (typewriterOn) {
        el.scrollIntoView({ block: "center", behavior: prefersReduced ? "auto" : "smooth" });
      }
      if (dimOn) applyDimFocus(el, prevFocusedParaRef);
    }

    document.addEventListener("selectionchange", handleSelection);
    return () => {
      document.removeEventListener("selectionchange", handleSelection);
      if (prevFocusedParaRef.current) {
        prevFocusedParaRef.current.removeAttribute("data-focused");
        prevFocusedParaRef.current = null;
      }
    };
  }, [focusMode, typewriterOn, dimOn]);
}

// ---------------------------------------------------------------------------
// Hover peek state for auto-linked spans.
// ---------------------------------------------------------------------------

interface AlPeekState {
  entityId: string;
  entityType: string;
  anchorEl: HTMLElement;
}

function useAutoLinkHover() {
  const [peek, setPeek] = useState<AlPeekState | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearLeaveTimer() {
    if (leaveTimerRef.current !== null) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }

  function handleMouseOver(e: React.MouseEvent<HTMLDivElement>) {
    const target = (e.target as HTMLElement).closest
      ? (e.target as HTMLElement).closest<HTMLElement>(".al-link")
      : null;
    if (!target) return;
    const entityId = target.getAttribute("data-entity-id");
    const entityType = target.getAttribute("data-entity-type");
    if (!entityId || !entityType) return;
    clearLeaveTimer();
    // 230ms intent delay (mirrors autolink.jsx).
    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null;
      setPeek({ entityId, entityType, anchorEl: target });
    }, 230);
  }

  function handleMouseOut(e: React.MouseEvent<HTMLDivElement>) {
    const related = e.relatedTarget as HTMLElement | null;
    // If the mouse moved to a .al-peek child, the peek's own onMouseLeave handles close.
    if (related?.closest?.(".al-peek")) return;
    clearLeaveTimer();
    // Short delay so the mouse can travel from span to card without flickering.
    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null;
      setPeek(null);
    }, 120);
  }

  function closePeek() {
    clearLeaveTimer();
    setPeek(null);
  }

  return { peek, handleMouseOver, handleMouseOut, closePeek };
}

// ---------------------------------------------------------------------------
// CanvasWrap — inner .canvas-wrap content (extracted to keep Editor ≤40 lines)
// ---------------------------------------------------------------------------

interface CanvasWrapProps {
  editor: ReturnType<typeof useEditor>;
  activeScene: ReturnType<typeof findSceneWithChapter>;
  liveWords: number;
  characters: number;
  locations: number;
  visible: boolean;
  popoverProps: ReturnType<typeof useSpellCheckPopover>["popoverProps"];
  storyBibleStore: SqliteStoryBibleStore;
  onOpenEntry: (id: string, kind: string) => void;
}

function CanvasWrap({ editor, activeScene, liveWords, characters, locations,
  visible, popoverProps, storyBibleStore, onOpenEntry }: CanvasWrapProps) {
  const { peek, handleMouseOver, handleMouseOut, closePeek } = useAutoLinkHover();
  return (
    <div className="canvas-wrap" onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
      {activeScene && (
        <EditorHeader chapterTitle={activeScene.chapterTitle} title={activeScene.scene.title}
          status={normalizeStatus(activeScene.scene.status)}
          words={liveWords} characters={characters} locations={locations} />
      )}
      <EditorContent editor={editor} className="editor-content-mount" />
      {editor && <FormatBubble editor={editor} />}
      {visible && <SpellCheckPopover {...popoverProps} />}
      {peek && <AutoLinkPeek entityId={peek.entityId} entityType={peek.entityType}
        store={storyBibleStore} anchorEl={peek.anchorEl}
        onOpenEntry={onOpenEntry} onClose={closePeek} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface EditorFocusProps {
  /** Whether focus mode is active — enables typewriter scroll + paragraph dimming. */
  focusMode?: boolean;
  /** Typewriter scroll on (only relevant when focusMode is true). */
  typewriterOn?: boolean;
  /** Paragraph dimming on (only relevant when focusMode is true). */
  dimParagraphsOn?: boolean;
}

interface EditorProps extends EditorFocusProps {
  doc: Y.Doc;
  tree: BinderTree;
  selectedSceneId: string | null;
  storyBibleStore: SqliteStoryBibleStore;
  linksVersion: number;
  flip: FlipState | null;
  onAnimationEnd: (key: number) => void;
  captureProseRef: MutableRefObject<() => string>;
  /** Called when the user clicks "Open entry" in the AutoLinkPeek card. */
  onOpenEntry?: (id: string, kind: string) => void;
  /** Active project id — used to load entities for the AutoLink index. */
  activeProjectId?: string | null;
}

/**
 * useAutoLinkIndex — loads all entities for the active project whenever
 * linksVersion changes and builds an AlIndex for the AutoLink extension.
 * Returns null until the first load completes or when activeProjectId is null.
 */
function useAutoLinkIndex(
  storyBibleStore: SqliteStoryBibleStore,
  activeProjectId: string | null,
  linksVersion: number,
): AlIndex | null {
  const [alIndex, setAlIndex] = useState<AlIndex | null>(null);

  useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    storyBibleStore.listEntities(activeProjectId)
      .then((entities) => {
        if (alive) setAlIndex(alBuildIndex(entities));
      })
      .catch((e: unknown) => {
        console.error("[Editor] useAutoLinkIndex listEntities failed", e);
      });
    return () => { alive = false; };
  }, [storyBibleStore, activeProjectId, linksVersion]);

  return alIndex;
}

export function Editor({
  doc, tree, selectedSceneId, storyBibleStore, linksVersion,
  flip, onAnimationEnd, captureProseRef,
  focusMode = false, typewriterOn = true, dimParagraphsOn = true,
  onOpenEntry, activeProjectId = null,
}: EditorProps) {
  const alIndex = useAutoLinkIndex(storyBibleStore, activeProjectId, linksVersion);
  const { editor, visible, popoverProps } = useEditorCore(doc, captureProseRef, alIndex);
  const liveWords = useLiveWordCount(doc);
  const { characters, locations } = useSceneLinkCounts(storyBibleStore, selectedSceneId, linksVersion);
  const activeScene = findSceneWithChapter(tree, selectedSceneId);
  useFocusEditorEffects(focusMode, typewriterOn, dimParagraphsOn);
  const handleOpenEntry = onOpenEntry ?? (() => undefined);
  return (
    <div className="canvas-scroll">
      <CanvasWrap editor={editor} activeScene={activeScene} liveWords={liveWords}
        characters={characters} locations={locations} visible={visible} popoverProps={popoverProps}
        storyBibleStore={storyBibleStore} onOpenEntry={handleOpenEntry} />
      {flip && <PageFlipLeaf key={flip.key} flip={flip} onAnimationEnd={onAnimationEnd} />}
    </div>
  );
}
