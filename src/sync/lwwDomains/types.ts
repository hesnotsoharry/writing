import type { LocalRowMutation } from "../lww/publisher";

export type PublishLocalRow = (mutation: LocalRowMutation) => Promise<boolean>;

export interface DomainWriteBridge {
  saved(projectId: string | null, rowId: string): Promise<boolean>;
  deleted(projectId: string | null, rowId: string): Promise<boolean>;
}

export interface AiConversationWriteBridge {
  conversationSaved(projectId: string, conversationId: string): Promise<boolean>;
  conversationDeleted(projectId: string, conversationId: string): Promise<boolean>;
  messageAppended(projectId: string, messageId: string): Promise<boolean>;
}
