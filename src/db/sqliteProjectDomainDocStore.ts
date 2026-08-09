import { DbProjectDomainDocStore, type ProjectDomainDocStore } from "./projectDomainDocStore";
import { getDb } from "./schema";

export class SqliteProjectDomainDocStore implements ProjectDomainDocStore {
  private async store(): Promise<DbProjectDomainDocStore> {
    return new DbProjectDomainDocStore(await getDb());
  }
  async load(domain: string, projectId: string): Promise<string | null> {
    return (await this.store()).load(domain, projectId);
  }
  async save(domain: string, projectId: string, stateBase64: string): Promise<void> {
    await (await this.store()).save(domain, projectId, stateBase64);
  }
  async listAll() { return (await this.store()).listAll(); }
}
