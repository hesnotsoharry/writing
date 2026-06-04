import type { NSpell } from "nspell";
import nspell from "nspell";

import affUrl from "../assets/en-US.aff?url";
import dicUrl from "../assets/en-US.dic?url";

// Re-export for callers that need the type.
export type { NSpell };

// Singleton promise — resolved once, shared across all callers.
let spellerPromise: Promise<NSpell> | null = null;

/**
 * Returns the shared NSpell instance, loading the dictionary on first call.
 * Subsequent calls return the same cached promise (fetch runs only once).
 */
export function getSpeller(): Promise<NSpell> {
  if (spellerPromise === null) {
    spellerPromise = loadSpeller();
  }
  return spellerPromise;
}

async function loadSpeller(): Promise<NSpell> {
  const [affResponse, dicResponse] = await Promise.all([
    fetch(affUrl),
    fetch(dicUrl),
  ]);

  if (!affResponse.ok) {
    throw new Error(
      `Failed to fetch dictionary .aff (${affResponse.status} ${affResponse.statusText})`,
    );
  }
  if (!dicResponse.ok) {
    throw new Error(
      `Failed to fetch dictionary .dic (${dicResponse.status} ${dicResponse.statusText})`,
    );
  }

  const [aff, dic] = await Promise.all([
    affResponse.text(),
    dicResponse.text(),
  ]);

  return nspell(aff, dic);
}
