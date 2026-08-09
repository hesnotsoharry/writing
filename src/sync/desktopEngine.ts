import { getTweak, TWEAK_DEFAULTS } from "../features/settings/settings.store";
import { installDesktopLwwBridges } from "./desktopLwwBridges";
import { SyncEngine } from "./engine";
import { defaultEngineOptions, desktopDbClient } from "./engineDefaults";
import { LwwDomainRegistry } from "./lww/registry";
import { createLwwLocalBridges, registerLwwDomains } from "./lwwDomains";

const lwwRegistry = new LwwDomainRegistry();
export const lwwDomains = registerLwwDomains(lwwRegistry, desktopDbClient(), {
  aiConversationsEnabled: readAiSyncSetting(),
});
export const syncEngine = new SyncEngine({ ...defaultEngineOptions(), lwwRegistry });
export const lwwBridges = createLwwLocalBridges(
  (mutation) => syncEngine.publishRow(mutation),
  lwwDomains.aiConversationsEnabled,
);
installDesktopLwwBridges(lwwBridges);

export function setAiConversationsSyncEnabled(enabled: boolean): void {
  lwwDomains.setAiConversationsEnabled(enabled);
}

function readAiSyncSetting(): boolean {
  if (typeof localStorage === "undefined") return TWEAK_DEFAULTS.syncAiConversations;
  return getTweak("syncAiConversations", TWEAK_DEFAULTS.syncAiConversations);
}
