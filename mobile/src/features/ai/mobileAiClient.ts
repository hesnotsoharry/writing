import type { VerbKey } from "../../shared/aiCatalog";
import type { LiveBalance } from "./aiLogic";

export interface AiMessage { role: "user" | "assistant"; content: string }

export type NormalizedEvent =
  | { type: "token"; text: string }
  | { type: "done"; inputTokens: number; outputTokens: number; creditsCost: number; cachedTokens?: number; balanceAfter?: number | null }
  | { type: "error"; message: string }
  | { type: "credits-exhausted"; resetAt: string }
  | { type: "trial-budget-exhausted" }
  | { type: "session-expired" }
  | { type: "content-blocked" };

export interface SessionResult { token: string; expiresAt: number }
export interface TrialSessionResult extends SessionResult { trialKey?: string; allowance?: number }

export interface StreamOptions {
  verb?: VerbKey;
  system?: string;
  signal?: AbortSignal;
  model?: string;
}

interface MobileFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

interface MobileResponse {
  ok: boolean;
  status: number;
  body: ReadableStream<Uint8Array> | null;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

type MobileFetch = (url: string, init?: MobileFetchInit) => Promise<MobileResponse>;
export interface MobileAiClientOptions { baseUrl?: string; fetcher?: MobileFetch }

const DEFAULT_BASE_URL = "https://writersnook.app";

const defaultMobileFetch: MobileFetch = async (url, init) => {
  const expo = await import("expo/fetch");
  return expo.fetch(url, init) as unknown as Promise<MobileResponse>;
};

function parseSseLine(line: string): NormalizedEvent | null {
  if (!line.startsWith("data: ")) return null;
  try { return JSON.parse(line.slice(6)) as NormalizedEvent; } catch { return null; }
}

function parseResetAt(value: unknown): string {
  if (value === null || value === undefined || value === "" || value === "null") return "";
  return String(value);
}

function recordValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function eventFor429(body: Record<string, unknown>): NormalizedEvent {
  if (body["error"] === "rate_limit_exceeded") {
    return { type: "error", message: "Too many requests — wait a moment and try again" };
  }
  if (body["error"] === "trial_budget_exhausted") return { type: "trial-budget-exhausted" };
  return { type: "credits-exhausted", resetAt: parseResetAt(body["resetAt"]) };
}

async function drain(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: NormalizedEvent) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach((line) => { const event = parseSseLine(line); if (event) onEvent(event); });
  }
  const tail = parseSseLine(buffer);
  if (tail) onEvent(tail);
}

function chatBody(messages: AiMessage[], options?: StreamOptions): Record<string, unknown> {
  return {
    messages,
    ...(options?.verb ? { verb: options.verb } : {}),
    ...(options?.system ? { system: options.system } : {}),
    ...(options?.model ? { model: options.model } : {}),
  };
}

export class MobileAiClient {
  private readonly baseUrl: string;
  private readonly fetcher: MobileFetch;

  constructor(options: MobileAiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetcher = options.fetcher ?? defaultMobileFetch;
  }

  async acquireSession(licenseKey: string): Promise<SessionResult> {
    return this.postSession("/api/ai/session", { licenseKey }, "Session exchange failed");
  }

  async acquireTrialSession(trialKey: string): Promise<TrialSessionResult> {
    return this.postSession("/api/ai/trial-session", { trialKey }, "Trial session failed");
  }

  private async postSession<T extends SessionResult>(
    path: string, body: Record<string, string>, failure: string,
  ): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${failure}: ${response.status}`);
    return response.json() as Promise<T>;
  }

  async getBalance(token: string): Promise<LiveBalance> {
    const response = await this.fetcher(`${this.baseUrl}/api/ai/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Balance fetch failed: ${response.status}`);
    return response.json() as Promise<LiveBalance>;
  }

  async streamChat(
    token: string, messages: AiMessage[], onEvent: (event: NormalizedEvent) => void,
    options?: StreamOptions,
  ): Promise<void> {
    const response = await this.fetcher(`${this.baseUrl}/api/ai/chat`, {
      method: "POST", headers: {
        "Content-Type": "application/json", Authorization: `Bearer ${token}`,
      }, body: JSON.stringify(chatBody(messages, options)), signal: options?.signal,
    });
    if (response.status === 429) {
      onEvent(eventFor429(recordValue(await response.json().catch(() => null)))); return;
    }
    if (response.status === 403) { onEvent({ type: "session-expired" }); return; }
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      onEvent({ type: "error", message: `Chat request failed: ${response.status} ${detail}` }); return;
    }
    await drain(response.body.getReader(), onEvent);
  }
}

export const mobileAiClient = new MobileAiClient();
