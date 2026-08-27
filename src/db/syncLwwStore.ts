export interface SyncLwwRow {
  domain: string; projectId: string | null; rowId: string; hlc: string;
  deviceId: string; deleted: boolean; payloadJson: string | null; updatedAt: string | null;
}

export interface SyncLwwStore {
  get(domain: string, rowId: string): Promise<SyncLwwRow | null>;
  putIfNewer(row: SyncLwwRow): Promise<boolean>;
  list(domain: string, projectId: string | null, after?: string, limit?: number): Promise<SyncLwwRow[]>;
  listScopes(): Promise<Array<{ domain: string; projectId: string | null }>>;
  /**
   * Highest HLC currently in the ledger, any domain. Used to re-arm the
   * in-process clock after a restart so a local edit cannot stamp behind a
   * row we already accepted.
   */
  maxHlc(): Promise<string | null>;
  /**
   * Every row id the ledger knows for a domain, tombstones INCLUDED.
   *
   * The tombstones are the point: seeding treats this as "already accounted
   * for", and a set that filtered deletions out would re-seed a deleted row as
   * live and resurrect it on every device.
   */
  listRowIds(domain: string): Promise<Set<string>>;
}
