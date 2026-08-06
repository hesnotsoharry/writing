export interface HelloDoc {
  c: string;
  sv: string;
  at: string | null;
}

export interface HelloMessage {
  t: "hello";
  device: string;
  docs: HelloDoc[];
}

export interface DiffMessage {
  t: "diff";
  c: string;
  u: string;
}

export interface LiveMessage {
  t: "live";
  c: string;
  u: string;
}

export type InnerMessage = HelloMessage | DiffMessage | LiveMessage;
export type Channel =
  | { kind: "scene"; id: string }
  | { kind: "board"; id: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHelloDoc(value: unknown): value is HelloDoc {
  return isRecord(value)
    && typeof value.c === "string"
    && typeof value.sv === "string"
    && (typeof value.at === "string" || value.at === null);
}

export function isHelloMessage(value: unknown): value is HelloMessage {
  return isRecord(value)
    && value.t === "hello"
    && typeof value.device === "string"
    && Array.isArray(value.docs)
    && value.docs.every(isHelloDoc);
}

function isUpdateMessage(value: unknown, type: "diff" | "live"): boolean {
  return isRecord(value)
    && value.t === type
    && typeof value.c === "string"
    && typeof value.u === "string";
}

export function isDiffMessage(value: unknown): value is DiffMessage {
  return isUpdateMessage(value, "diff");
}

export function isLiveMessage(value: unknown): value is LiveMessage {
  return isUpdateMessage(value, "live");
}

export function isInnerMessage(value: unknown): value is InnerMessage {
  return isHelloMessage(value) || isDiffMessage(value) || isLiveMessage(value);
}

export function sceneChannel(id: string): string {
  return `scene:${id}`;
}

export function boardChannel(id: string): string {
  return `board:${id}`;
}

export function parseChannel(channel: string): Channel | null {
  const separator = channel.indexOf(":");
  const kind = channel.slice(0, separator);
  const id = channel.slice(separator + 1);
  if (!id || (kind !== "scene" && kind !== "board")) return null;
  return { kind, id };
}
