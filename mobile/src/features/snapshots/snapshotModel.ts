import { type DiffToken,diffWords } from "../../shared/diffWords";
import type { Snapshot } from "../../shared/snapshotStore";

export interface SnapshotListItem extends Snapshot {
  displayLabel: string;
  when: string;
  delta: number;
  deltaLabel: string;
}

export function snapshotLabel(snapshot: Snapshot): string {
  return snapshot.label?.trim() || (snapshot.kind === "auto" ? "Auto-save" : "Manual");
}

export function formatRelativeTime(createdAt: number, now = Date.now()): string {
  const minutes = Math.floor((now - createdAt) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(createdAt).toLocaleDateString();
}

export function snapshotListModel(snapshot: Snapshot, currentWords: number, now = Date.now()): SnapshotListItem {
  const delta = snapshot.wordCount - currentWords;
  return { ...snapshot, displayLabel: snapshotLabel(snapshot), when: formatRelativeTime(snapshot.createdAt, now), delta, deltaLabel: delta === 0 ? "±0" : delta > 0 ? `+${delta}` : `−${Math.abs(delta)}` };
}

export type DiffVisualKey = "same" | "in-version" | "in-current";
export interface DiffRun { text: string; key: DiffVisualKey }

function visualKey(token: DiffToken): DiffVisualKey {
  if (token.t === "add") return "in-version";
  if (token.t === "del") return "in-current";
  return "same";
}

export function diffRenderingModel(currentText: string, versionText: string): DiffRun[] {
  return diffWords(currentText, versionText).map((token) => ({ text: token.v, key: visualKey(token) }));
}

export function diffRunCounts(runs: readonly DiffRun[]): { added: number; removed: number } {
  return { added: runs.filter(({ key }) => key === "in-version").length, removed: runs.filter(({ key }) => key === "in-current").length };
}
