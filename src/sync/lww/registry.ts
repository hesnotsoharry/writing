/** One pre-existing row, as the domain's own table sees it. */
export interface LwwSeedRow {
  rowId: string;
  projectId: string | null;
  /** The row's own timestamp in epoch ms, or 0 when the table keeps none. */
  stampMs: number;
}

export interface LwwDomainAdapter {
  domain: string;
  readPayload(rowId: string): Promise<string | null>;
  projectReceived(rowId: string, projectId: string | null, payloadJson: string): Promise<void>;
  applyTombstone(rowId: string, projectId: string | null): Promise<void>;
  /**
   * Enumerates the domain's existing rows so first sync can seed the version
   * ledger from the source of truth.
   *
   * Without this the row path advertises only what `sync_lww_rows` has
   * accumulated from mutations, and that table starts empty — so every row
   * written before sync was switched on is invisible to reconciliation and
   * never reaches a newly paired device.
   *
   * Optional because a domain that cannot enumerate itself is still a valid
   * domain (test fixtures register such adapters); it simply is not seeded.
   */
  listSeedRows?(): Promise<LwwSeedRow[]>;
}

export class LwwDomainRegistry {
  private readonly domains = new Map<string, LwwDomainAdapter>();

  register(adapter: LwwDomainAdapter): () => void {
    if (this.domains.has(adapter.domain)) throw new Error(`LWW domain already registered: ${adapter.domain}`);
    this.domains.set(adapter.domain, adapter);
    return () => this.domains.delete(adapter.domain);
  }

  get(domain: string): LwwDomainAdapter | null { return this.domains.get(domain) ?? null; }
  names(): string[] { return [...this.domains.keys()].sort(); }
}
