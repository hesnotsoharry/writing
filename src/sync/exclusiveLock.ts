/**
 * Single-process promise tail for a CRDT row. Local bridges and inbound merge
 * both load-modify-save the same SQLite TEXT snapshot; without a shared tail
 * the later save is a full overwrite and the other mutation vanishes.
 */
const tails = new Map<string, Promise<unknown>>();

export function exclusive<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const prior = tails.get(key) ?? Promise.resolve();
  const current = prior.catch(() => undefined).then(operation);
  const tail = current.then(() => undefined, () => undefined);
  tails.set(key, tail);
  const clear = (): void => {
    if (tails.get(key) === tail) tails.delete(key);
  };
  void tail.then(clear);
  return current;
}

export function exclusiveMetaDoc<T>(
  projectId: string, operation: () => Promise<T>,
): Promise<T> {
  return exclusive(`meta:${projectId}`, operation);
}

export function exclusiveDomainDoc<T>(
  domain: string, projectId: string, operation: () => Promise<T>,
): Promise<T> {
  return exclusive(`domain:${domain}:${projectId}`, operation);
}
