import type { LabelStore } from "../shared/labelStore";
import type { SnapshotStore } from "../shared/snapshotStore";
import type { StoryBibleStore } from "../shared/storyBibleStore";
import { getMobileDb } from "./database";
import { MobileAiContextStore } from "./mobileAiContextStore";
import { MobileAiConversationStore } from "./mobileAiConversationStore";
import { MobileArchiveStore } from "./mobileArchiveStore";
import { MobileBinderStore } from "./mobileBinderStore";
import { MobileBoardsStore } from "./mobileBoardsStore";
import { MobileGoalsStore } from "./mobileGoalsStore";
import { MobileLabelStore } from "./mobileLabelStore";
import { MobileLicenseStore } from "./mobileLicenseStore";
import { MobileQuickNoteStore } from "./mobileQuickNoteStore";
import { MobileSearchStore } from "./mobileSearchStore";
import { MobileSnapshotStore } from "./mobileSnapshotStore";
import { MobileStoryBibleStore } from "./mobileStoryBibleStore";
import { MobileTrialStore } from "./mobileTrialStore";

type Factory<T> = (db: Awaited<ReturnType<typeof getMobileDb>>) => T;
function memo<T>(factory: Factory<T>): () => Promise<T> {
  let value: Promise<T> | undefined;
  return () => (value ??= getMobileDb().then(factory));
}

export const getBinderStore = memo((db) => new MobileBinderStore(db));
export const getLabelStore = memo<LabelStore>((db) => new MobileLabelStore(db));
export const getStoryBibleStore = memo<StoryBibleStore>((db) => new MobileStoryBibleStore(db));
export const getGoalsStore = memo((db) => new MobileGoalsStore(db));
export const getQuickNoteStore = memo((db) => new MobileQuickNoteStore(db));
export const getSnapshotStore = memo<SnapshotStore>((db) => new MobileSnapshotStore(db));
export const getBoardsStore = memo((db) => new MobileBoardsStore(db));
export const getArchiveStore = memo((db) => new MobileArchiveStore(db));
export const getSearchStore = memo((db) => new MobileSearchStore(db));
export const getAiConversationStore = memo((db) => new MobileAiConversationStore(db));
export const getAiContextStore = memo((db) => new MobileAiContextStore(db));
export const getLicenseStore = memo((db) => new MobileLicenseStore(db));
export const getTrialStore = memo((db) => new MobileTrialStore(db));
