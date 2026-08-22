import type { SyncQueueDepth } from "../../shared/engine";

/** Pending work survives an unpair — the outbox is not cleared — so the count
 *  stays meaningful with nobody to send to. Summed across the four buckets
 *  because the unpaired card reports one number, not a breakdown; the paired
 *  card's Review queue is where the split belongs. */
export function pendingChangeCount(queue: SyncQueueDepth | null | undefined): number {
  if (!queue) return 0;
  return queue.scenes + queue.notes + queue.boards + queue.rows;
}

/** Null when there is nothing waiting, so the caller renders no line at all
 *  rather than a reassuring "0 changes" that draws the eye for no reason. */
export function pendingChangeLabel(count: number): string | null {
  if (count <= 0) return null;
  const subject = count === 1 ? "1 change is" : `${count} changes are`;
  return `${subject} waiting, and will sync when you pair again.`;
}
