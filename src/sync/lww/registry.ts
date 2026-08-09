export interface LwwDomainAdapter {
  domain: string;
  readPayload(rowId: string): Promise<string | null>;
  projectReceived(rowId: string, projectId: string | null, payloadJson: string): Promise<void>;
  applyTombstone(rowId: string, projectId: string | null): Promise<void>;
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
