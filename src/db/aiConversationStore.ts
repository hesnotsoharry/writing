import { desktopLwwBridges } from "../sync/desktopLwwBridges";
import {
  type AiConversationStore,
  makeAiConversationStore,
} from "./aiConversationCore";
import type { DbClient } from "./dbClient";
import { getDb } from "./schema";

export * from "./aiConversationCore";

export function makeProductionAiConversationStore(): AiConversationStore {
  const proxyDb: DbClient = {
    select<T>(query: string, bindValues?: unknown[]): Promise<T> {
      return getDb().then((db) => db.select<T>(query, bindValues));
    },
    execute(query: string, bindValues?: unknown[]): Promise<{ rowsAffected: number }> {
      return getDb().then((db) => db.execute(query, bindValues));
    },
  };
  return new BridgedAiConversationStore(makeAiConversationStore(proxyDb), proxyDb);
}

class BridgedAiConversationStore implements AiConversationStore {
  constructor(private readonly inner: AiConversationStore, private readonly db: DbClient) {}

  async createConversation(
    projectId: string, opts?: Parameters<AiConversationStore["createConversation"]>[1],
  ) {
    const row = await this.inner.createConversation(projectId, opts);
    await desktopLwwBridges.aiConversations.conversationSaved(projectId, row.id);
    return row;
  }
  listConversations(projectId: string) { return this.inner.listConversations(projectId); }
  async appendMessage(
    conversationId: string, msg: Parameters<AiConversationStore["appendMessage"]>[1],
  ) {
    const projectId = await this.projectId(conversationId);
    const row = await this.inner.appendMessage(conversationId, msg);
    if (projectId) {
      await desktopLwwBridges.aiConversations.conversationSaved(projectId, conversationId);
      await desktopLwwBridges.aiConversations.messageAppended(projectId, row.id);
    }
    return row;
  }
  listMessages(conversationId: string) { return this.inner.listMessages(conversationId); }
  async deleteConversation(conversationId: string): Promise<void> {
    const projectId = await this.projectId(conversationId);
    await this.inner.deleteConversation(conversationId);
    if (projectId) {
      await desktopLwwBridges.aiConversations.conversationDeleted(projectId, conversationId);
    }
  }
  async updateTitle(conversationId: string, title: string): Promise<void> {
    const projectId = await this.projectId(conversationId);
    await this.inner.updateTitle(conversationId, title);
    if (projectId) {
      await desktopLwwBridges.aiConversations.conversationSaved(projectId, conversationId);
    }
  }
  private async projectId(conversationId: string): Promise<string | null> {
    const rows = await this.db.select<Array<{ project_id: string }>>(
      "SELECT project_id FROM ai_conversations WHERE id = ?", [conversationId],
    );
    return rows?.[0]?.project_id ?? null;
  }
}
