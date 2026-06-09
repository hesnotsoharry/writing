import "./proofread.css";

import Collaboration from "@tiptap/extension-collaboration";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { type MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as Y from "yjs";

import type { BinderTree } from "../binder/buildTree";
import { ContextMenu, type MenuDescriptor } from "../components/menu/ContextMenu";
import type { StoryBibleStore } from "../db/storyBibleStore";
import { useAutolinkSettings } from "../features/settings/settings.store";
import type { AlIndex } from "../lib/alBuildIndex";
import { alBuildIndex } from "../lib/alBuildIndex";
import { normalizeStatus, STATUS_META } from "../lib/status";
import { AutoLinkPeek } from "../storybible/AutoLinkPeek";
import { EditorHeader } from "./EditorHeader";
import AutoLinkExtension, { type AutoLinkConfig, autolinkKey } from "./extensions/AutoLink";
import DropCapGate from "./extensions/DropCapGate";
import FocusModeExtension, { type FocusFlags,focusModeKey } from "./extensions/FocusModeExtension";
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
    <div className={"page-turn-layer " + flip.dir} onAnimationEnd={() => onAnimationEnd(flip.key)}>
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

// Build the extensions array outside useEditorCore to stay within the 40-line limit.
function buildExtensions(doc: Y.Doc, alCfg: AutoLinkConfig, flags: FocusFlags) {
  return [
    StarterKit.configure({ undoRedo: false }),
    Collaboration.configure({ document: doc, field: "content" }),
    // Placeholder applies the `is-editor-empty` class when the doc is empty; the
    // typing-cue itself is styled in app.css (.is-editor-empty::before). StarterKit v3
    // does NOT bundle Placeholder, so without this extension that class never lands
    // and the cue never shows. emptyEditorClass matches the existing (frozen) CSS rule.
    Placeholder.configure({ emptyEditorClass: "is-editor-empty" }),
    ProofreadExtension,
    AutoLinkExtension.configure(alCfg),
    // FIX (review angle 4): pass current flag values so the initial plugin state
    // reflects reality on first render — no cold-start flash when focus is already on.
    FocusModeExtension.configure(flags),
    DropCapGate,
  ];
}

/**
 * useEditorCore — sets up TipTap, spell-check popover, and registers
 * `captureProse` into the ref provided by the parent (EditorPane) so the
 * page-flip can snapshot the outgoing prose even after a re-render cycle.
 */
function useEditorCore(
  doc: Y.Doc,
  captureProseRef: MutableRefObject<() => string>,
  alIndex: AlIndex | null,
  { focusMode, dimOn, typewriterOn }: FocusFlags,
): EditorCoreState {
  const { autolinkOn, autolinkScope, autolinkTypes } = useAutolinkSettings();
  const alCfg = { alIndex, autolinkOn, autolinkTypes, autolinkScope };
  const editor = useEditor({
    extensions: buildExtensions(doc, alCfg, { focusMode, dimOn, typewriterOn }),
    editorProps: { attributes: { class: "prose" } },
  });
  // When alIndex or any autolink setting changes, dispatch a meta transaction so
  // the plugin rebuilds its DecorationSet without tearing down the editor.
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(autolinkKey, alCfg));
  // alCfg is a new object each render; spread its members into deps so the effect
  // only fires when one of those values actually changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, alIndex, autolinkOn, autolinkScope, autolinkTypes]);
  // Dispatch focus-mode flag changes into the ProseMirror plugin via meta transaction.
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(focusModeKey, { focusMode, dimOn, typewriterOn }));
  }, [editor, focusMode, dimOn, typewriterOn]);
  const { visible, popoverProps } = useSpellCheckPopover(editor);
  const captureProse = useCallback(() => editor?.view?.dom?.innerHTML ?? "", [editor]);
  // Keep the shared ref in sync with the latest captureProse callback so
  // EditorPane's usePageFlip always snapshots the current editor DOM.
  useEffect(() => { captureProseRef.current = captureProse; }, [captureProse, captureProseRef]);
  return { editor, visible, popoverProps };
}

