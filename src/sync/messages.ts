export const ROW_SUMMARY_LIMIT = 512;

export interface HelloDoc { c: string; sv: string; at: string | null }
export interface HelloMessage {
  t: "hello"; device: string; docs: HelloDoc[]; capabilities?: string[];
}
export interface DiffMessage { t: "diff"; c: string; u: string; e?: number }
export interface LiveMessage { t: "live"; c: string; u: string; e?: number }

export interface RowVersionSummary {
  id: string; hlc: string; device: string; deleted: boolean;
}
export interface RowHelloMessage {
  t: "row-hello"; domain: string; project: string | null;
  rows: RowVersionSummary[]; cursor?: string; more: boolean;
}
export interface RowMessage {
  t: "row"; id: string; domain: string; project: string | null; row: string;
  hlc: string; device: string; deleted: boolean; payload: string | null;
}
export interface RowAckMessage {
  t: "row-ack"; id: string; domain: string; row: string;
  hlc: string; device: string;
}
export interface ManagedCredentialState {
  aiLicenseKey?: string; aiTrialKey?: string; aiModel: string; aiEnabled: boolean;
}
export interface CredentialOfferMessage {
  t: "credential-offer"; id: string; managed: ManagedCredentialState;
}
export interface CredentialAckMessage {
  t: "credential-ack"; id: string; accepted: boolean;
}

export type InnerMessage = HelloMessage | DiffMessage | LiveMessage
  | RowHelloMessage | RowMessage | RowAckMessage
  | CredentialOfferMessage | CredentialAckMessage;
export type Channel =
  | { kind: "scene"; id: string }
  | { kind: "board"; id: string }
  | { kind: "meta"; id: string }
  | { kind: "bible"; id: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function isHelloDoc(value: unknown): value is HelloDoc {
  return isRecord(value) && typeof value.c === "string" && typeof value.sv === "string"
    && (typeof value.at === "string" || value.at === null);
}
export function isHelloMessage(value: unknown): value is HelloMessage {
  return isRecord(value) && value.t === "hello" && typeof value.device === "string"
    && Array.isArray(value.docs) && value.docs.every(isHelloDoc)
    && (value.capabilities === undefined || isStringArray(value.capabilities));
}
function isUpdateMessage(value: unknown, type: "diff" | "live"): boolean {
  return isRecord(value) && value.t === type && typeof value.c === "string"
    && typeof value.u === "string"
    && (value.e === undefined || (typeof value.e === "number" && Number.isInteger(value.e)));
}
export function isDiffMessage(value: unknown): value is DiffMessage {
  return isUpdateMessage(value, "diff");
}
export function isLiveMessage(value: unknown): value is LiveMessage {
  return isUpdateMessage(value, "live");
}
function isRowSummary(value: unknown): value is RowVersionSummary {
  return isRecord(value) && typeof value.id === "string" && isHlc(value.hlc)
    && typeof value.device === "string" && typeof value.deleted === "boolean";
}
function hasDomainProject(value: Record<string, unknown>): boolean {
  return typeof value.domain === "string"
    && (typeof value.project === "string" || value.project === null);
}
function isHlc(value: unknown): value is string {
  return typeof value === "string" && /^\d{15}-\d{6}$/.test(value);
}
export function isRowHelloMessage(value: unknown): value is RowHelloMessage {
  return isRecord(value) && value.t === "row-hello" && hasDomainProject(value)
    && Array.isArray(value.rows) && value.rows.length <= ROW_SUMMARY_LIMIT
    && value.rows.every(isRowSummary) && typeof value.more === "boolean"
    && (value.cursor === undefined || typeof value.cursor === "string");
}
export function isRowMessage(value: unknown): value is RowMessage {
  return isRecord(value) && value.t === "row" && hasDomainProject(value)
    && typeof value.id === "string" && typeof value.row === "string"
    && isHlc(value.hlc) && typeof value.device === "string"
    && typeof value.deleted === "boolean"
    && validRowPayload(value.deleted, value.payload);
}
export function isRowAckMessage(value: unknown): value is RowAckMessage {
  return isRecord(value) && value.t === "row-ack" && typeof value.id === "string"
    && typeof value.domain === "string" && typeof value.row === "string"
    && isHlc(value.hlc) && typeof value.device === "string";
}
function isManagedState(value: unknown): value is ManagedCredentialState {
  if (!isRecord(value) || typeof value.aiModel !== "string"
    || typeof value.aiEnabled !== "boolean") return false;
  if (!hasOnlyKeys(value, ["aiLicenseKey", "aiTrialKey", "aiModel", "aiEnabled"])) return false;
  if (value.aiLicenseKey !== undefined && typeof value.aiLicenseKey !== "string") return false;
  if (value.aiTrialKey !== undefined && typeof value.aiTrialKey !== "string") return false;
  return Number(value.aiLicenseKey !== undefined) + Number(value.aiTrialKey !== undefined) === 1;
}

function validRowPayload(deleted: boolean, payload: unknown): boolean {
  if (deleted) return payload === null;
  if (typeof payload !== "string") return false;
  try { JSON.parse(payload); return true; } catch { return false; }
}
function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  const keys = new Set(allowed); return Object.keys(value).every((key) => keys.has(key));
}
export function isCredentialOfferMessage(value: unknown): value is CredentialOfferMessage {
  return isRecord(value) && value.t === "credential-offer" && typeof value.id === "string"
    && hasOnlyKeys(value, ["t", "id", "managed"]) && isManagedState(value.managed);
}
export function isCredentialAckMessage(value: unknown): value is CredentialAckMessage {
  return isRecord(value) && value.t === "credential-ack" && typeof value.id === "string"
    && hasOnlyKeys(value, ["t", "id", "accepted"]) && typeof value.accepted === "boolean";
}
export function isInnerMessage(value: unknown): value is InnerMessage {
  return isHelloMessage(value) || isDiffMessage(value) || isLiveMessage(value)
    || isRowHelloMessage(value) || isRowMessage(value) || isRowAckMessage(value)
    || isCredentialOfferMessage(value) || isCredentialAckMessage(value);
}

export const sceneChannel = (id: string): string => `scene:${id}`;
export const boardChannel = (id: string): string => `board:${id}`;
export const metaChannel = (id: string): string => `meta:${id}`;
export const bibleChannel = (id: string): string => `bible:${id}`;

export function parseChannel(channel: string): Channel | null {
  const separator = channel.indexOf(":");
  if (separator <= 0) return null;
  const kind = channel.slice(0, separator);
  const id = channel.slice(separator + 1);
  if (!id || (kind !== "scene" && kind !== "board" && kind !== "meta" && kind !== "bible")) {
    return null;
  }
  return { kind, id };
}
