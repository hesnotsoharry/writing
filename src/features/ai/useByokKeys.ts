/**
 * useByokKeys — returns a presence MAP for all BYOK providers.
 *
 * W49 Phase 3 replaces the two provisional boolean hooks (useByokMode +
 * useOpenAiByokMode) with a single hook that tracks BOTH providers.
 * Decision 4: both keys can be present simultaneously — this is a MAP,
 * not a mutually-exclusive discriminant. The active provider for a given
 * request is resolved by the model picker in Phase 4.
 *
 * Subscribes to:
 *  - `byok:key-changed`        (Anthropic)
 *  - `byok:openai-key-changed` (OpenAI)
 *
 * Both subscriptions use .catch→false so a keychain read failure (e.g. no
 * Tauri runtime in jsdom) never leaves unhandled rejections.
 */
import { useEffect, useState } from "react";

import { byokHasKey } from "./byok.client";
import { byokOpenAiHasKey } from "./byok.openai.client";

/** Provider key-presence MAP. Both keys can be set simultaneously (Decision 4). */
export interface ByokKeys {
  anthropic: boolean;
  openai: boolean;
}

/**
 * Returns the provider presence map plus a convenience `byokActive` flag
 * that is true when ANY BYOK key is present.
 *
 * `byokActive` is suitable for: managed-meter suppression, badge visibility,
 * and canCompose gating. Use the individual flags for provider-specific display.
 */
export function useByokKeys(): ByokKeys & { byokActive: boolean } {
  const [anthropic, setAnthropic] = useState(false);
  const [openai, setOpenai] = useState(false);

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

    syncAnthropic();
    syncOpenai();

    window.addEventListener("byok:key-changed", syncAnthropic);
    window.addEventListener("byok:openai-key-changed", syncOpenai);

    return () => {
      cancelled = true;
      window.removeEventListener("byok:key-changed", syncAnthropic);
      window.removeEventListener("byok:openai-key-changed", syncOpenai);
    };
  }, []);

  return { anthropic, openai, byokActive: anthropic || openai };
}
