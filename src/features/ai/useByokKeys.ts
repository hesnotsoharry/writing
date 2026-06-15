/**
 * useByokKeys — returns a presence MAP for all BYOK providers.
 *
 * W49 Phase 3 replaced the two provisional boolean hooks (useByokMode +
 * useOpenAiByokMode) with a single hook that tracks BOTH providers.
 * W45 Phase 4 adds 'local' (custom OpenAI-compatible endpoint) tracking.
 *
 * Decision 4: keys can be present simultaneously — this is a MAP, not a
 * mutually-exclusive discriminant. The active provider for a given request is
 * resolved by the model picker (Phase 4).
 *
 * Subscribes to:
 *  - `byok:key-changed`              (Anthropic)
 *  - `byok:openai-key-changed`       (OpenAI)
 *  - `byok:local-key-changed`        (local — fired by byok.local.client)
 *  - `custom-endpoint:key-changed`   (local — fired by customEndpoints.client)
 *
 * All subscriptions use .catch→false so a keychain read failure (e.g. no
 * Tauri runtime in jsdom) never leaves unhandled rejections.
 */
import { useEffect, useState } from "react";

import { SETTINGS_CHANGED_EVENT } from "../../lib/settings";
import { byokHasKey } from "./byok.client";
import { byokLocalHasKey } from "./byok.local.client";
import { byokOpenAiHasKey } from "./byok.openai.client";

/**
 * Provider key-presence MAP. All keys can be set simultaneously (Decision 4).
 * `local` is optional to preserve backward compat with existing test fixtures
 * that pass `{ anthropic, openai }` — the cast in routeByokSend already uses
 * `Partial<Record<ProviderId, boolean>>` so missing local = false.
 *
 * Phase 5: `local` is true when a default endpoint is configured (keyless or
 * keyed), not just when an API key is present in the keychain.
 */
export interface ByokKeys {
  anthropic: boolean;
  openai: boolean;
  /** W45 Phase 5: true when a default local endpoint is configured (keyless OR keyed). */
  local?: boolean;
}

/**
 * Returns the provider presence map plus a convenience `byokActive` flag
 * that is true when ANY BYOK key is present (including local).
 *
 * `byokActive` is suitable for: managed-meter suppression, badge visibility,
 * and canCompose gating. Use the individual flags for provider-specific display.
 */
export function useByokKeys(): ByokKeys & { byokActive: boolean } {
  const [anthropic, setAnthropic] = useState(false);
  const [openai, setOpenai] = useState(false);
  const [local, setLocal] = useState(false); // W45 Phase 4

  useEffect(() => {
    let cancelled = false;

    const syncAnthropic = () => {
      byokHasKey()
        .then((has) => { if (!cancelled) setAnthropic(has); })
        .catch(() => { if (!cancelled) setAnthropic(false); });
    };

    const syncOpenai = () => {
      byokOpenAiHasKey()
        .then((has) => { if (!cancelled) setOpenai(has); })
        .catch(() => { if (!cancelled) setOpenai(false); });
    };

    // W45 Phase 4: track the default local endpoint's key presence.
    // Two events cover both byok.local.client (direct key set/clear) and
    // customEndpoints.client (Settings UI key set/clear via the endpoint manager).
    const syncLocal = () => {
      byokLocalHasKey()
        .then((has) => { if (!cancelled) setLocal(has); })
        .catch(() => { if (!cancelled) setLocal(false); });
    };

    syncAnthropic();
    syncOpenai();
    syncLocal();

    window.addEventListener("byok:key-changed", syncAnthropic);
    window.addEventListener("byok:openai-key-changed", syncOpenai);
    window.addEventListener("byok:local-key-changed", syncLocal);
    window.addEventListener("custom-endpoint:key-changed", syncLocal); // Settings UI key set/clear
    window.addEventListener(SETTINGS_CHANGED_EVENT, syncLocal); // endpoint add/delete/set-default

    return () => {
      cancelled = true;
      window.removeEventListener("byok:key-changed", syncAnthropic);
      window.removeEventListener("byok:openai-key-changed", syncOpenai);
      window.removeEventListener("byok:local-key-changed", syncLocal);
      window.removeEventListener("custom-endpoint:key-changed", syncLocal);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, syncLocal);
    };
  }, []);

  // W45 Phase 4: byokActive = anthropic || openai || local (trap guard — see ADR 0013 W45 correction)
  return { anthropic, openai, local, byokActive: anthropic || openai || local };
}
