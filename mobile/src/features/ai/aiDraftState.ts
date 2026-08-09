import type { VerbKey } from "../../shared/aiCatalog";

let pendingVerb: VerbKey = "ask";

export function setPendingVerb(verb: VerbKey): void { pendingVerb = verb; }
export function takePendingVerb(): VerbKey { const value = pendingVerb; pendingVerb = "ask"; return value; }
