import type { AiConversationWriteBridge, DomainWriteBridge, PublishLocalRow } from "./types";

export const AI_CONVERSATIONS_SYNC_SETTING_KEY = "syncAiConversations";

function bridge(domain: string, publish: PublishLocalRow): DomainWriteBridge {
  const notify = (projectId: string | null, rowId: string, deleted: boolean) =>
    publish({ domain, projectId, rowId, deleted });
  return {
    saved: (projectId, rowId) => notify(projectId, rowId, false),
    deleted: (projectId, rowId) => notify(projectId, rowId, true),
  };
}

function aiBridge(
  publish: PublishLocalRow,
  enabled: () => boolean,
): AiConversationWriteBridge {
  const notify = (
    projectId: string,
    kind: "conversation" | "message",
    rowId: string,
    deleted: boolean,
  ) => enabled()
    ? publish({ domain: "ai_conversations", projectId, rowId: `${kind}:${rowId}`, deleted })
    : Promise.resolve(false);
  return {
    conversationSaved: (projectId, rowId) => notify(projectId, "conversation", rowId, false),
    conversationDeleted: (projectId, rowId) => notify(projectId, "conversation", rowId, true),
    messageAppended: (projectId, rowId) => notify(projectId, "message", rowId, false),
  };
}

export function createLwwLocalBridges(
  publish: PublishLocalRow,
  aiConversationsEnabled: () => boolean = () => false,
) {
  return {
    goals: bridge("goals", publish),
    quickNotes: bridge("quick_notes", publish),
    archive: bridge("archive", publish),
    sceneSnapshots: bridge("scene_snapshots", publish),
    boards: bridge("boards", publish),
    manuscriptAbout: bridge("manuscript_about", publish),
    aiConversations: aiBridge(publish, aiConversationsEnabled),
  };
}
