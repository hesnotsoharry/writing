export const EDITOR_UI_VERSION = 1 as const;
export const MAX_EDITOR_UI_BYTES = 32_768;
export const MAX_SELECTION_TEXT = 16_000;

export type EditorCommandName =
  | "toggle-bold"
  | "toggle-italic"
  | "toggle-blockquote"
  | "wrap-quote"
  | "link-entity"
  | "toggle-ai-exclude";

export interface EntityLinkPayload {
  entityId: string;
  entityType: string;
}

export interface EditorUiCommand {
  v: typeof EDITOR_UI_VERSION;
  type: "editor-command";
  sessionId: string;
  sceneId: string;
  seq: number;
  command: EditorCommandName;
  entity?: EntityLinkPayload;
}

export interface EditorThemeMessage {
  v: typeof EDITOR_UI_VERSION;
  type: "editor-theme";
  sessionId: string;
  sceneId: string;
  seq: number;
  colors: Record<string, string>;
}

export interface EditorFocusMessage {
  v: typeof EDITOR_UI_VERSION;
  type: "editor-focus";
  sessionId: string;
  sceneId: string;
  seq: number;
  enabled: boolean;
  dimParagraphs: boolean;
  typewriter: boolean;
  activeParagraph: number | null;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorSelectionState {
  bold: boolean;
  italic: boolean;
  blockquote: boolean;
  aiExcluded: boolean;
  collapsed: boolean;
  from: number;
  to: number;
  aiSafeText: string;
  rect: SelectionRect | null;
}

export interface EditorSelectionMessage extends EditorSelectionState {
  v: typeof EDITOR_UI_VERSION;
  type: "selection-state";
  sessionId: string;
  sceneId: string;
  seq: number;
}

export interface EditorAutoLinkTapState {
  entityId: string;
  entityType: string;
  rect: SelectionRect;
}

export interface EditorAutoLinkTapMessage extends EditorAutoLinkTapState {
  v: typeof EDITOR_UI_VERSION;
  type: "auto-link-tap";
  sessionId: string;
  sceneId: string;
  seq: number;
}

export interface EditorUiAck {
  v: typeof EDITOR_UI_VERSION;
  type: "editor-ui-ack";
  sessionId: string;
  sceneId: string;
  seq: number;
  ackType: "command" | "selection" | "autolink" | "theme" | "focus";
}

export type NativeEditorUiMessage = EditorUiCommand | EditorThemeMessage | EditorFocusMessage | EditorUiAck;
export type WebEditorUiMessage = EditorSelectionMessage | EditorAutoLinkTapMessage | EditorUiAck;

const COMMANDS: readonly EditorCommandName[] = [
  "toggle-bold", "toggle-italic", "toggle-blockquote", "wrap-quote",
  "link-entity", "toggle-ai-exclude",
];
const ACK_TYPES = ["command", "selection", "autolink", "theme", "focus"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key))
    && keys.every((key) => required.includes(key) || optional.includes(key));
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 256;
}

