import type { DbClient } from "../shared/dbClient";
import {
  sqliteGetManuscriptAbout,
  sqliteGetSceneExcludedFromAi,
  sqliteGetSceneText,
  sqliteSetManuscriptAbout,
} from "../shared/sqliteAiContextStore";
import type { ManuscriptAbout } from "../shared/storyBibleStore";
import { mobileLocalWrites } from "./mobileLocalWriteBridge";

export class MobileAiContextStore {
  constructor(private readonly db: DbClient) {}
  getManuscriptAbout(projectId: string): Promise<ManuscriptAbout> {
    return sqliteGetManuscriptAbout(this.db, projectId);
  }
  async setManuscriptAbout(projectId: string, about: ManuscriptAbout): Promise<void> {
    await sqliteSetManuscriptAbout(this.db, projectId, about);
    mobileLocalWrites.notify({ domain: "manuscript_about", projectId, rowId: projectId, deleted: false });
  }
  getSceneText(sceneId: string): Promise<{ title: string; text: string } | null> {
    return sqliteGetSceneText(this.db, sceneId);
  }
  getSceneExcludedFromAi(sceneId: string): Promise<boolean> {
    return sqliteGetSceneExcludedFromAi(this.db, sceneId);
  }
}
