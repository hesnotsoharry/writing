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
  return makeAiConversationStore(proxyDb);
}
