import { describe, expect, it } from "vitest";

import type { RootStackParamList } from "./routes";

const ROUTE_PARAMS = {
  ProjectList: undefined,
  Hub: { projectId: "p", projectTitle: "Project" },
  Scene: { projectId: "p", sceneId: "s", sceneTitle: "Scene" },
  ProjectBinder: { projectId: "p", projectTitle: "Project" },
  Inspector: { projectId: "p", sceneId: "s", sceneTitle: "Scene" },
  Corkboard: { projectId: "p", projectTitle: "Project" },
  Outliner: { projectId: "p", projectTitle: "Project" },
  Search: { projectId: "p", projectTitle: "Project" },
  BibleList: { projectId: "p", projectTitle: "Project" },
  BibleEntry: { projectId: "p", entityId: "e", entityType: "character" },
  BibleEntryScrolled: { projectId: "p", entityId: "e", entityType: "character" },
  BibleEntryLocation: { projectId: "p", entityId: "e" },
  AutoLinkPeek: { projectId: "p", sceneId: "s", entityId: "e", entityType: "character",
    anchor: { x: 1, y: 2, width: 3, height: 4 } },
  RelationshipMap: { projectId: "p", selectedEntityId: "e" },
  BoardViewer: { projectId: "p", boardId: "b" },
  Goals: { projectId: "p" },
  VersionHistoryEmpty: { projectId: "p", sceneId: "s" },
  Inbox: { projectId: "p" },
  AiAssistant: { projectId: "p", sceneId: "s", conversationId: "c" },
  Pair: undefined,
  Settings: { projectId: "p" },
  FocusHud: { projectId: "p", sceneId: "s" },
  SelectionActions: { projectId: "p", sceneId: "s" },
  AiContext: { projectId: "p", sceneId: "s", conversationId: "c" },
  AiModel: { projectId: "p", conversationId: "c" },
  HiddenFromAi: { projectId: "p", sceneId: "s" },
  AiLimits: { projectId: "p", reason: "managed-refusal" },
  SceneActions: { projectId: "p", sceneId: "s" },
  NewGoal: { projectId: "p", initialType: "daily", goalId: "g" },
  Archive: { projectId: "p" },
  EmptyProject: { projectId: "p", projectTitle: "Project" },
  OfflineCatchUp: undefined,
  Activation: { reason: "expired" },
  Trial: { projectId: "p", projectTitle: "Project" },
  NewEntry: { projectId: "p", initialType: "character" },
  CustomType: { projectId: "p" },
  SceneVersionHistory: { projectId: "p", sceneId: "s", snapshotId: "v" },
} satisfies RootStackParamList;

const OFFLINE_CATCH_UP_PARAMS = [
  undefined,
  { projectId: "p" },
] satisfies RootStackParamList["OfflineCatchUp"][];

describe("RootStackParamList", () => {
  it("declares params for all 37 designed screens", () => {
    expect(Object.keys(ROUTE_PARAMS)).toHaveLength(37);
  });

  it("supports device-wide and project-scoped offline queue routes", () => {
    expect(OFFLINE_CATCH_UP_PARAMS).toEqual([undefined, { projectId: "p" }]);
  });
});
