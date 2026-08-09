import type { EngineOptions, SyncProvider } from "./engineTypes";
import type { EpochManager } from "./epochManager";
import { deriveKeys } from "./keys";
import type { DurableOutbox } from "./outbox";
import type { SyncQueueDepth } from "./statusEmitter";

export interface PreparedSession {
  encKey: CryptoKey; deviceId: string; provider: SyncProvider;
  lastPeerSeenAt: string | null; queue: SyncQueueDepth;
}

export async function prepareSession(
  options: EngineOptions, epochs: EpochManager, outbox: DurableOutbox | null,
  relayUrlOverride?: string,
): Promise<PreparedSession | null> {
  await Promise.all([
    options.ensureProjectMetas?.(),
    options.ensureProjectBibles?.(),
  ]);
  const masterKey = await options.readMasterKey();
  if (!masterKey) return null;
  const [{ roomId, encKey }, deviceId] = await Promise.all([
    deriveKeys(masterKey), options.getDeviceId(),
  ]);
  await epochs.initialize(deviceId, options.metaStore);
  const [lastPeerSeenAt, queue] = await Promise.all([
    options.loadLastPeerSeenAt?.() ?? Promise.resolve(null),
    outbox?.depth() ?? Promise.resolve(EMPTY_QUEUE),
  ]);
  const relayUrl = relayUrlOverride?.trim() || options.relayUrl;
  return { encKey, deviceId, lastPeerSeenAt, queue,
    provider: options.providerFactory(relayUrl, roomId, deviceId) };
}

const EMPTY_QUEUE: SyncQueueDepth = { scenes: 0, notes: 0, boards: 0, rows: 0 };
