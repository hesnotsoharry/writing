import type { MobileSearchMatch } from "../../db/mobileSearchStore";

export type SearchScope = "manuscript" | "bible" | "note";

export interface SearchSnippet {
  before: string;
  match: string;
  after: string;
  offset: number;
}

export interface SearchSceneGroup {
  id: string;
  title: string;
  subtitle: string;
  matchCount: number;
  snippets: SearchSnippet[];
  result: MobileSearchMatch;
}

export interface SearchChapterGroup { title: string; scenes: SearchSceneGroup[] }

function paragraphAt(text: string, offset: number): { text: string; start: number } {
  const startBreak = text.lastIndexOf("\n", Math.max(0, offset - 1));
  const endBreak = text.indexOf("\n", offset);
  const start = startBreak < 0 ? 0 : startBreak + 1;
  const end = endBreak < 0 ? text.length : endBreak;
  return { text: text.slice(start, end), start };
}

export function extractSnippet(text: string, query: string, offset: number, radius = 42): SearchSnippet {
  const paragraph = paragraphAt(text, offset);
  const local = offset - paragraph.start;
  const start = Math.max(0, local - radius);
  const end = Math.min(paragraph.text.length, local + query.length + radius);
  const before = `${start > 0 ? "â€¦" : ""}${paragraph.text.slice(start, local)}`;
  const after = `${paragraph.text.slice(local + query.length, end)}${end < paragraph.text.length ? "â€¦" : ""}`;
  return { before, match: paragraph.text.slice(local, local + query.length), after, offset };
}

export function scopeCounts(results: readonly MobileSearchMatch[]): Record<SearchScope, number> {
  const counts: Record<SearchScope, number> = { manuscript: 0, bible: 0, note: 0 };
  results.forEach((result) => { counts[result.domain] += result.offsets.length; });
  return counts;
}

export function groupSearchResults(results: readonly MobileSearchMatch[], query: string, scope: SearchScope): SearchChapterGroup[] {
  const filtered = results.filter(({ domain }) => domain === scope);
  const groups = new Map<string, SearchSceneGroup[]>();
  filtered.forEach((result) => {
    const title = scope === "manuscript" ? result.subtitle : scope === "bible" ? "Story Bible" : "Notes";
    const scene = {
      id: result.id, title: result.title, subtitle: result.subtitle,
      matchCount: result.offsets.length,
      snippets: result.offsets.map((offset) => extractSnippet(result.text, query, offset)), result,
    };
    const current = groups.get(title) ?? [];
    current.push(scene); groups.set(title, current);
  });
  return [...groups].map(([title, scenes]) => ({ title, scenes }));
}

export type SearchRunner<T> = (query: string, signal: AbortSignal) => Promise<T>;

export class DebouncedSearch<T> {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private controller: AbortController | undefined;
  constructor(private readonly delay = 250) {}

  schedule(query: string, runner: SearchRunner<T>, deliver: (value: T) => void): void {
    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    this.timer = setTimeout(() => {
      void runner(query, controller.signal).then((value) => {
        if (!controller.signal.aborted) deliver(value);
      }).catch(() => undefined);
    }, this.delay);
  }

  cancel(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.controller?.abort();
    this.timer = undefined;
    this.controller = undefined;
  }
}
