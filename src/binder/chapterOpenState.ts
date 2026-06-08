/**
 * Persistent chapter open/closed state backed by localStorage.
 *
 * Storage key:  `writing.binder.openChapters`
 * Schema:       JSON `Record<string, boolean>` — chapterId → open.
 * Default-open: a missing or corrupt entry returns `true` so all chapters
 *               appear expanded on first launch (Decision 1, wave-29-binder-tree).
 */

import { useState } from "react";

export const STORAGE_KEY = "writing.binder.openChapters";

function readMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage quota exceeded or access denied — silently ignore.
  }
}

export function isChapterOpen(chapterId: string): boolean {
  const stored = readMap()[chapterId];
  return stored === undefined ? true : stored;
}

export function setChapterOpen(chapterId: string, open: boolean): void {
  const map = readMap();
  map[chapterId] = open;
  writeMap(map);
}

export function useChapterOpen(chapterId: string): [boolean, () => void] {
  const [open, setOpen] = useState(() => isChapterOpen(chapterId));
  const toggle = () => {
    const next = !open;
    setOpen(next);
    setChapterOpen(chapterId, next);
  };
  return [open, toggle];
}
