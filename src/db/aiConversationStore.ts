/**
 * aiConversationStore — Wave 35 Phase D.
 *
 * Persisted conversation + message store over SQLite (migrations 16/17).
 * Factory pattern: makeAiConversationStore(db) for tests; makeProductionAiConversationStore()
 * for production (wraps the singleton getDb() handle).
 */
import type { VerbKey } from "../features/ai/ai.types";
import type { DbHandle } from "./schema";
import { getDb } from "./schema";

// ── Public row types (camelCase) ───────────────────────────────────────────────

export interface ConversationRow {
  id: string;
  projectId: string;
  title: string;
  lastVerb: VerbKey | null;
  boundaryChapterId: string | null;
  contextConfig: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  role: "you" | "ai";
  verb: string;
  body: string;
  contextJson: string | null;
  creditsCost: number | null;
  createdAt: number;
}

// ── Store interface ────────────────────────────────────────────────────────────

export interface AiConversationStore {
  createConversation(
    projectId: string,
    opts?: { title?: string; verb?: VerbKey },
  ): Promise<ConversationRow>;
  listConversations(projectId: string): Promise<ConversationRow[]>;
  appendMessage(
    conversationId: string,
    msg: {
      role: "you" | "ai";
      verb: VerbKey | string;
      body: string;
      contextJson: string | null;
      creditsCost: number | null;
    },
  ): Promise<MessageRow>;
  listMessages(conversationId: string): Promise<MessageRow[]>;
  deleteConversation(conversationId: string): Promise<void>;
  updateTitle(conversationId: string, title: string): Promise<void>;
}

// ── Raw DB row shapes (snake_case) ─────────────────────────────────────────────

interface ConvRaw {
  id: string;
  project_id: string;
  title: string;
  last_verb: string | null;
  boundary_chapter_id: string | null;
  context_config: string | null;
  created_at: number;
  updated_at: number;
}

interface MsgRaw {
  id: string;
  conversation_id: string;
  role: "you" | "ai";
  verb: string;
  body: string;
  context_json: string | null;
  credits_cost: number | null;
  created_at: number;
}

// ── Row mappers ────────────────────────────────────────────────────────────────

function mapConvRow(r: ConvRaw): ConversationRow {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    lastVerb: r.last_verb as VerbKey | null,
    boundaryChapterId: r.boundary_chapter_id,
    contextConfig: r.context_config,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapMsgRow(r: MsgRaw): MessageRow {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    verb: r.verb,
    body: r.body,
    contextJson: r.context_json,
    creditsCost: r.credits_cost,
    createdAt: r.created_at,
  };
}

// ── Store implementation ───────────────────────────────────────────────────────

class AiConversationStoreImpl implements AiConversationStore {
  private _lastTs = 0;

  /** Returns a monotonically increasing ms timestamp (never repeats within this instance). */
  private nextTs(): number {
    const now = Date.now();
    if (now <= this._lastTs) { this._lastTs += 1; return this._lastTs; }
    this._lastTs = now;
    return now;
  }

  constructor(private readonly db: DbHandle) {}

  async createConversation(
    projectId: string,
    opts?: { title?: string; verb?: VerbKey },
  ): Promise<ConversationRow> {
    const id = crypto.randomUUID();
    const now = this.nextTs();
    const title = opts?.title ?? "New conversation";
    const lastVerb = opts?.verb ?? null;
    await this.db.execute(
      "INSERT INTO ai_conversations (id, project_id, title, last_verb, boundary_chapter_id, context_config, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)",
      [id, projectId, title, lastVerb, now, now],
    );
    return { id, projectId, title, lastVerb: lastVerb as VerbKey | null, boundaryChapterId: null, contextConfig: null, createdAt: now, updatedAt: now };
  }

  async listConversations(projectId: string): Promise<ConversationRow[]> {
    const rows = await this.db.select<ConvRaw[]>(
      "SELECT id, project_id, title, last_verb, boundary_chapter_id, context_config, created_at, updated_at FROM ai_conversations WHERE project_id = ? ORDER BY updated_at DESC, id DESC",
      [projectId],
    );
    return rows.map(mapConvRow);
  }

  async appendMessage(
    conversationId: string,
    msg: { role: "you" | "ai"; verb: VerbKey | string; body: string; contextJson: string | null; creditsCost: number | null },
  ): Promise<MessageRow> {
    const id = crypto.randomUUID();
    const now = this.nextTs();
    await this.db.execute(
      "INSERT INTO ai_messages (id, conversation_id, role, verb, body, context_json, credits_cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, conversationId, msg.role, msg.verb, msg.body, msg.contextJson, msg.creditsCost, now],
    );
    await this.db.execute(
      "UPDATE ai_conversations SET updated_at = ? WHERE id = ?",
      [now, conversationId],
    );
    return { id, conversationId, role: msg.role, verb: msg.verb, body: msg.body, contextJson: msg.contextJson, creditsCost: msg.creditsCost, createdAt: now };
  }

  async listMessages(conversationId: string): Promise<MessageRow[]> {
    const rows = await this.db.select<MsgRaw[]>(
      "SELECT id, conversation_id, role, verb, body, context_json, credits_cost, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC",
      [conversationId],
    );
    return rows.map(mapMsgRow);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    // Decision 4: explicit child delete — do NOT rely on FK cascade.
    await this.db.execute("DELETE FROM ai_messages WHERE conversation_id = ?", [conversationId]);
    await this.db.execute("DELETE FROM ai_conversations WHERE id = ?", [conversationId]);
  }

  async updateTitle(conversationId: string, title: string): Promise<void> {
    await this.db.execute("UPDATE ai_conversations SET title = ? WHERE id = ?", [title, conversationId]);
  }
}

// ── Public factories ───────────────────────────────────────────────────────────

/** Factory for tests: pass any DbHandle (e.g. sql.js). */
export function makeAiConversationStore(db: DbHandle): AiConversationStore {
  return new AiConversationStoreImpl(db);
}

/**
 * Production store: proxies each call through getDb() so it participates in the
 * singleton DB lifecycle (mirrors the pattern used by SqliteStoryBibleStore).
 */
export function makeProductionAiConversationStore(): AiConversationStore {
  const proxyDb: DbHandle = {
    select<T>(query: string, bindValues?: unknown[]): Promise<T> {
      return getDb().then((db) => db.select<T>(query, bindValues));
    },
    execute(query: string, bindValues?: unknown[]): Promise<unknown> {
      return getDb().then((db) => db.execute(query, bindValues));
    },
  };
  return makeAiConversationStore(proxyDb);
}

// ── Pure helper ────────────────────────────────────────────────────────────────

/**
 * Derive a conversation title from the user's first ask.
 * Trims whitespace, then returns the full ask if ≤36 code points,
 * or the first 36 code points + "…" otherwise.
 * Array spread is used for code-point safety (handles emoji / surrogate pairs).
 */
export function deriveConversationTitle(ask: string): string {
  const trimmed = ask.trim();
  const codePoints = [...trimmed];
  if (codePoints.length <= 36) return trimmed;
  return codePoints.slice(0, 36).join("") + "…";
}
