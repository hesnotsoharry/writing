export interface SyncLwwRow {
  domain: string; projectId: string | null; rowId: string; hlc: string;
  deviceId: string; deleted: boolean; payloadJson: string | null; updatedAt: string | null;
}

export interface SyncLwwStore {
  get(domain: string, rowId: string): Promise<SyncLwwRow | null>;
  putIfNewer(row: SyncLwwRow): Promise<boolean>;
  list(domain: string, projectId: string | null, after?: string, limit?: number): Promise<SyncLwwRow[]>;
  listScopes(): Promise<Array<{ domain: string; projectId: string | null }>>;
}