// ---------------------------------------------------------------------------
// Hover peek state for auto-linked spans.
// ---------------------------------------------------------------------------

interface AlPeekState {
  entityId: string;
  entityType: string;
  entityName: string;
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
    const entityName = target.getAttribute("data-entity-name") ?? "";
    clearLeaveTimer();
    // 230ms intent delay (mirrors autolink.jsx).
    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null;
      setPeek({ entityId, entityType, entityName, anchorEl: target });
    }, 230);
  }

  function handleMouseOut(e: React.MouseEvent<HTMLDivElement>) {
    const related = e.relatedTarget as HTMLElement | null;
    // If the mouse moved to a .al-peek child, cancel the timer and let its own onMouseLeave close.
    if (related?.closest?.(".al-peek")) { clearLeaveTimer(); return; }
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
// buildAlLinkMenu — assembles the right-click ContextMenu for an .al-link span.
// "Open full entry" is real; others are mock-toasts (documented TODOs).
// ---------------------------------------------------------------------------

interface AlLinkMenuArgs {
  el: HTMLElement;
  x: number;
  y: number;
  onOpenEntry: (id: string, kind: string) => void;
  onNotice: (msg: string) => void;
  onFindMentions: (entityName: string) => void;
}

function buildAlLinkMenu({ el, x, y, onOpenEntry, onNotice, onFindMentions }: AlLinkMenuArgs): MenuDescriptor {
  const entityId = el.getAttribute("data-entity-id") ?? "";
  const entityType = el.getAttribute("data-entity-type") ?? "";
  const entityName = el.getAttribute("data-entity-name") ?? "";
  const kind = entityType.charAt(0).toUpperCase() + entityType.slice(1);
  return {
    x, y,
    items: [
      { label: "Open full entry", icon: "feather", onClick: () => onOpenEntry(entityId, kind) },
      { type: "sep" },
      { label: "Find mentions", onClick: () => onFindMentions(entityName) },
      { label: "Unlink here", onClick: () => onNotice("Unlink here — coming soon") },
      { label: `Never link "${entityName}"`, onClick: () => onNotice(`Never link — coming soon`) },
      { label: "Manage aliases…", onClick: () => onNotice("Aliases — coming soon") },
    ],
  };
}

// ---------------------------------------------------------------------------
// AlNotice — transient mock-toast for al-link actions not yet fully implemented.
// ---------------------------------------------------------------------------

function AlNotice({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
      background: "var(--ink)", color: "var(--paper)", padding: "7px 18px",
      borderRadius: 8, fontSize: "var(--text-sm)", pointerEvents: "none", zIndex: 9000,
    }}>
      {msg}
    </div>
  );
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
  storyBibleStore: StoryBibleStore;
  onOpenEntry: (id: string, kind: string) => void;
  onFindMentions?: (entityName: string) => void;
}

