/**
 * outlinePlan.ts — turn a Word outline (HTML from mammoth) into a plan of
 * chapters and scenes for the binder. Pure: no store, no Tauri.
 *
 * Headings (preferred — Word's Heading 1 / Heading 2 styles):
 *   - the highest heading level used → chapters; the next level → scenes
 *   - only one level used → each heading is a chapter holding one scene with its text
 *   - text under a scene heading → that scene's synopsis
 *   - text under a chapter heading before its first scene → a "Chapter notes" scene
 *   - text before the first heading → an "Outline notes" short piece
 * No headings → a nested bulleted list: top bullets → chapters, sub-bullets → scenes,
 * deeper bullets → synopsis. A flat list → one "Imported outline" chapter of scenes.
 */
import { childrenByTag, cleanText, elementLines, ownText, toSynopsis } from "./outlineText";

export interface OutlineScene { title: string; synopsis: string | null }
export interface OutlineChapter { title: string; scenes: OutlineScene[] }
export interface OutlinePlan {
  chapters: OutlineChapter[];
  /** Text found before the first heading — imported as an "Outline notes" short piece. */
  notes: string | null;
  source: "headings" | "lists";
}

/** A user-facing reason the file can't be imported as an outline. */
export class OutlineImportError extends Error {}

export const MAX_TITLE = 200;
/** Guards against importing a whole novel's prose as thousands of scenes by mistake. */
export const MAX_SCENES = 1000;

const HEADING = /^H([1-6])$/;
export const CHAPTER_NOTES_TITLE = "Chapter notes";
export const FALLBACK_CHAPTER_TITLE = "Imported outline";

function title(text: string): string {
  return text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE - 1)}…` : text;
}

function headingLevel(el: Element): number | null {
  const m = HEADING.exec(el.tagName);
  return m && cleanText(el.textContent) ? Number(m[1]) : null;
}

/** The chapter and (optional) scene heading levels — the two highest levels used. */
function headingLevels(elements: Element[]): { chapter: number; scene: number | null } | null {
  const used = [...new Set(elements.map(headingLevel).filter((l): l is number => l !== null))].sort((a, b) => a - b);
  if (used.length === 0) return null;
  return { chapter: used[0], scene: used[1] ?? null };
}

interface Draft { title: string; intro: string[]; scenes: Array<{ title: string; lines: string[] }> }

function finishChapter(d: Draft, singleLevel: boolean): OutlineChapter {
  const intro = toSynopsis(d.intro);
  const scenes = d.scenes.map((s) => ({ title: s.title, synopsis: toSynopsis(s.lines) }));
  if (intro && singleLevel) scenes.unshift({ title: d.title, synopsis: intro });
  else if (intro) scenes.unshift({ title: CHAPTER_NOTES_TITLE, synopsis: intro });
  return { title: d.title, scenes };
}

/** Where body text goes: the open scene, else the open chapter's intro, else pre-heading notes. */
function textTarget(cur: Draft | null, notes: string[]): string[] {
  if (!cur) return notes;
  return cur.scenes[cur.scenes.length - 1]?.lines ?? cur.intro;
}

function planFromHeadings(elements: Element[], levels: { chapter: number; scene: number | null }): OutlinePlan {
  const chapters: OutlineChapter[] = []; const notes: string[] = [];
  let cur: Draft | null = null;
  const close = () => { if (cur) chapters.push(finishChapter(cur, levels.scene === null)); };
  for (const el of elements) {
    const level = headingLevel(el);
    const text = title(cleanText(el.textContent));
    if (level === levels.chapter) { close(); cur = { title: text, intro: [], scenes: [] }; continue; }
    if (level !== null && level === levels.scene) {
      cur ??= { title: FALLBACK_CHAPTER_TITLE, intro: [], scenes: [] };
      cur.scenes.push({ title: text, lines: [] }); continue;
    }
    textTarget(cur, notes).push(...elementLines(el));
  }
  close();
  return { chapters, notes: toSynopsis(notes), source: "headings" };
}

function listItemScene(li: Element): OutlineScene {
  const lines: string[] = [];
  for (const nested of Array.from(li.children)) {
    if (nested.tagName === "UL" || nested.tagName === "OL") lines.push(...elementLines(nested));
  }
  return { title: title(ownText(li)), synopsis: toSynopsis(lines) };
}

function nestedItems(li: Element): Element[] {
  return Array.from(li.children)
    .filter((c) => c.tagName === "UL" || c.tagName === "OL")
    .flatMap((list) => childrenByTag(list, "LI"))
    .filter((item) => ownText(item));
}

function planFromLists(elements: Element[]): OutlinePlan | null {
  const items = elements.filter((el) => el.tagName === "UL" || el.tagName === "OL")
    .flatMap((list) => childrenByTag(list, "LI")).filter((li) => ownText(li));
  if (items.length === 0) return null;
  const nested = items.some((li) => nestedItems(li).length > 0);
  const chapters: OutlineChapter[] = nested
    ? items.map((li) => ({ title: title(ownText(li)), scenes: nestedItems(li).map(listItemScene) }))
    : [{ title: FALLBACK_CHAPTER_TITLE, scenes: items.map(listItemScene) }];
  return { chapters, notes: null, source: "lists" };
}

export function sceneCount(plan: OutlinePlan): number {
  return plan.chapters.reduce((n, ch) => n + ch.scenes.length, 0) + (plan.notes ? 1 : 0);
}

const NO_STRUCTURE =
  "No outline structure found. Mark chapter titles with Word's Heading 1 style and scene titles " +
  "with Heading 2 (Home → Styles), or use a bulleted list with scenes indented under each chapter.";

/** Build an import plan from mammoth's HTML. Throws OutlineImportError when nothing usable is found. */
export function planOutline(html: string): OutlinePlan {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  const elements = Array.from(body.children);
  const levels = headingLevels(elements);
  const plan = levels ? planFromHeadings(elements, levels) : planFromLists(elements);
  if (!plan || plan.chapters.length === 0) throw new OutlineImportError(NO_STRUCTURE);
  if (sceneCount(plan) > MAX_SCENES) {
    throw new OutlineImportError(
      `That outline would create more than ${MAX_SCENES} scenes. If it's a full manuscript rather than ` +
      "an outline, check that only chapter and scene titles use Heading styles.",
    );
  }
  return plan;
}
