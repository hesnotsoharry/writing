import { extractAiSafeSelection } from "@writersnook/editor/aiSafeSelectionCore";
import type { MobileEditorCore } from "@writersnook/editor/MobileEditorCore";
import type { ComponentProps } from "react";

import type { EditorUiCommand, NativeEditorUiMessage } from "../../src/features/editor/editorUiProtocol";
import type { BridgeClient } from "./bridgeClient";
import { focusDecorationKey, focusDecorationPlugin, type FocusDecorationState } from "./focusDecoration";

const ENTITY_LINK_ORIGIN = "https://entity.writersnook.app";
type Editor = Parameters<NonNullable<ComponentProps<typeof MobileEditorCore>["onReady"]>>[0];

function selectionRect(editor: Editor): { x: number; y: number; width: number; height: number } | null {
  const { from, to } = editor.state.selection;
  try {
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    return {
      x: Math.min(start.left, end.left), y: Math.min(start.top, end.top),
      width: Math.max(2, Math.abs(end.right - start.left)),
      height: Math.max(start.bottom, end.bottom) - Math.min(start.top, end.top),
    };
  } catch { return null; }
}

function reportSelection(editor: Editor, client: BridgeClient): void {
  const { empty, from, to } = editor.state.selection;
  client.reportSelection({
    bold: editor.isActive("bold"), italic: editor.isActive("italic"),
    blockquote: editor.isActive("blockquote"), aiExcluded: editor.isActive("aiExclude"),
    collapsed: empty, from, to,
    aiSafeText: empty ? "" : extractAiSafeSelection(editor.state.doc, from, to),
    rect: selectionRect(editor),
  });
}

function entityHref(command: EditorUiCommand): string | null {
  if (command.command !== "link-entity" || !command.entity) return null;
  const type = encodeURIComponent(command.entity.entityType);
  const id = encodeURIComponent(command.entity.entityId);
  return `${ENTITY_LINK_ORIGIN}/${type}/${id}`;
}

function runCommand(editor: Editor, command: EditorUiCommand): void {
  if (command.command === "toggle-bold") editor.chain().focus().toggleMark("bold").run();
  else if (command.command === "toggle-italic") editor.chain().focus().toggleMark("italic").run();
  else if (command.command === "toggle-blockquote") editor.chain().focus().toggleWrap("blockquote").run();
  else if (command.command === "toggle-ai-exclude") editor.chain().focus().toggleMark("aiExclude").run();
  else if (command.command === "wrap-quote") wrapQuote(editor);
  else {
    const href = entityHref(command);
    if (href) editor.chain().focus().setMark("link", { href, target: null, rel: null }).run();
  }
}

function wrapQuote(editor: Editor): void {
  const { empty, from, to } = editor.state.selection;
  if (empty) {
    editor.chain().focus().insertContent("“”").setTextSelection(from + 1).run();
    return;
  }
  const text = editor.state.doc.textBetween(from, to, " ");
  editor.chain().focus().insertContentAt({ from, to }, `“${text}”`).run();
}

function applyTheme(colors: Record<string, string>): void {
  for (const [name, color] of Object.entries(colors)) {
    if (name === "theme") document.documentElement.dataset.theme = color;
    else document.documentElement.style.setProperty(
      `--entity-${name === "themeType" ? "theme" : name}`, color,
    );
  }
}

function applyFocus(editor: Editor, focus: FocusDecorationState): void {
  document.documentElement.classList.toggle("focus-mode", focus.enabled && focus.dimParagraphs);
  editor.view.dispatch(editor.state.tr.setMeta(focusDecorationKey, focus));
  if (focus.enabled && focus.typewriter) requestAnimationFrame(() => {
    document.querySelector(".focus-active-paragraph")?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

export function attachEditorUi(editor: Editor, client: BridgeClient): () => void {
  editor.registerPlugin(focusDecorationPlugin());
  const onSelection = (): void => { reportSelection(editor, client); };
  const unbind = client.bindEditorUi((message: NativeEditorUiMessage) => {
    if (message.type === "editor-command") runCommand(editor, message);
    else if (message.type === "editor-theme") applyTheme(message.colors);
    else if (message.type === "editor-focus") applyFocus(editor, message);
    reportSelection(editor, client);
  });
  editor.on("selectionUpdate", onSelection);
  editor.on("transaction", onSelection);
  reportSelection(editor, client);
  return () => { document.documentElement.classList.remove("focus-mode"); unbind(); editor.unregisterPlugin(focusDecorationKey); editor.off("selectionUpdate", onSelection); editor.off("transaction", onSelection); };
}
