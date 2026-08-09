import type { VerbKey } from "../shared/aiCatalog";
import {
  type AiConversationStore,
  type ConversationRow,
  makeAiConversationStore,
  type MessageRow,
} from "../shared/aiConversationStore";
import type { DbClient } from "../shared/dbClient";
import { mobileLocalWrites } from "./mobileLocalWriteBridge";

export class MobileAiConversationStore implements AiConversationStore {
  private readonly inner: AiConversationStore;
  constructor(private readonly db: DbClient) { this.inner = makeAiConversationStore(db); }

  async createConversation(projectId: string, opts?: { title?: string; verb?: VerbKey }): Promise<ConversationRow> {
    const row = await this.inner.createConversation(projectId, opts);
    this.notify(projectId, `conversation:${row.id}`, false); return row;
  }
  listConversations(projectId: string) { return this.inner.listConversations(projectId); }
  async appendMessage(conversationId: string, msg: {
    role: "you" | "ai"; verb: VerbKey | string; body: string;
    contextJson: string | null; creditsCost: number | null;
  }): Promise<MessageRow> {
    const row = await this.inner.appendMessage(conversationId, msg);
    const projectId = await this.projectId(conversationId);
    if (projectId) this.notify(projectId, `message:${row.id}`, false);
    return row;
  }
  listMessages(conversationId: string) { return this.inner.listMessages(conversationId); }
  async deleteConversation(conversationId: string): Promise<void> {
    const projectId = await this.projectId(conversationId);
    await this.inner.deleteConversation(conversationId);
    if (projectId) this.notify(projectId, `conversation:${conversationId}`, true);
  }
  async updateTitle(conversationId: string, title: string): Promise<void> {
    await this.inner.updateTitle(conversationId, title);
    const projectId = await this.projectId(conversationId);
    if (projectId) this.notify(projectId, `conversation:${conversationId}`, false);
  }
  private async projectId(id: string): Promise<string | undefined> {
    const rows = await this.db.select<{ project_id: string }[]>(
      "SELECT project_id FROM ai_conversations WHERE id = ?", [id],
    );
    return rows[0]?.project_id;
  }
  private notify(projectId: string, rowId: string, deleted: boolean): void {
    mobileLocalWrites.notify({ domain: "ai_conversations", projectId, rowId, deleted });
  }
}