function CanvasWrap({ editor, activeScene, liveWords, characters, locations,
  visible, popoverProps, storyBibleStore, onOpenEntry, onFindMentions }: CanvasWrapProps) {
  const { peek, handleMouseOver, handleMouseOut, closePeek } = useAutoLinkHover();
  const [alMenu, setAlMenu] = useState<MenuDescriptor | null>(null);
  const [mockNotice, setMockNotice] = useState<string | null>(null);
  const fireNotice = (msg: string) => { setMockNotice(msg); setTimeout(() => setMockNotice(null), 2200); };
  const handleFind = (name: string) => onFindMentions?.(name) ?? fireNotice(`Find mentions: ${name} — coming soon`);
  function handleAlLinkContext(e: React.MouseEvent<HTMLDivElement>): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>(".al-link");
    if (!el) return;
    setAlMenu(buildAlLinkMenu({ el, x: e.clientX, y: e.clientY, onOpenEntry, onNotice: fireNotice, onFindMentions: handleFind }));
  }
  // onClick below: clicking the blank page (outside PM's content DOM) focuses the editor at end.
  return (
    <div className="canvas-wrap"
      onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}
      onContextMenu={handleAlLinkContext}
      onClick={(e) => { if (editor && !editor.view.dom.contains(e.target as Node)) editor.commands.focus('end'); }}>
      {activeScene && (
        <EditorHeader chapterTitle={activeScene.chapterTitle} title={activeScene.scene.title}
          status={normalizeStatus(activeScene.scene.status)}
          words={liveWords} characters={characters} locations={locations} />
      )}
      <EditorContent editor={editor} className="editor-content-mount" />
      {editor && <FormatBubble editor={editor} />}
      {visible && <SpellCheckPopover {...popoverProps} />}
      {peek && createPortal(<AutoLinkPeek entityId={peek.entityId} entityType={peek.entityType}
        store={storyBibleStore} anchorEl={peek.anchorEl} onOpenEntry={onOpenEntry} onFindMentions={() => handleFind(peek.entityName)} onClose={closePeek} />, document.body)}
      {alMenu && <ContextMenu menu={alMenu} onClose={() => setAlMenu(null)} />}
      <AlNotice msg={mockNotice} />
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
  storyBibleStore: StoryBibleStore;
  linksVersion?: number;
  flip: FlipState | null;
  onAnimationEnd: (key: number) => void;
  captureProseRef: MutableRefObject<() => string>;
  /** Called when the user clicks "Open entry" in the AutoLinkPeek card. */
  onOpenEntry?: (id: string, kind: string) => void;
  /** Find-mentions callback (opens Find & Replace); active project id for the AutoLink index; insert-at-caret registration fn. */
  onFindMentions?: (entityName: string) => void;  activeProjectId?: string | null;  onRegisterInsert?: (fn: (text: string) => void) => void;
}

/**
 * useAutoLinkIndex — loads all entities for the active project whenever
 * linksVersion changes and builds an AlIndex for the AutoLink extension.
 * Returns null until the first load completes or when activeProjectId is null.
 */
function useAutoLinkIndex(
  storyBibleStore: StoryBibleStore,
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
  doc, tree, selectedSceneId, storyBibleStore, linksVersion = 0,
  flip, onAnimationEnd, captureProseRef,
  focusMode = false, typewriterOn = true, dimParagraphsOn = true,
  onOpenEntry, onFindMentions, activeProjectId = null, onRegisterInsert,
}: EditorProps) {
  const alIndex = useAutoLinkIndex(storyBibleStore, activeProjectId, linksVersion);
  const { editor, visible, popoverProps } = useEditorCore(
    doc, captureProseRef, alIndex,
    { focusMode, dimOn: dimParagraphsOn, typewriterOn },
  );
  useEffect(() => { if (editor) onRegisterInsert?.((text) => { const { $from } = editor.state.selection; const nb = $from.nodeBefore; const last = nb?.isText && nb.text ? nb.text[nb.text.length - 1] : ""; editor.chain().focus().insertContent(last && /\S/.test(last) ? " " + text : text).scrollIntoView().run(); }); }, [editor, onRegisterInsert]);
  const liveWords = useLiveWordCount(doc);
  const { characters, locations } = useSceneLinkCounts(storyBibleStore, selectedSceneId, linksVersion);
  const activeScene = findSceneWithChapter(tree, selectedSceneId);
  const handleOpenEntry = onOpenEntry ?? (() => undefined);
  return (
    <div className="canvas-scroll">
      <CanvasWrap editor={editor} activeScene={activeScene} liveWords={liveWords}
        characters={characters} locations={locations} visible={visible} popoverProps={popoverProps}
        storyBibleStore={storyBibleStore} onOpenEntry={handleOpenEntry} onFindMentions={onFindMentions} />
      {flip && <PageFlipLeaf key={flip.key} flip={flip} onAnimationEnd={onAnimationEnd} />}
    </div>
  );
}
