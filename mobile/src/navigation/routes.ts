export type EntityTypeParam =
  | "character"
  | "location"
  | "item"
  | "faction"
  | "lore"
  | "theme"
  | string;

export type RootStackParamList = {
  ProjectList: undefined;
  Hub: { projectId: string; projectTitle: string };
  Scene: { sceneId: string; sceneTitle: string; projectId?: string; projectTitle?: string };
  ProjectBinder: { projectId: string; projectTitle: string };
  Inspector: { projectId: string; sceneId: string; sceneTitle: string };
  Corkboard: { projectId: string; projectTitle: string };
  Outliner: { projectId: string; projectTitle: string };
  Search: { projectId: string; projectTitle: string };
  BibleList: { projectId: string; projectTitle: string };
  BibleEntry: { projectId: string; entityId: string; entityType: EntityTypeParam };
  BibleEntryScrolled: { projectId: string; entityId: string; entityType: EntityTypeParam };
  BibleEntryLocation: { projectId: string; entityId: string };
  AutoLinkPeek: { projectId: string; sceneId: string; entityId: string;
    entityType: EntityTypeParam; anchor?: { x: number; y: number; width: number; height: number } };
  RelationshipMap: { projectId: string; selectedEntityId?: string };
  BoardViewer: { projectId: string; boardId?: string };
  Goals: { projectId: string };
  VersionHistoryEmpty: { projectId: string; sceneId: string };
  Inbox: { projectId: string };
  AiAssistant: { projectId: string; sceneId?: string; conversationId?: string };
  Pair: undefined;
  Settings: { projectId?: string } | undefined;
  FocusHud: { projectId: string; sceneId: string };
  SelectionActions: { projectId: string; sceneId: string };
  AiContext: { projectId: string; sceneId?: string; conversationId?: string };
  AiModel: { projectId: string; conversationId?: string };
  HiddenFromAi: { projectId: string; sceneId: string };
  AiLimits: { projectId: string; reason: "managed-refusal" | "out-of-credit" };
  SceneActions: { projectId: string; sceneId: string };
  NewGoal: { projectId: string; initialType?: string; goalId?: string };
  Archive: { projectId: string };
  EmptyProject: { projectId: string; projectTitle: string };
  OfflineCatchUp: { projectId?: string } | undefined;
  Activation: { reason?: "missing" | "expired" } | undefined;
  Trial: { projectId: string; projectTitle: string };
  NewEntry: { projectId: string; initialType?: EntityTypeParam };
  CustomType: { projectId: string };
  SceneVersionHistory: { projectId: string; sceneId: string; snapshotId?: string };
};
