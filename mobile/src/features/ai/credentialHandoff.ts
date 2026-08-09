import { AI_MODELS, DEFAULT_MODEL, type ManagedModel } from "../../shared/aiCatalog";
import {
  type CredentialAckMessage,
  type CredentialOfferMessage,
  isCredentialOfferMessage,
} from "../../shared/messages";
import { type MobileAiClient, mobileAiClient, type SessionResult } from "./mobileAiClient";

const SECURE_KEY = "writersnook.managed-ai.v1";

interface SecureStorePort {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface ManagedAiCredential {
  kind: "license" | "trial";
  key: string;
  aiModel: ManagedModel;
  aiEnabled: boolean;
}

interface StoredManagedAi extends ManagedAiCredential { seenOfferIds: string[] }

export type ManagedAiAvailability =
  | { state: "available"; credential: ManagedAiCredential; session: SessionResult }
  | { state: "unavailable"; message: "Set up managed AI on desktop" }
  | { state: "replayed" };

export interface CredentialConsumerDeps {
  secureStore?: SecureStorePort;
  client?: Pick<MobileAiClient, "acquireSession" | "acquireTrialSession">;
}

let sessionCache: SessionResult | null = null;
let unavailableInMemory = false;

async function storePort(deps: CredentialConsumerDeps): Promise<SecureStorePort> {
  if (deps.secureStore) return deps.secureStore;
  return import("expo-secure-store");
}

function credentialFromOffer(offer: CredentialOfferMessage): ManagedAiCredential {
  const { managed } = offer;
  const aiModel: ManagedModel = managed.aiModel in AI_MODELS
    ? managed.aiModel as ManagedModel : DEFAULT_MODEL;
  if (managed.aiLicenseKey !== undefined) {
    return { kind: "license", key: managed.aiLicenseKey, aiModel, aiEnabled: managed.aiEnabled };
  }
  return { kind: "trial", key: managed.aiTrialKey ?? "", aiModel, aiEnabled: managed.aiEnabled };
}

async function readStored(store: SecureStorePort): Promise<StoredManagedAi | null> {
  const raw = await store.getItemAsync(SECURE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as StoredManagedAi;
    if (!value.key || !Array.isArray(value.seenOfferIds)) return null;
    return { ...value, aiModel: value.aiModel in AI_MODELS ? value.aiModel as ManagedModel : DEFAULT_MODEL };
  } catch { return null; }
}

async function mint(
  credential: ManagedAiCredential,
  client: Pick<MobileAiClient, "acquireSession" | "acquireTrialSession">,
): Promise<SessionResult> {
  if (credential.kind === "license") return client.acquireSession(credential.key);
  return client.acquireTrialSession(credential.key);
}

function ack(id: string, accepted: boolean): CredentialAckMessage {
  return { t: "credential-ack", id, accepted };
}

export interface CredentialOfferResult {
  ack: CredentialAckMessage;
  availability: ManagedAiAvailability;
}

export async function consumeCredentialOffer(
  value: unknown, deps: CredentialConsumerDeps = {},
): Promise<CredentialOfferResult> {
  if (!isCredentialOfferMessage(value)) {
    unavailableInMemory = true;
    const id = recordId(value);
    return { ack: ack(typeof id === "string" ? id : "invalid", false),
      availability: { state: "unavailable", message: "Set up managed AI on desktop" } };
  }
  const store = await storePort(deps);
  const previous = await readStored(store);
  if (previous?.seenOfferIds.includes(value.id)) {
    return { ack: ack(value.id, false), availability: { state: "replayed" } };
  }
  const credential = credentialFromOffer(value);
  const session = await mint(credential, deps.client ?? mobileAiClient);
  const seenOfferIds = [...new Set([...(previous?.seenOfferIds ?? []), value.id])];
  await store.setItemAsync(SECURE_KEY, JSON.stringify({ ...credential, seenOfferIds }));
  sessionCache = session;
  unavailableInMemory = false;
  return { ack: ack(value.id, true), availability: { state: "available", credential, session } };
}

function recordId(value: unknown): unknown {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>)["id"] : undefined;
}

export async function getManagedAiAccess(
  deps: CredentialConsumerDeps = {},
): Promise<ManagedAiAvailability> {
  if (unavailableInMemory) return { state: "unavailable", message: "Set up managed AI on desktop" };
  const stored = await readStored(await storePort(deps));
  if (!stored || !stored.aiEnabled) return { state: "unavailable", message: "Set up managed AI on desktop" };
  const credential: ManagedAiCredential = stored;
  if (!sessionCache || sessionCache.expiresAt <= Date.now() + 30_000) {
    sessionCache = await mint(credential, deps.client ?? mobileAiClient);
  }
  return { state: "available", credential, session: sessionCache };
}

export async function updateManagedModel(model: ManagedModel, deps: CredentialConsumerDeps = {}): Promise<void> {
  const store = await storePort(deps);
  const stored = await readStored(store);
  if (!stored) return;
  await store.setItemAsync(SECURE_KEY, JSON.stringify({ ...stored, aiModel: model }));
}

export async function currentManagedModel(deps: CredentialConsumerDeps = {}): Promise<ManagedModel> {
  const stored = await readStored(await storePort(deps));
  return stored?.aiModel && stored.aiModel in AI_MODELS ? stored.aiModel as ManagedModel : DEFAULT_MODEL;
}

export function clearSessionFromMemory(): void { sessionCache = null; }

export async function markByokOnlyUnavailable(deps: CredentialConsumerDeps = {}): Promise<void> {
  sessionCache = null;
  unavailableInMemory = true;
  await (await storePort(deps)).deleteItemAsync(SECURE_KEY);
}