function validSeq(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function envelope(value: Record<string, unknown>, type: string): boolean {
  return value.v === EDITOR_UI_VERSION && value.type === type
    && validId(value.sessionId) && validId(value.sceneId) && validSeq(value.seq);
}

function validEntity(value: unknown): value is EntityLinkPayload {
  return isRecord(value) && exactKeys(value, ["entityId", "entityType"])
    && validId(value.entityId) && validId(value.entityType);
}

function isCommand(value: unknown): value is EditorUiCommand {
  if (!isRecord(value) || !exactKeys(value,
    ["v", "type", "sessionId", "sceneId", "seq", "command"], ["entity"])) return false;
  if (!envelope(value, "editor-command")
    || !COMMANDS.some((command) => command === value.command)) return false;
  return value.command === "link-entity" ? validEntity(value.entity) : value.entity === undefined;
}

function validColors(value: unknown): value is Record<string, string> {
  if (!isRecord(value) || Object.keys(value).length > 16) return false;
  return Object.entries(value).every(([key, color]) => validId(key)
    && typeof color === "string" && color.length > 0 && color.length <= 64);
}

function isTheme(value: unknown): value is EditorThemeMessage {
  return isRecord(value)
    && exactKeys(value, ["v", "type", "sessionId", "sceneId", "seq", "colors"])
    && envelope(value, "editor-theme") && validColors(value.colors);
}

function isFocus(value: unknown): value is EditorFocusMessage {
  if (!isRecord(value) || !exactKeys(value, ["v", "type", "sessionId", "sceneId", "seq",
    "enabled", "dimParagraphs", "typewriter", "activeParagraph"])) return false;
  return envelope(value, "editor-focus")
    && [value.enabled, value.dimParagraphs, value.typewriter].every((flag) => typeof flag === "boolean")
    && (value.activeParagraph === null || validSelectionRange(value.activeParagraph, value.activeParagraph));
}

function isRect(value: unknown): value is SelectionRect {
  if (!isRecord(value) || !exactKeys(value, ["x", "y", "width", "height"])) return false;
  return [value.x, value.y, value.width, value.height]
    .every((part) => typeof part === "number" && Number.isFinite(part));
}

function validSelectionRange(from: unknown, to: unknown): boolean {
  return typeof from === "number" && Number.isSafeInteger(from) && from >= 0
    && typeof to === "number" && Number.isSafeInteger(to) && to >= from;
}

function isSelection(value: unknown): value is EditorSelectionMessage {
  if (!isRecord(value) || !exactKeys(value, [
    "v", "type", "sessionId", "sceneId", "seq", "bold", "italic", "blockquote",
    "aiExcluded", "collapsed", "from", "to", "aiSafeText", "rect",
  ])) return false;
  const flags = [value.bold, value.italic, value.blockquote, value.aiExcluded, value.collapsed];
  return envelope(value, "selection-state") && flags.every((flag) => typeof flag === "boolean")
    && validSelectionRange(value.from, value.to)
    && typeof value.aiSafeText === "string" && value.aiSafeText.length <= MAX_SELECTION_TEXT
    && (value.rect === null || isRect(value.rect));
}

function isAutoLinkTap(value: unknown): value is EditorAutoLinkTapMessage {
  return isRecord(value)
    && exactKeys(value, [
      "v", "type", "sessionId", "sceneId", "seq", "entityId", "entityType", "rect",
    ])
    && envelope(value, "auto-link-tap") && validId(value.entityId)
    && validId(value.entityType) && isRect(value.rect);
}

function isAck(value: unknown): value is EditorUiAck {
  return isRecord(value)
    && exactKeys(value, ["v", "type", "sessionId", "sceneId", "seq", "ackType"])
    && envelope(value, "editor-ui-ack")
    && ACK_TYPES.some((ackType) => ackType === value.ackType);
}

function parse(raw: string): unknown {
  if (raw.length > MAX_EDITOR_UI_BYTES) return null;
  try { return JSON.parse(raw) as unknown; } catch { return null; }
}

export function parseNativeEditorUiMessage(raw: string): NativeEditorUiMessage | null {
  const value = parse(raw);
  if (isCommand(value)) return value;
  if (isTheme(value)) return value;
  if (isFocus(value)) return value;
  if (isAck(value)) return value;
  return null;
}

export function parseWebEditorUiMessage(raw: string): WebEditorUiMessage | null {
  const value = parse(raw);
  if (isSelection(value)) return value;
  if (isAutoLinkTap(value)) return value;
  if (isAck(value)) return value;
  return null;
}

export function serializeEditorUiMessage(message: NativeEditorUiMessage | WebEditorUiMessage): string {
  return JSON.stringify(message);
}

export type UiSequenceResult = "accept" | "replay" | "gap" | "mismatch";

export function classifyUiSequence(
  message: Pick<EditorUiAck, "sessionId" | "sceneId" | "seq">,
  expected: Pick<EditorUiAck, "sessionId" | "sceneId" | "seq">,
): UiSequenceResult {
  if (message.sessionId !== expected.sessionId || message.sceneId !== expected.sceneId) return "mismatch";
  if (message.seq < expected.seq) return "replay";
  if (message.seq > expected.seq) return "gap";
  return "accept";
}
