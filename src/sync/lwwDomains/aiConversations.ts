import type { DbClient } from "../../db/dbClient";
import type { LwwDomainAdapter, LwwSeedRow } from "../lww/registry";
import { createSqlDomainAdapter } from "./sqlDomain";

const CONVERSATION_COLUMNS = ["id", "project_id", "title", "last_verb",
  "boundary_chapter_id", "context_config", "created_at", "updated_at"] as const;
const MESSAGE_COLUMNS = ["id", "conversation_id", "role", "verb", "body",
  "context_json", "credits_cost", "created_at"] as const;

function splitRowId(rowId: string): { kind: "conversation" | "message"; id: string } | null {
  if (rowId.startsWith("conversation:") && rowId.length > 13) {
    return { kind: "conversation", id: rowId.slice(13) };
  }
  if (rowId.startsWith("message:") && rowId.length > 8) return { kind: "message", id: rowId.slice(8) };
  return null;
}

async function conversationExists(db: DbClient, conversationId: string): Promise<boolean> {
  const rows = await db.select<Array<{ id: string }>>(
    "SELECT id FROM ai_conversations WHERE id = ?", [conversationId],
  );
  return rows.length > 0;
}

async function conversationWasDeleted(db: DbClient, conversationId: string): Promise<boolean> {
  const rows = await db.select<Array<{ deleted: number }>>(
    "SELECT deleted FROM sync_lww_rows WHERE domain = ? AND row_id = ?",
    ["ai_conversations", `conversation:${conversationId}`],
  );
  return rows[0]?.deleted !== 0 && rows[0] !== undefined;
}

async function messageConversationId(payloadJson: string): Promise<string> {
  const parsed: unknown = JSON.parse(payloadJson);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("AI message payload must be an object");
  }
  const id = (parsed as Record<string, unknown>).conversation_id;
  if (typeof id !== "string") throw new TypeError("AI message conversation id is missing");
  return id;
}

export function createAiConversationsAdapter(db: DbClient): LwwDomainAdapter {
  const conversations = createSqlDomainAdapter(db, {
    domain: "ai_conversations", table: "ai_conversations", key: "id",
    columns: CONVERSATION_COLUMNS,
    seed: { project: "project_id", stamp: "COALESCE(updated_at, created_at)" },
  });
  const messages = createSqlDomainAdapter(db, {
    domain: "ai_conversations", table: "ai_messages", key: "id", columns: MESSAGE_COLUMNS,
    seed: {
      project: "ai_conversations.project_id", stamp: "ai_messages.created_at",
      from: "ai_messages JOIN ai_conversations ON ai_conversations.id = ai_messages.conversation_id",
    },
  });
  const context = { db, conversations, messages };
  return {
    domain: "ai_conversations",
    readPayload: (rowId) => readAiPayload(rowId, conversations, messages),
    projectReceived: (rowId, projectId, payload) =>
      projectAiPayload(context, rowId, projectId, payload),
    applyTombstone: (rowId, projectId) =>
      tombstoneAiPayload(context, rowId, projectId),
    listSeedRows: () => listAiSeedRows(conversations, messages),
  };
}

/**
 * Both halves of the domain, re-prefixed into the composite row ids
 * `splitRowId` expects. A message whose conversation is gone is dropped by the
 * inner join rather than seeded into a scope it could never be projected into.
 */
async function listAiSeedRows(
  conversations: LwwDomainAdapter, messages: LwwDomainAdapter,
): Promise<LwwSeedRow[]> {
  const [conversationRows, messageRows] = await Promise.all([
    conversations.listSeedRows?.() ?? [], messages.listSeedRows?.() ?? [],
  ]);
  return [
    ...conversationRows.map((row) => ({ ...row, rowId: `conversation:${row.rowId}` })),
    ...messageRows.map((row) => ({ ...row, rowId: `message:${row.rowId}` })),
  ];
}

async function readAiPayload(
  rowId: string,
  conversations: LwwDomainAdapter,
  messages: LwwDomainAdapter,
): Promise<string | null> {
  const row = splitRowId(rowId);
  if (!row) return null;
  return row.kind === "conversation"
    ? conversations.readPayload(row.id) : messages.readPayload(row.id);
}

async function projectAiPayload(
  context: AiAdapterContext,
  rowId: string,
  projectId: string | null,
  payload: string,
): Promise<void> {
  const { db, conversations, messages } = context;
  const row = splitRowId(rowId);
  if (!row) throw new TypeError("Unknown AI LWW row id");
  if (row.kind === "conversation") {
    await conversations.projectReceived(row.id, projectId, payload);
    await drainPendingMessages(db, row.id, projectId, messages);
    return;
  }
  const conversationId = await messageConversationId(payload);
  if (await conversationWasDeleted(db, conversationId)) return;
  if (await conversationExists(db, conversationId)) {
    await messages.projectReceived(row.id, projectId, payload);
  }
}

async function drainPendingMessages(
  db: DbClient,
  conversationId: string,
  projectId: string | null,
  messages: LwwDomainAdapter,
): Promise<void> {
  const rows = await db.select<Array<{ row_id: string; payload_json: string }>>(
    `SELECT row_id, payload_json FROM sync_lww_rows
     WHERE domain = ? AND deleted = 0 AND row_id LIKE 'message:%' AND payload_json IS NOT NULL
     ORDER BY row_id`, ["ai_conversations"],
  );
  for (const row of rows) {
    if (await messageConversationId(row.payload_json) === conversationId) {
      await messages.projectReceived(row.row_id.slice(8), projectId, row.payload_json);
    }
  }
}

async function tombstoneAiPayload(
  context: AiAdapterContext,
  rowId: string,
  projectId: string | null,
): Promise<void> {
  const { db, conversations, messages } = context;
  const row = splitRowId(rowId);
  if (!row) return;
  if (row.kind === "message") {
    await messages.applyTombstone(row.id, projectId); return;
  }
  await db.execute("DELETE FROM ai_messages WHERE conversation_id = ?", [row.id]);
  await conversations.applyTombstone(row.id, projectId);
}

interface AiAdapterContext {
  db: DbClient;
  conversations: LwwDomainAdapter;
  messages: LwwDomainAdapter;
}
