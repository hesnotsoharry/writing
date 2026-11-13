/**
 * classify.ts — group title-like lines by *why* they look like titles, then
 * guess what each group is (chapter, scene, scene break, or plain text).
 *
 * Every format goes through this one classifier. A line joins at most one
 * group, chosen by the strongest clue it carries: the file's own heading
 * structure, then "Chapter 7"-style patterns, then appearance (bold, larger,
 * centred, capitals, starts a page), then list nesting. The user can change any
 * group's role in the import preview; these are only the starting guesses.
 */
import type { ImportLine } from "./importLine";
import { groupLabel, lookFeatures, lookStrength, PATTERNS } from "./lineClues";

export type Role = "chapter" | "scene" | "text" | "split";
export type GroupKind = "level" | "pattern" | "look" | "list" | "break";

export interface LineGroup {
  /** Stable id: "level:1", "pattern:chapter", "look:bold+large", "list:0", "break". */
  key: string;
  kind: GroupKind;
  label: string;
  /** Indexes into the classified line list, in document order. */
  lines: number[];
  /** Up to three sample lines for the preview. */
  examples: string[];
  role: Role;
  strength: number;
}

export interface Classification {
  lines: ImportLine[];
  groups: LineGroup[];
  /** groupKey[i] is the key of line i's group, or null for ordinary text. */
  groupKey: (string | null)[];
}

const MAX_TITLE_WORDS = 12;
const MAX_TITLE_CHARS = 100;

/** Short, single-line, and not shaped like a sentence. */
export function isTitleShaped(text: string): boolean {
  if (text.includes("\n") || text.length > MAX_TITLE_CHARS) return false;
  if (text.split(/\s+/).length > MAX_TITLE_WORDS) return false;
  return /[\p{L}\p{N}]/u.test(text) && !/[.,;:]$/.test(text);
}

function patternKey(text: string): string | null {
  for (const [name, re] of PATTERNS) if (re.test(text)) return `pattern:${name}`;
  return null;
}

/** The single strongest clue a line carries, as a group key. */
export function clueKey(line: ImportLine): string | null {
  if (line.sceneBreak) return "break";
  if (line.level !== null) return `level:${line.level}`;
  // In a list, the nesting is the structure ("Act One" bullets stay bullets).
  if (line.listLevel !== null) return `list:${Math.min(line.listLevel, 3)}`;
  const titled = isTitleShaped(line.text);
  const pattern = titled ? patternKey(line.text) : null;
  if (pattern) return pattern;
  const look = titled ? lookFeatures(line) : [];
  return look.length > 0 ? `look:${look.join("+")}` : null;
}

function kindOf(key: string): GroupKind {
  return key.split(":")[0] as GroupKind;
}

function collectGroups(lines: ImportLine[], groupKey: (string | null)[]): LineGroup[] {
  const byKey = new Map<string, LineGroup>();
  groupKey.forEach((key, i) => {
    if (!key) return;
    let g = byKey.get(key);
    if (!g) {
      const kind = kindOf(key);
      g = { key, kind, label: groupLabel(key), lines: [], examples: [], role: "text", strength: 0 };
      if (kind === "look") g.strength = lookStrength(key);
      byKey.set(key, g);
    }
    g.lines.push(i);
    if (g.examples.length < 3) g.examples.push(lines[i].text);
  });
  return [...byKey.values()];
}

const KIND_ORDER: GroupKind[] = ["level", "pattern", "look", "list", "break"];

function sortGroups(groups: LineGroup[]): LineGroup[] {
  return [...groups].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
    || b.strength - a.strength || a.key.localeCompare(b.key, undefined, { numeric: true }));
}

/** Group a document's lines and guess a role for every group. */
export function classify(lines: ImportLine[]): Classification {
  const groupKey = lines.map(clueKey);
  const groups = sortGroups(collectGroups(lines, groupKey));
  assignDefaultRoles(groups);
  return { lines, groups, groupKey };
}

const find = (groups: LineGroup[], key: string) => groups.find((g) => g.key === key);

function setRole(g: LineGroup | undefined, role: Role) {
  if (g) g.role = role;
}

/** The file's own heading levels: top two used become chapter and scene. */
function assignByLevels(groups: LineGroup[]): boolean {
  const levels = groups.filter((g) => g.kind === "level");
  if (levels.length === 0) return false;
  setRole(levels[0], "chapter");
  setRole(levels[1], "scene");
  return true;
}

/** "Chapter 7" / "Part Two" / bare "12" lines. */
function assignByPatterns(groups: LineGroup[]): boolean {
  const chapters = [find(groups, "pattern:chapter"), find(groups, "pattern:number")].filter(Boolean) as LineGroup[];
  if (chapters.reduce((n, g) => n + g.lines.length, 0) >= 2) {
    chapters.forEach((g) => setRole(g, "chapter"));
    return true;
  }
  const parts = find(groups, "pattern:part");
  if (parts && parts.lines.length >= 2) { setRole(parts, "chapter"); return true; }
  return false;
}

/** Strongest repeated look → chapters; a more frequent, weaker look → scenes. */
function assignByLooks(groups: LineGroup[]): boolean {
  const looks = groups.filter((g) => g.kind === "look" && g.lines.length >= 2);
  if (looks.length === 0) return false;
  setRole(looks[0], "chapter");
  const firstChapter = looks[0].lines[0];
  const scenes = looks.slice(1).find((g) => g.lines.length > looks[0].lines.length && g.lines[g.lines.length - 1] > firstChapter);
  setRole(scenes, "scene");
  return true;
}

/** Nested bullets: top level → chapters, next → scenes. A flat list → scenes. */
function assignByLists(groups: LineGroup[]): boolean {
  const top = find(groups, "list:0");
  const second = find(groups, "list:1");
  if (!top) return false;
  setRole(top, second ? "chapter" : "scene");
  setRole(second, "scene");
  return true;
}

/** Chapters found but no scenes: a repeated look under them (e.g. bold scene
 *  titles beneath "Chapter 7" lines), at least as common as the chapters, is scenes. */
function assignSceneLook(groups: LineGroup[]): void {
  const chapters = groups.filter((g) => g.role === "chapter");
  const count = chapters.reduce((n, g) => n + g.lines.length, 0);
  const first = Math.min(...chapters.map((g) => g.lines[0]));
  setRole(groups.find((g) => g.kind === "look" && g.role === "text" && g.lines.length >= Math.max(2, count)
    && g.lines[g.lines.length - 1] > first), "scene");
}

function assignDefaultRoles(groups: LineGroup[]): void {
  setRole(find(groups, "break"), "split");
  if (!(assignByLevels(groups) || assignByPatterns(groups) || assignByLooks(groups))) { assignByLists(groups); return; }
  if (!groups.some((g) => g.role === "scene")) assignSceneLook(groups);
}
