import type { BehindScene, SyncQueueDepth } from "../../shared/engine";

export interface QueueItem { domain: string; itemId: string }

const EMPTY_QUEUE: SyncQueueDepth = { scenes: 0, notes: 0, boards: 0, rows: 0 };

function queueKey(domain: string): keyof SyncQueueDepth {
  if (domain === "scene") return "scenes";
  if (domain === "quick-notes" || domain === "notes") return "notes";
  if (domain === "board") return "boards";
  return "rows";
}

export function countDistinctQueueItems(items: readonly QueueItem[]): SyncQueueDepth {
  const result = { ...EMPTY_QUEUE };
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.domain}\u0000${item.itemId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result[queueKey(item.domain)] += 1;
  }
  return result;
}

function quantity(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function formatQueueDepth(queue: SyncQueueDepth | undefined): string {
  const value = queue ?? EMPTY_QUEUE;
  const parts = [
    value.scenes > 0 ? quantity(value.scenes, "scene") : null,
    value.notes > 0 ? quantity(value.notes, "note") : null,
    value.boards > 0 ? quantity(value.boards, "board") : null,
    value.rows > 0 ? quantity(value.rows, "other item") : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return "Nothing waiting to send";
  if (parts.length === 1) return `${parts[0]} to send`;
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)} to send`;
}

export function formatLastSeen(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "never";
  const elapsed = now - Date.parse(value);
  if (!Number.isFinite(elapsed)) return "never";
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export type BehindCardModel =
  | { kind: "not-behind"; actions: readonly [] }
  | { kind: "staged-replacement"; actions: readonly ["catch-up", "review"] }
  | { kind: "owner-absent"; actions: readonly [] };

export function behindCardModel(behind: readonly BehindScene[]): BehindCardModel {
  if (behind.length === 0) return { kind: "not-behind", actions: [] };
  if (behind.some((scene) => scene.replacementReady)) {
    return { kind: "staged-replacement", actions: ["catch-up", "review"] };
  }
  return { kind: "owner-absent", actions: [] };
}
