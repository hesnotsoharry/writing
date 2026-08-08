export const MOBILE_EDITOR_BRIDGE_VERSION = 1 as const;
export const MAX_BRIDGE_ID_LENGTH = 256 as const;

export type MobileEditorBridgeVersion = typeof MOBILE_EDITOR_BRIDGE_VERSION;
export type BridgeSessionId = string;
export type BridgeSceneId = string;
export type BridgeSequence = number;
export type Base64YjsUpdate = string;

export type BridgeAckType = "hydrate" | "update" | "replace" | "flush";

export type BridgeErrorCode =
  | "invalid-message"
  | "version-mismatch"
  | "session-mismatch"
  | "scene-mismatch"
  | "sequence-gap"
  | "persist-failed"
  | "apply-failed"
  | "ack-timeout";

export interface ReadyMessage {
  v: MobileEditorBridgeVersion;
  type: "ready";
  sessionId: BridgeSessionId;
}

export interface HydrateMessage {
  v: MobileEditorBridgeVersion;
  type: "hydrate";
  sessionId: BridgeSessionId;
  sceneId: BridgeSceneId;
  seq: BridgeSequence;
  update: Base64YjsUpdate;
}

export interface UpdateMessage {
  v: MobileEditorBridgeVersion;
  type: "update";
  sessionId: BridgeSessionId;
  sceneId: BridgeSceneId;
  seq: BridgeSequence;
  update: Base64YjsUpdate;
}

export interface ReplaceMessage {
  v: MobileEditorBridgeVersion;
  type: "replace";
  sessionId: BridgeSessionId;
  sceneId: BridgeSceneId;
  seq: BridgeSequence;
  update: Base64YjsUpdate;
}

export interface FlushMessage {
  v: MobileEditorBridgeVersion;
  type: "flush";
  sessionId: BridgeSessionId;
  sceneId: BridgeSceneId;
  seq: BridgeSequence;
}

export interface AckMessage {
  v: MobileEditorBridgeVersion;
  type: "ack";
  sessionId: BridgeSessionId;
  sceneId: BridgeSceneId;
  seq: BridgeSequence;
  ackType: BridgeAckType;
}

export interface BridgeErrorMessage {
  v: MobileEditorBridgeVersion;
  type: "error";
  sessionId: BridgeSessionId;
  sceneId?: BridgeSceneId;
  seq?: BridgeSequence;
  code: BridgeErrorCode;
  recoverable: boolean;
}

export type NativeToWebViewMessage =
  | HydrateMessage
  | UpdateMessage
  | ReplaceMessage
  | FlushMessage
  | AckMessage
  | BridgeErrorMessage;

export type WebViewToNativeMessage =
  | ReadyMessage
  | UpdateMessage
  | AckMessage
  | BridgeErrorMessage;

export type MobileEditorBridgeMessage =
  | NativeToWebViewMessage
  | WebViewToNativeMessage;

const ACK_TYPES: readonly BridgeAckType[] = ["hydrate", "update", "replace", "flush"];
const ERROR_CODES: readonly BridgeErrorCode[] = [
  "invalid-message",
  "version-mismatch",
  "session-mismatch",
  "scene-mismatch",
  "sequence-gap",
  "persist-failed",
  "apply-failed",
  "ack-timeout",
];
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key))
    && keys.every((key) => required.includes(key) || optional.includes(key));
}

export function isValidBridgeId(value: unknown): value is string {
  return typeof value === "string"
    && value.trim().length > 0
    && value.length <= MAX_BRIDGE_ID_LENGTH;
}

export function isValidBridgeSequence(value: unknown): value is BridgeSequence {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function isValidBase64YjsUpdate(value: unknown): value is Base64YjsUpdate {
  return typeof value === "string" && BASE64_PATTERN.test(value);
}

function hasEnvelope(value: Record<string, unknown>, type: string): boolean {
  return value.v === MOBILE_EDITOR_BRIDGE_VERSION
    && value.type === type
    && isValidBridgeId(value.sessionId);
}

function isReadyMessage(value: unknown): value is ReadyMessage {
  return isRecord(value)
    && hasExactKeys(value, ["v", "type", "sessionId"])
    && hasEnvelope(value, "ready");
}

function hasStatePayload(value: unknown, type: "hydrate" | "update" | "replace"): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["v", "type", "sessionId", "sceneId", "seq", "update"])
    && hasEnvelope(value, type)
    && isValidBridgeId(value.sceneId)
    && isValidBridgeSequence(value.seq)
    && isValidBase64YjsUpdate(value.update);
}

function isHydrateMessage(value: unknown): value is HydrateMessage {
  return hasStatePayload(value, "hydrate");
}

function isUpdateMessage(value: unknown): value is UpdateMessage {
  return hasStatePayload(value, "update");
}

function isReplaceMessage(value: unknown): value is ReplaceMessage {
  return hasStatePayload(value, "replace");
}

function isFlushMessage(value: unknown): value is FlushMessage {
  return isRecord(value)
    && hasExactKeys(value, ["v", "type", "sessionId", "sceneId", "seq"])
    && hasEnvelope(value, "flush")
    && isValidBridgeId(value.sceneId)
    && isValidBridgeSequence(value.seq);
}

function isAckMessage(value: unknown): value is AckMessage {
  return isRecord(value)
    && hasExactKeys(value, ["v", "type", "sessionId", "sceneId", "seq", "ackType"])
    && hasEnvelope(value, "ack")
    && isValidBridgeId(value.sceneId)
    && isValidBridgeSequence(value.seq)
    && ACK_TYPES.some((ackType) => ackType === value.ackType);
}

function isBridgeErrorMessage(value: unknown): value is BridgeErrorMessage {
  return isRecord(value)
    && hasExactKeys(
      value,
      ["v", "type", "sessionId", "code", "recoverable"],
      ["sceneId", "seq"],
    )
    && hasEnvelope(value, "error")
    && (value.sceneId === undefined || isValidBridgeId(value.sceneId))
    && (value.seq === undefined || isValidBridgeSequence(value.seq))
    && ERROR_CODES.some((code) => code === value.code)
    && typeof value.recoverable === "boolean";
}

function parseJson(raw: string): unknown {
  try {
    const value: unknown = JSON.parse(raw);
    return value;
  } catch {
    return null;
  }
}

export function parseWebViewMessage(raw: string): WebViewToNativeMessage | null {
  const value = parseJson(raw);
  if (isReadyMessage(value)) return value;
  if (isUpdateMessage(value)) return value;
  if (isAckMessage(value)) return value;
  if (isBridgeErrorMessage(value)) return value;
  return null;
}

export function parseNativeMessage(raw: string): NativeToWebViewMessage | null {
  const value = parseJson(raw);
  if (isHydrateMessage(value)) return value;
  if (isUpdateMessage(value)) return value;
  if (isReplaceMessage(value)) return value;
  if (isFlushMessage(value)) return value;
  if (isAckMessage(value)) return value;
  if (isBridgeErrorMessage(value)) return value;
  return null;
}

export function serializeBridgeMessage(message: MobileEditorBridgeMessage): string {
  return JSON.stringify(message);
}
